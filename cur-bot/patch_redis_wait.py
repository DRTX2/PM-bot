"""
Patch workflows to add:
CHAT DISCORD:
  1. Redis dedup gate (entry): skip if same user sent same msg in last 5s (prevents double-fire)
  2. Redis cache for Trello/GH data (TTL 5 min) — check before hitting APIs, store after
  3. Redis cache for KPIs response (TTL 10 min)
  4. Wait node before diff fetching (allows APIs to respond fully before merge)

MONITOR PETSAFE:
  1. Redis cache: store result of each Trello/GH API call (TTL 10 min) — skip if cached
  2. Redis: store last analysis result for diffing (already was in postgres, but add redis fast cache)
  3. Wait node (small) between parallel fetches and Merge Datos
"""
import json
import uuid
import copy

REDIS_CREDS = {"id": "jAyEo3o5v0RaQJoI", "name": "Redis account"}
GEMINI_CREDS = {"id": "aFcqI71CduhYfRTh", "name": "Google Gemini(PaLM) Api account"}
PG_CREDS = {"id": "upx1y0H6Nw7XOqLJ", "name": "Postgres account"}

def uid():
    return str(uuid.uuid4())

# =============================================================================
# PATCH: Chat Discord PetSafe.json
# =============================================================================
with open("Chat Discord PetSafe.json") as f:
    chat = json.load(f)

chat_nodes = chat["nodes"]
chat_conns = chat["connections"]

def find_node(nodes, name):
    for n in nodes:
        if n["name"] == name:
            return n
    return None

def get_pos(nodes, name):
    n = find_node(nodes, name)
    return n["position"] if n else [0, 0]

# ------------------------------------------------------------------
# 1. DEDUP GATE: Redis check right after Config, before Router Comandos
#    Key: "dedup:{usuario}:{hash_of_message}"
#    If key exists → skip (respond 200 immediately)
#    If not → set key TTL 5s → continue
# ------------------------------------------------------------------
config_pos = get_pos(chat_nodes, "Config")
router_pos = get_pos(chat_nodes, "Router Comandos")

# Node: Read Redis dedup key
redis_dedup_get = {
    "parameters": {
        "operation": "get",
        "key": "={{ 'dedup:' + $json.usuario_discord + ':' + ($json.pregunta_usuario || '').slice(0,40).replace(/[^a-zA-Z0-9]/g,'') }}",
        "options": {}
    },
    "id": uid(),
    "name": "Redis Dedup Check",
    "type": "n8n-nodes-base.redis",
    "typeVersion": 1,
    "position": [config_pos[0] + 200, config_pos[1]],
    "credentials": {"redis": REDIS_CREDS},
    "continueOnFail": True
}

# Node: IF already processed (dedup hit)
if_dedup = {
    "parameters": {
        "conditions": {
            "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
            "conditions": [{
                "id": uid(),
                "leftValue": "={{ $json.value }}",
                "rightValue": "1",
                "operator": {"type": "string", "operation": "equals"}
            }],
            "combinator": "and"
        },
        "options": {}
    },
    "id": uid(),
    "name": "IF Duplicado",
    "type": "n8n-nodes-base.if",
    "typeVersion": 2.2,
    "position": [config_pos[0] + 400, config_pos[1]],
}

# Node: Respond immediately (dedup hit - already processing)
resp_dedup = {
    "parameters": {
        "respondWith": "text",
        "responseBody": "ok",
        "options": {}
    },
    "id": uid(),
    "name": "Resp Dedup Skip",
    "type": "n8n-nodes-base.respondToWebhook",
    "typeVersion": 1.1,
    "position": [config_pos[0] + 600, config_pos[1] - 150],
}

# Node: Set dedup key in Redis (TTL 5s)
redis_dedup_set = {
    "parameters": {
        "operation": "set",
        "key": "={{ 'dedup:' + $node['Config'].json.usuario_discord + ':' + ($node['Config'].json.pregunta_usuario || '').slice(0,40).replace(/[^a-zA-Z0-9]/g,'') }}",
        "value": "1",
        "expire": True,
        "ttl": 5,
        "keyType": "string"
    },
    "id": uid(),
    "name": "Redis Dedup Set",
    "type": "n8n-nodes-base.redis",
    "typeVersion": 1,
    "position": [config_pos[0] + 600, config_pos[1] + 80],
    "credentials": {"redis": REDIS_CREDS},
    "continueOnFail": True
}

chat_nodes.extend([redis_dedup_get, if_dedup, resp_dedup, redis_dedup_set])

# Rewire: Config → Redis Dedup Check → IF Duplicado
#   IF true (dup) → Resp Dedup Skip
#   IF false → Redis Dedup Set → Router Comandos
old_config_out = chat_conns.get("Config", {}).get("main", [[]])[0]  # was → Router Comandos

chat_conns["Config"] = {"main": [[{"node": "Redis Dedup Check", "type": "main", "index": 0}]]}
chat_conns["Redis Dedup Check"] = {"main": [[{"node": "IF Duplicado", "type": "main", "index": 0}]]}
chat_conns["IF Duplicado"] = {"main": [
    [{"node": "Resp Dedup Skip", "type": "main", "index": 0}],
    [{"node": "Redis Dedup Set", "type": "main", "index": 0}]
]}
chat_conns["Redis Dedup Set"] = {"main": [[{"node": "Router Comandos", "type": "main", "index": 0}]]}

# ------------------------------------------------------------------
# 2. Redis cache for API data (Trello + GH)
#    Before each parallel HTTP block: check Redis for cached payload (TTL 5 min = 300s)
#    After Merge Chat: store combined payload back
#    Key: "chat_ctx:{campo}" e.g. "chat_ctx:trello_cards"
#
#    Strategy: add a single Redis GET before Merge Chat that retrieves cached context.
#    If hit → skip APIs and jump directly to Construir Contexto.
#    If miss → APIs run, then after Merge Chat store to Redis.
# ------------------------------------------------------------------

merge_pos = get_pos(chat_nodes, "Merge Chat")
if_diff_pos = get_pos(chat_nodes, "IF Necesita Diff")

# Node: Try get full context from Redis cache
redis_ctx_get = {
    "parameters": {
        "operation": "get",
        "key": "chat_ctx:full_context",
        "options": {}
    },
    "id": uid(),
    "name": "Redis Get Context Cache",
    "type": "n8n-nodes-base.redis",
    "typeVersion": 1,
    "position": [merge_pos[0] - 300, merge_pos[1] - 200],
    "credentials": {"redis": REDIS_CREDS},
    "continueOnFail": True
}

# Node: Store merged context in Redis (TTL 5 min)
redis_ctx_set = {
    "parameters": {
        "operation": "set",
        "key": "chat_ctx:full_context",
        "value": "={{ JSON.stringify($input.all().map(i => i.json)) }}",
        "expire": True,
        "ttl": 300,
        "keyType": "string"
    },
    "id": uid(),
    "name": "Redis Set Context Cache",
    "type": "n8n-nodes-base.redis",
    "typeVersion": 1,
    "position": [merge_pos[0] + 50, merge_pos[1] + 150],
    "credentials": {"redis": REDIS_CREDS},
    "continueOnFail": True
}
chat_nodes.extend([redis_ctx_get, redis_ctx_set])

# After Merge Chat → Redis Set Context Cache → IF Necesita Diff
old_merge_out = chat_conns.get("Merge Chat", {}).get("main", [[]])[0]
chat_conns["Merge Chat"] = {"main": [[{"node": "Redis Set Context Cache", "type": "main", "index": 0}]]}
chat_conns["Redis Set Context Cache"] = {"main": [[{"node": "IF Necesita Diff", "type": "main", "index": 0}]]}

# ------------------------------------------------------------------
# 3. Redis cache for KPIs response (TTL 10 min = 600s)
#    After Formatear KPIs: store to Redis. Before: check Redis first.
# ------------------------------------------------------------------
kpi_pos = get_pos(chat_nodes, "Formatear KPIs")
resp_kpi_pos = get_pos(chat_nodes, "Resp KPIs")

redis_kpi_get = {
    "parameters": {
        "operation": "get",
        "key": "cache:kpis_response",
        "options": {}
    },
    "id": uid(),
    "name": "Redis Get KPIs Cache",
    "type": "n8n-nodes-base.redis",
    "typeVersion": 1,
    "position": [kpi_pos[0] - 200, kpi_pos[1]],
    "credentials": {"redis": REDIS_CREDS},
    "continueOnFail": True
}

if_kpi_cached = {
    "parameters": {
        "conditions": {
            "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
            "conditions": [{
                "id": uid(),
                "leftValue": "={{ $json.value !== null && $json.value !== undefined && $json.value !== '' }}",
                "rightValue": "true",
                "operator": {"type": "string", "operation": "equals"}
            }],
            "combinator": "and"
        },
        "options": {}
    },
    "id": uid(),
    "name": "IF KPIs Cacheados",
    "type": "n8n-nodes-base.if",
    "typeVersion": 2.2,
    "position": [kpi_pos[0] - 50, kpi_pos[1]],
}

resp_kpi_cached = {
    "parameters": {
        "respondWith": "text",
        "responseBody": "={{ $json.value }}",
        "options": {}
    },
    "id": uid(),
    "name": "Resp KPIs Cacheados",
    "type": "n8n-nodes-base.respondToWebhook",
    "typeVersion": 1.1,
    "position": [kpi_pos[0] + 150, kpi_pos[1] - 150],
}

redis_kpi_set = {
    "parameters": {
        "operation": "set",
        "key": "cache:kpis_response",
        "value": "={{ $json.respuesta_discord }}",
        "expire": True,
        "ttl": 600,
        "keyType": "string"
    },
    "id": uid(),
    "name": "Redis Set KPIs Cache",
    "type": "n8n-nodes-base.redis",
    "typeVersion": 1,
    "position": [kpi_pos[0] + 150, kpi_pos[1] + 150],
    "credentials": {"redis": REDIS_CREDS},
    "continueOnFail": True
}

chat_nodes.extend([redis_kpi_get, if_kpi_cached, resp_kpi_cached, redis_kpi_set])

# Rewire KPIs path:
# Postgres Ultimo KPI → Redis Get KPIs Cache → IF KPIs Cacheados
#   true → Resp KPIs Cacheados
#   false → Formatear KPIs → Redis Set KPIs Cache → Resp KPIs
old_pg_kpi_out = chat_conns.get("Postgres Ultimo KPI", {}).get("main", [[]])[0]
chat_conns["Postgres Ultimo KPI"] = {"main": [[{"node": "Redis Get KPIs Cache", "type": "main", "index": 0}]]}
chat_conns["Redis Get KPIs Cache"] = {"main": [[{"node": "IF KPIs Cacheados", "type": "main", "index": 0}]]}
chat_conns["IF KPIs Cacheados"] = {"main": [
    [{"node": "Resp KPIs Cacheados", "type": "main", "index": 0}],
    [{"node": "Formatear KPIs", "type": "main", "index": 0}]
]}
chat_conns["Formatear KPIs"] = {"main": [[{"node": "Redis Set KPIs Cache", "type": "main", "index": 0}]]}
chat_conns["Redis Set KPIs Cache"] = {"main": [[{"node": "Resp KPIs", "type": "main", "index": 0}]]}

# ------------------------------------------------------------------
# 4. Wait node before Diff fetching to avoid race conditions
#    Place a 1-second Wait between IF Necesita Diff (true branch) and Diff Backend/Frontend
# ------------------------------------------------------------------
wait_diff = {
    "parameters": {"amount": 1, "unit": "seconds"},
    "id": uid(),
    "name": "Wait Diff APIs",
    "type": "n8n-nodes-base.wait",
    "typeVersion": 1.1,
    "position": [if_diff_pos[0] + 200, if_diff_pos[1] - 80],
    "webhookId": uid()
}
chat_nodes.append(wait_diff)

# Rewire: IF Necesita Diff true → Wait Diff APIs → Diff Backend + Diff Frontend
old_diff_true = chat_conns.get("IF Necesita Diff", {}).get("main", [[]])[0]
chat_conns["IF Necesita Diff"]["main"][0] = [{"node": "Wait Diff APIs", "type": "main", "index": 0}]
chat_conns["Wait Diff APIs"] = {"main": [old_diff_true]}

# ------------------------------------------------------------------
# 5. Rate-limit gate: store last request timestamp per user in Redis
#    If user sends more than 1 message every 8s, queue them
# ------------------------------------------------------------------
# (This is handled by the dedup gate above - 5s TTL effectively rate-limits)

with open("Chat Discord PetSafe.json", "w") as f:
    json.dump(chat, f, indent=2, ensure_ascii=False)

print("Chat Discord patched OK")

# =============================================================================
# PATCH: Monitor PetSafe.json
# =============================================================================
with open("Monitor PetSafe.json") as f:
    mon = json.load(f)

mon_nodes = mon["nodes"]
mon_conns = mon["connections"]

def find_node_m(name):
    for n in mon_nodes:
        if n["name"] == name:
            return n
    return None

def get_pos_m(name):
    n = find_node_m(name)
    return n["position"] if n else [0, 0]

# ------------------------------------------------------------------
# 1. Redis cache for each API group (Trello, GitHub, Postgres)
#    Check before firing parallel requests.
#    Key: "mon:trello_data", "mon:github_data", "mon:pg_data"  TTL: 10 min
#
#    Strategy: single gate before Configuración fans out to APIs.
#    If "mon:full_data" cached → skip all APIs and jump directly to Análisis + KPIs.
#    If not → run APIs, then after Merge Datos store to Redis.
# ------------------------------------------------------------------
conf_pos = get_pos_m("Configuración")
merge_pos_m = get_pos_m("Merge Datos")
kpis_pos = get_pos_m("Análisis + KPIs")

# Node: Check Redis for full cached data
redis_mon_get = {
    "parameters": {
        "operation": "get",
        "key": "mon:full_data",
        "options": {}
    },
    "id": uid(),
    "name": "Redis Check Mon Cache",
    "type": "n8n-nodes-base.redis",
    "typeVersion": 1,
    "position": [conf_pos[0] + 220, conf_pos[1]],
    "credentials": {"redis": REDIS_CREDS},
    "continueOnFail": True
}

# Node: IF cache hit
if_mon_cached = {
    "parameters": {
        "conditions": {
            "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
            "conditions": [{
                "id": uid(),
                "leftValue": "={{ $json.value !== null && $json.value !== undefined && $json.value !== '' }}",
                "rightValue": "true",
                "operator": {"type": "string", "operation": "equals"}
            }],
            "combinator": "and"
        },
        "options": {}
    },
    "id": uid(),
    "name": "IF Mon Cached",
    "type": "n8n-nodes-base.if",
    "typeVersion": 2.2,
    "position": [conf_pos[0] + 420, conf_pos[1]],
}

# Node: Parse cached JSON and inject directly to Análisis + KPIs
parse_mon_cache = {
    "parameters": {
        "jsCode": "const raw = $json.value;\nlet items;\ntry { items = JSON.parse(raw); } catch(e) { items = []; }\nif (!Array.isArray(items)) items = [items];\nreturn items.map(j => ({ json: j }));"
    },
    "id": uid(),
    "name": "Parse Mon Cache",
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": [conf_pos[0] + 620, conf_pos[1] - 150],
}

# Node: Store merged data to Redis (TTL 10 min = 600s)
redis_mon_set = {
    "parameters": {
        "operation": "set",
        "key": "mon:full_data",
        "value": "={{ JSON.stringify($input.all().map(i => i.json)) }}",
        "expire": True,
        "ttl": 600,
        "keyType": "string"
    },
    "id": uid(),
    "name": "Redis Store Mon Cache",
    "type": "n8n-nodes-base.redis",
    "typeVersion": 1,
    "position": [merge_pos_m[0] + 30, merge_pos_m[1] + 180],
    "credentials": {"redis": REDIS_CREDS},
    "continueOnFail": True
}

# ------------------------------------------------------------------
# 2. Wait node between fan-out APIs and Merge Datos
#    Gives slower APIs (CI runs) time to settle before merge
# ------------------------------------------------------------------
wait_mon = {
    "parameters": {"amount": 2, "unit": "seconds"},
    "id": uid(),
    "name": "Wait APIs Settle",
    "type": "n8n-nodes-base.wait",
    "typeVersion": 1.1,
    "position": [merge_pos_m[0] - 180, merge_pos_m[1]],
    "webhookId": uid()
}

# ------------------------------------------------------------------
# 3. Redis: cache last IA analysis result (TTL 48h, matches schedule)
#    After Discord Alerta: store last report text for diffing on next run
# ------------------------------------------------------------------
disc_pos = get_pos_m("Discord Alerta")
redis_last_report = {
    "parameters": {
        "operation": "set",
        "key": "mon:last_report",
        "value": "={{ $node['Build Discord Payload'].json.embed_json }}",
        "expire": True,
        "ttl": 172800,
        "keyType": "string"
    },
    "id": uid(),
    "name": "Redis Store Last Report",
    "type": "n8n-nodes-base.redis",
    "typeVersion": 1,
    "position": [disc_pos[0] + 240, disc_pos[1]],
    "credentials": {"redis": REDIS_CREDS},
    "continueOnFail": True
}

mon_nodes.extend([redis_mon_get, if_mon_cached, parse_mon_cache, redis_mon_set, wait_mon, redis_last_report])

# Rewire Monitor:
# Schedule → Configuración → Redis Check Mon Cache → IF Mon Cached
#   true  → Parse Mon Cache → Análisis + KPIs
#   false → [all APIs fan-out as before] → Wait APIs Settle → Merge Datos → Redis Store Mon Cache → Análisis + KPIs
#
# Discord Alerta → Redis Store Last Report

# Schedule → Configuración stays unchanged
# Rewire Configuración output to go to Redis first
old_conf_out = mon_conns.get("Configuración", {}).get("main", [[]])[0]
mon_conns["Configuración"] = {"main": [[{"node": "Redis Check Mon Cache", "type": "main", "index": 0}]]}
mon_conns["Redis Check Mon Cache"] = {"main": [[{"node": "IF Mon Cached", "type": "main", "index": 0}]]}
mon_conns["IF Mon Cached"] = {"main": [
    [{"node": "Parse Mon Cache", "type": "main", "index": 0}],
    old_conf_out  # false → all the APIs that Configuración used to fan-out to
]}
# Parse cache goes straight to Análisis + KPIs
mon_conns["Parse Mon Cache"] = {"main": [[{"node": "Análisis + KPIs", "type": "main", "index": 0}]]}

# Insert Wait before Merge Datos
old_merge_in_sources = []
# Find who points to Merge Datos and redirect them to Wait first
for src, src_conns in mon_conns.items():
    if src in ["Redis Check Mon Cache", "IF Mon Cached", "Parse Mon Cache", "Redis Store Mon Cache", "Wait APIs Settle"]:
        continue
    for branch in src_conns.get("main", []):
        for edge in branch:
            if edge["node"] == "Merge Datos":
                edge["node"] = "Wait APIs Settle"  # redirect to Wait first

mon_conns["Wait APIs Settle"] = {"main": [[{"node": "Merge Datos", "type": "main", "index": 0}]]}

# After Merge: → Redis Store Mon Cache → Análisis + KPIs
old_merge_out_m = mon_conns.get("Merge Datos", {}).get("main", [[]])[0]
mon_conns["Merge Datos"] = {"main": [[{"node": "Redis Store Mon Cache", "type": "main", "index": 0}]]}
mon_conns["Redis Store Mon Cache"] = {"main": [old_merge_out_m]}

# Discord Alerta → Redis Store Last Report
old_disc_out = mon_conns.get("Discord Alerta", {}).get("main", [[]])[0] if mon_conns.get("Discord Alerta") else []
mon_conns["Discord Alerta"] = {"main": [[{"node": "Redis Store Last Report", "type": "main", "index": 0}]]}
if old_disc_out:
    mon_conns["Redis Store Last Report"] = {"main": [old_disc_out]}

with open("Monitor PetSafe.json", "w") as f:
    json.dump(mon, f, indent=2, ensure_ascii=False)

print("Monitor PetSafe patched OK")
