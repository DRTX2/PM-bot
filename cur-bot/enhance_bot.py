import json, uuid

def uid(): return str(uuid.uuid4())
REDIS = {"id": "jAyEo3o5v0RaQJoI", "name": "Redis account"}
GEMINI_CREDS = {"id": "aFcqI71CduhYfRTh", "name": "Google Gemini(PaLM) Api account"}

with open("Chat Discord PetSafe.json") as f:
    wf = json.load(f)

nodes = wf["nodes"]
conns = wf["connections"]

def get_node(name):
    return next((n for n in nodes if n["name"] == name), None)

# ─────────────────────────────────────────
# 1. Patch Router Comandos: add new cases + formato field
# ─────────────────────────────────────────
router = get_node("Router Comandos")
code = router["parameters"]["jsCode"]

NEW_CASES = """    case '!estado':
      comando.nombre = 'estado'; comando.tipo = 'chat'; comando.formato = 'estado'; break;
    case '!vencidas':
      comando.nombre = 'vencidas'; comando.tipo = 'chat'; comando.formato = 'vencidas'; break;
    case '!miembros':
      comando.nombre = 'miembros'; comando.tipo = 'chat'; comando.formato = 'miembros'; break;
    case '!commits':
      comando.nombre = 'commits'; comando.tipo = 'chat'; comando.formato = 'commits'; break;
    case '!ci':
      comando.nombre = 'ci'; comando.tipo = 'chat'; comando.formato = 'ci'; break;
    case '!progreso':
      comando.nombre = 'progreso'; comando.tipo = 'chat'; comando.formato = 'progreso'; break;
    """

code = code.replace("    default:\n", NEW_CASES + "    default:\n")

OLD_RETURN = """return [{
  json: {
    pregunta,
    comando,
    // Mantenemos compatibilidad con nodos antiguos
    tipo: comando.error ? 'error' : comando.tipo,
    necesita_diff: comando.necesita_diff,
    usuario: $node['Config'].json.usuario_discord
  }
}];"""

NEW_RETURN = """return [{
  json: {
    pregunta,
    comando,
    tipo: comando.error ? 'error' : comando.tipo,
    necesita_diff: comando.necesita_diff,
    formato: comando.formato || 'chat',
    usuario: $node['Config'].json.usuario_discord
  }
}];"""

code = code.replace(OLD_RETURN, NEW_RETURN)
router["parameters"]["jsCode"] = code

# ─────────────────────────────────────────
# 2. Insert IF Necesita AI between Construir Contexto and Gemini Chat
# ─────────────────────────────────────────
ctx_pos = get_node("Construir Contexto")["position"]
gem_pos = get_node("Gemini Chat")["position"]

if_ai = {
    "parameters": {
        "conditions": {
            "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
            "conditions": [{
                "id": uid(),
                "leftValue": "={{ ['estado','vencidas','miembros','commits','ci','progreso'].includes($node['Router Comandos'].json.formato) }}",
                "rightValue": "true",
                "operator": {"type": "string", "operation": "equals"}
            }],
            "combinator": "and"
        },
        "options": {}
    },
    "id": uid(), "name": "IF Datos Rapidos",
    "type": "n8n-nodes-base.if", "typeVersion": 2.2,
    "position": [ctx_pos[0] + 220, ctx_pos[1]]
}
nodes.append(if_ai)

# Reroute Construir Contexto → IF Datos Rapidos
conns["Construir Contexto"] = {"main": [[{"node": "IF Datos Rapidos", "type": "main", "index": 0}]]}
# IF false (not data-only) → Gemini Chat
conns["IF Datos Rapidos"] = {"main": [
    [],  # true branch → Switch Formato (added below)
    [{"node": "Gemini Chat", "type": "main", "index": 0}]
]}

# ─────────────────────────────────────────
# 3. Switch Formato node
# ─────────────────────────────────────────
sw_pos = [ctx_pos[0] + 440, ctx_pos[1] + 120]

FORMATS = ["estado", "vencidas", "miembros", "commits", "ci", "progreso"]
rules = [{"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 3},
          "conditions": [{"id": uid(), "leftValue": "={{ $node['Router Comandos'].json.formato }}",
                          "rightValue": fmt,
                          "operator": {"type": "string", "operation": "equals"}}],
          "combinator": "and"},
          "renameOutput": True, "outputKey": fmt} for fmt in FORMATS]

sw_formato = {
    "parameters": {"rules": {"values": rules}, "options": {"fallbackOutput": "extra"}},
    "id": uid(), "name": "Switch Formato",
    "type": "n8n-nodes-base.switch", "typeVersion": 3.4,
    "position": sw_pos
}
nodes.append(sw_formato)

# Connect IF true → Switch Formato
conns["IF Datos Rapidos"]["main"][0] = [{"node": "Switch Formato", "type": "main", "index": 0}]

# ─────────────────────────────────────────
# 4. Formatter Code nodes + Resp nodes
# ─────────────────────────────────────────

# Helper JS code for formatters (they read directly from upstream nodes)
ESTADO_CODE = """
const h = $node['PG Historial']?.first()?.json || {};
const kpis = (typeof h.kpis_json === 'string' ? JSON.parse(h.kpis_json) : h.kpis_json) || {};
const cards = $node['Trello Cards'].all().map(i=>i.json);
const total = cards.length;
const done = cards.filter(c=>c.dueComplete).length;
const overdue = cards.filter(c=>c.due && !c.dueComplete && new Date(c.due)<new Date()).length;
const pct = total>0?Math.round(done/total*100):0;
const vel = kpis.velocidad_tareas_por_dia ?? '?';
const proj = kpis.proyeccion ?? 'sin datos';
const emojiProj = proj==='on-track'?'✅':proj==='riesgo'?'⚠️':'🔴';
const lines = [
  '**📊 ESTADO DEL PROYECTO PetSafe**',
  `Progreso: **${pct}%** (${done}/${total} tareas)  ${emojiProj} ${proj}`,
  `Vencidas: **${overdue}**  |  Velocidad: **${vel}** tareas/día`,
  `Commits 14d: **${kpis.commits_14d ?? '?'}**  |  Bus factor: **${kpis.bus_factor_14d ?? '?'}**`,
  `Días hasta entrega: **${kpis.dias_hasta_fin ?? '?'}**`
];
return [{json:{respuesta: lines.join('\\n')}}];
"""

VENCIDAS_CODE = """
const cards = $node['Trello Cards'].all().map(i=>i.json);
const lists = $node['Trello Lists'].all().map(i=>i.json);
const members = $node['Trello Members'].all().map(i=>i.json);
const listById = Object.fromEntries(lists.map(l=>[l.id,l.name]));
const memById = Object.fromEntries(members.map(m=>[m.id,m.fullName||m.username]));
const now = new Date();
const venc = cards.filter(c=>c.due&&!c.dueComplete&&new Date(c.due)<now);
if(!venc.length) return [{json:{respuesta:'✅ No hay tareas vencidas.'}}];
const lines = ['**🔴 TAREAS VENCIDAS**',''];
for(const c of venc.slice(0,10)){
  const dias = Math.floor((now-new Date(c.due))/86400000);
  const resp = (c.idMembers||[]).map(id=>memById[id]||id).join(', ') || 'sin asignar';
  lines.push(`• **${c.name}**`);
  lines.push(`  Lista: ${listById[c.idList]||'?'} | Resp: ${resp} | Hace ${dias}d`);
}
if(venc.length>10) lines.push(`...y ${venc.length-10} más`);
return [{json:{respuesta:lines.join('\\n')}}];
"""

MIEMBROS_CODE = """
const cards = $node['Trello Cards'].all().map(i=>i.json);
const members = $node['Trello Members'].all().map(i=>i.json);
const memById = Object.fromEntries(members.map(m=>[m.id,m.fullName||m.username]));
const now = new Date();
const stats = {};
for(const c of cards){
  for(const id of (c.idMembers||[])){
    const name = memById[id]||id;
    if(!stats[name]) stats[name]={asig:0,done:0,venc:0};
    stats[name].asig++;
    if(c.dueComplete) stats[name].done++;
    else if(c.due&&new Date(c.due)<now) stats[name].venc++;
  }
}
const lines = ['**👥 CARGA DEL EQUIPO**','`Miembro          | Asig | Done | Venc`'];
for(const [name,s] of Object.entries(stats)){
  const short = name.split(' ').slice(0,2).join(' ').padEnd(16);
  lines.push(`${short} |  ${String(s.asig).padStart(2)}  |  ${String(s.done).padStart(2)}  |  ${String(s.venc).padStart(2)}`);
}
return [{json:{respuesta:lines.join('\\n')}}];
"""

COMMITS_CODE = """
const bC = $node['GH Back Commits'].all().map(i=>i.json).slice(0,5);
const fC = $node['GH Front Commits'].all().map(i=>i.json).slice(0,5);
const fmt = (c,repo)=>`• \`${(c.sha||'').slice(0,7)}\` [${repo}] **${(c.commit?.author?.name||'?').split(' ')[0]}**: ${(c.commit?.message||'').split('\\n')[0].slice(0,70)}`;
const lines = ['**📝 COMMITS RECIENTES**','**Backend:**',...bC.map(c=>fmt(c,'back')),'','**Frontend:**',...fC.map(c=>fmt(c,'front'))];
return [{json:{respuesta:lines.join('\\n')}}];
"""

CI_CODE = """
const bR = $node['GH Back CI Runs'].first()?.json?.workflow_runs?.[0];
const fR = $node['GH Front CI Runs'].first()?.json?.workflow_runs?.[0];
const emo = s=>s==='success'?'✅':s==='failure'?'❌':s==='in_progress'?'🔄':'⚪';
const fmt = (r,label)=>r?`${emo(r.conclusion||r.status)} **${label}**: ${r.conclusion||r.status} | rama: ${r.head_branch} | por: ${r.actor?.login||'?'}`:`⚪ **${label}**: sin datos`;
const lines = ['**🔧 ESTADO CI/CD**',fmt(bR,'Backend'),fmt(fR,'Frontend'),'','🌐 Deploy: https://pet-safe-six.vercel.app'];
return [{json:{respuesta:lines.join('\\n')}}];
"""

PROGRESO_CODE = """
const cards = $node['Trello Cards'].all().map(i=>i.json);
const h = $node['PG Historial']?.first()?.json||{};
const kpis=(typeof h.kpis_json==='string'?JSON.parse(h.kpis_json):h.kpis_json)||{};
const now=new Date();
const total=cards.length, done=cards.filter(c=>c.dueComplete).length;
const pend=cards.filter(c=>!c.dueComplete&&!(c.due&&new Date(c.due)<now)).length;
const venc=cards.filter(c=>c.due&&!c.dueComplete&&new Date(c.due)<now).length;
const pct=total>0?Math.round(done/total*100):0;
const bar='█'.repeat(Math.round(pct/10))+'░'.repeat(10-Math.round(pct/10));
const lines=[
  '**🏁 PROGRESO DEL SPRINT**',
  `\`[${bar}] ${pct}%\``,
  `Completadas: **${done}** | Pendientes: **${pend}** | Vencidas: **${venc}**`,
  `Velocidad: **${kpis.velocidad_tareas_por_dia??'?'}** t/día | Commits/día: **${kpis.commits_por_dia??'?'}**`,
  `Proyección: **${kpis.proyeccion??'sin datos'}** | Días hasta fin: **${kpis.dias_hasta_fin??'?'}**`
];
return [{json:{respuesta:lines.join('\\n')}}];
"""

FORMATTERS = [
    ("Formatear Estado", ESTADO_CODE),
    ("Formatear Vencidas", VENCIDAS_CODE),
    ("Formatear Miembros", MIEMBROS_CODE),
    ("Formatear Commits", COMMITS_CODE),
    ("Formatear CI", CI_CODE),
    ("Formatear Progreso", PROGRESO_CODE),
]

sw_branches = []
for i, (name, code_str) in enumerate(FORMATTERS):
    fmt_name = FORMATS[i]
    pos_x = sw_pos[0] + 240
    pos_y = sw_pos[1] + (i - 2) * 180

    fmt_node = {
        "parameters": {"jsCode": code_str},
        "id": uid(), "name": name,
        "type": "n8n-nodes-base.code", "typeVersion": 2,
        "position": [pos_x, pos_y]
    }
    resp_node = {
        "parameters": {
            "respondWith": "text",
            "responseBody": "={{ $json.respuesta }}",
            "options": {}
        },
        "id": uid(), "name": f"Resp {fmt_name.split()[-1]}",
        "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1,
        "position": [pos_x + 240, pos_y]
    }
    nodes.extend([fmt_node, resp_node])
    conns[name] = {"main": [[{"node": resp_node["name"], "type": "main", "index": 0}]]}
    sw_branches.append([{"node": name, "type": "main", "index": 0}])

conns["Switch Formato"] = {"main": sw_branches}

# ─────────────────────────────────────────
# 5. AI Tools connected to Gemini Chat agent
# ─────────────────────────────────────────

# Tool: HTTP request - search Trello cards
tool_trello = {
    "parameters": {
        "name": "buscar_tarjeta_trello",
        "description": "Busca tarjetas en Trello por nombre o descripcion. Retorna nombre, lista, estado y fecha limite. Input: palabra clave.",
        "method": "GET",
        "url": "=https://api.trello.com/1/search?query={{ encodeURIComponent($fromAI('keyword')) }}&idBoards={{ $node['Config'].json.TRELLO_BOARD_ID }}&card_fields=name,desc,due,dueComplete,idList&key={{ $node['Config'].json.TRELLO_KEY }}&token={{ $node['Config'].json.TRELLO_TOKEN }}&modelTypes=cards",
        "sendHeaders": True,
        "headerParameters": {"parameters": []},
        "options": {}
    },
    "id": uid(),
    "name": "Tool Buscar Trello",
    "type": "@n8n/n8n-nodes-langchain.toolHttpRequest",
    "typeVersion": 1.1,
    "position": [2640, 4560]
}

# Tool: HTTP request - GitHub Actions status
tool_ci = {
    "parameters": {
        "name": "ver_estado_ci",
        "description": "Obtiene el estado actual del pipeline CI/CD de GitHub Actions para backend o frontend. Input: 'backend' o 'frontend'.",
        "method": "GET",
        "url": "=https://api.github.com/repos/{{ $node['Config'].json.GITHUB_OWNER_BACKEND }}/{{ $fromAI('repo') === 'frontend' ? $node['Config'].json.GITHUB_REPO_FRONTEND : $node['Config'].json.GITHUB_REPO_BACKEND }}/actions/runs?per_page=3",
        "sendHeaders": True,
        "headerParameters": {"parameters": [
            {"name": "Authorization", "value": "=Bearer {{ $node['Config'].json.GITHUB_TOKEN }}"},
            {"name": "Accept", "value": "application/vnd.github+json"}
        ]},
        "options": {}
    },
    "id": uid(),
    "name": "Tool Ver CI",
    "type": "@n8n/n8n-nodes-langchain.toolHttpRequest",
    "typeVersion": 1.1,
    "position": [2780, 4560]
}

nodes.extend([tool_trello, tool_ci])
conns["Tool Buscar Trello"] = {"ai_tool": [[{"node": "Gemini Chat", "type": "ai_tool", "index": 0}]]}
conns["Tool Ver CI"] = {"ai_tool": [[{"node": "Gemini Chat", "type": "ai_tool", "index": 0}]]}

# ─────────────────────────────────────────
# 6. Validate and save
# ─────────────────────────────────────────
all_names = {n["name"] for n in nodes}
errors = []
for src, branches in conns.items():
    for branch in branches.get("main", []):
        for e in branch:
            if e["node"] not in all_names:
                errors.append(f"MISSING: {src} -> {e['node']}")
    for branch in branches.get("ai_tool", []):
        for e in branch:
            if e["node"] not in all_names:
                errors.append(f"MISSING tool: {src} -> {e['node']}")

if errors:
    for err in errors:
        print(err)
else:
    with open("Chat Discord PetSafe.json", "w") as f:
        json.dump(wf, f, indent=2, ensure_ascii=False)
    print(f"OK - {len(nodes)} nodes, {len(conns)} connection sources")
    added = ["IF Datos Rapidos","Switch Formato","Tool Buscar Trello","Tool Ver CI"] + [f[0] for f in FORMATTERS] + [f"Resp {f[0].split()[-1]}" for f in FORMATTERS]
    print("Added:", ", ".join(added))
