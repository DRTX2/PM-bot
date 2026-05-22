#!/usr/bin/env python3
"""Patches Reporte PDF Semanal.json with enriched analysis, STRATIUM format, and debt detection."""
import json, uuid, os

BASE = os.path.dirname(os.path.abspath(__file__))
WF_PATH = os.path.join(BASE, '..', 'Reporte PDF Semanal.json')
LOGO_PATH = os.path.join(BASE, 'logo_b64.txt')

# Read files
with open(WF_PATH, 'r') as f:
    wf = json.load(f)
with open(os.path.join(BASE, 'build_report_data_v2.js'), 'r') as f:
    js_report_data = f.read()
with open(os.path.join(BASE, 'build_html_v2.js'), 'r') as f:
    js_html = f.read()
with open(LOGO_PATH, 'r') as f:
    logo_b64 = f.read().strip()

# Inject logo into HTML JS
js_html = js_html.replace('__LOGO_B64__', logo_b64)

def uid():
    return str(uuid.uuid4())

# ============================================================
# 1. Find existing nodes
# ============================================================
nodes_by_name = {n['name']: n for n in wf['nodes']}
config_node = nodes_by_name['Configuración']

# Get positions relative to existing nodes
config_pos = config_node['position']
gh_back_pos = nodes_by_name['GitHub Back 7d']['position']
gh_front_pos = nodes_by_name['GitHub Front 7d']['position']

# ============================================================
# 2. Add GitHub PR nodes
# ============================================================
gh_back_prs_id = uid()
gh_front_prs_id = uid()

gh_back_prs = {
    "parameters": {
        "url": "=https://api.github.com/repos/{{ $node[\"Configuración\"].json.GITHUB_OWNER_BACKEND }}/{{ $node[\"Configuración\"].json.GITHUB_REPO_BACKEND }}/pulls",
        "sendQuery": True,
        "queryParameters": {"parameters": [
            {"name": "state", "value": "all"},
            {"name": "sort", "value": "updated"},
            {"name": "direction", "value": "desc"},
            {"name": "per_page", "value": "30"}
        ]},
        "sendHeaders": True,
        "headerParameters": {"parameters": [
            {"name": "Authorization", "value": "=Bearer {{ $node[\"Configuración\"].json.GITHUB_TOKEN_BACKEND || $node[\"Configuración\"].json.GITHUB_TOKEN }}"},
            {"name": "Accept", "value": "application/vnd.github+json"}
        ]},
        "options": {}
    },
    "id": gh_back_prs_id,
    "name": "GitHub Back PRs",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.2,
    "position": [gh_back_pos[0], gh_back_pos[1] + 200]
}

gh_front_prs = {
    "parameters": {
        "url": "=https://api.github.com/repos/{{ $node[\"Configuración\"].json.GITHUB_OWNER_FRONTEND }}/{{ $node[\"Configuración\"].json.GITHUB_REPO_FRONTEND }}/pulls",
        "sendQuery": True,
        "queryParameters": {"parameters": [
            {"name": "state", "value": "all"},
            {"name": "sort", "value": "updated"},
            {"name": "direction", "value": "desc"},
            {"name": "per_page", "value": "30"}
        ]},
        "sendHeaders": True,
        "headerParameters": {"parameters": [
            {"name": "Authorization", "value": "=Bearer {{ $node[\"Configuración\"].json.GITHUB_TOKEN_FRONTEND || $node[\"Configuración\"].json.GITHUB_TOKEN }}"},
            {"name": "Accept", "value": "application/vnd.github+json"}
        ]},
        "options": {}
    },
    "id": gh_front_prs_id,
    "name": "GitHub Front PRs",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.2,
    "position": [gh_front_pos[0], gh_front_pos[1] + 200]
}

wf['nodes'].append(gh_back_prs)
wf['nodes'].append(gh_front_prs)

# ============================================================
# 3. Add Debt Detection nodes
# ============================================================
build_html_pos = nodes_by_name['Build HTML + Binary']['position']

if_debt_id = uid()
if_debt = {
    "parameters": {
        "conditions": {
            "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
            "conditions": [{
                "id": uid(),
                "leftValue": "={{ $json.debt_detected }}",
                "rightValue": True,
                "operator": {"type": "boolean", "operation": "true", "singleValue": True}
            }],
            "combinator": "and"
        },
        "options": {}
    },
    "id": if_debt_id,
    "name": "IF Deuda Técnica",
    "type": "n8n-nodes-base.if",
    "typeVersion": 2.2,
    "position": [build_html_pos[0] + 400, build_html_pos[1] + 400]
}

build_pm_id = uid()
build_pm = {
    "parameters": {
        "jsCode": """const d = $json.debt_details || {};
const ranking = $json.ranking || [];
const config = $node['Configuración'].json;

const embed = {
  title: '🚨 Solicitud de Cambio — Deuda Técnica Detectada',
  color: 15158332,
  fields: [
    { name: '📋 Descripción', value: (d.descripcion_problema || 'Deuda técnica detectada').slice(0, 1024), inline: false },
    { name: '📊 Score', value: Math.round((d.score || 0) * 100) + '%', inline: true },
    { name: '⚡ Impacto', value: (d.impacto || 'Por evaluar').slice(0, 512), inline: false },
    { name: '🔧 Recomendación', value: (d.recomendacion || 'Revisión técnica requerida').slice(0, 512), inline: false },
    { name: '⚠️ Señales', value: (d.señales || []).join('\\n').slice(0, 1024) || 'N/A', inline: false },
    { name: '👤 PM Responsable', value: 'Bonilla', inline: true },
    { name: '📅 Fecha', value: new Date().toLocaleDateString('es-EC'), inline: true }
  ],
  footer: { text: 'PetSafe Bot PM — Aprobación requerida vía Dashboard' }
};

return [{json: {
  content: '🚨 **@Bonilla** — Se requiere tu aprobación para una solicitud de cambio por deuda técnica detectada.',
  embeds: [embed],
  username: 'PetSafe PM Bot',
  debt_details: d,
  correlation_id: 'debt-' + Date.now()
}}];"""
    },
    "id": build_pm_id,
    "name": "Build PM Request",
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": [build_html_pos[0] + 700, build_html_pos[1] + 400]
}

discord_pm_id = uid()
discord_pm = {
    "parameters": {
        "method": "POST",
        "url": "={{ $env.DISCORD_WEBHOOK_URL }}",
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify({ content: $json.content, embeds: $json.embeds, username: $json.username }) }}",
        "options": {}
    },
    "id": discord_pm_id,
    "name": "Discord PM Debt Alert",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.2,
    "position": [build_html_pos[0] + 1000, build_html_pos[1] + 400]
}

pg_debt_id = uid()
pg_debt = {
    "parameters": {
        "operation": "executeQuery",
        "query": "INSERT INTO ai_decisions (correlation_id, agent_role, decision_type, input_summary, decision, recommendation, confidence, risk_level, requires_human_approval, status) VALUES ($1, 'pm_bot', 'debt_review', $2, $3::jsonb, $4, $5, $6, true, 'pending_approval')",
        "options": {
            "queryReplacement": "={{ [$json.correlation_id, 'Deuda técnica detectada en periodo de reporte', JSON.stringify($json.debt_details), $json.debt_details.recomendacion || 'Revisión requerida', $json.debt_details.score || 0, ($json.debt_details.score || 0) >= 0.6 ? 'high' : 'medium'] }}"
        }
    },
    "id": pg_debt_id,
    "name": "PG Guardar Solicitud Deuda",
    "type": "n8n-nodes-base.postgres",
    "typeVersion": 2.4,
    "position": [build_html_pos[0] + 1000, build_html_pos[1] + 600],
    "credentials": nodes_by_name['PG Log Reporte'].get('credentials', {})
}

wf['nodes'].extend([if_debt, build_pm, discord_pm, pg_debt])

# ============================================================
# 4. Update existing nodes
# ============================================================

# Update Build Report Data
for node in wf['nodes']:
    if node['name'] == 'Build Report Data':
        node['parameters']['jsCode'] = js_report_data

    # Update Gemini to use JSON mode + more tokens
    if node['name'] == 'Gemini Executive Summary':
        node['parameters']['jsonBody'] = "={{ ({ contents: [{ parts: [{ text: $json.prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 8192, response_mime_type: 'application/json' } }) }}"
        node['name'] = 'Gemini Deep Analysis'

    # Update Build HTML + Binary
    if node['name'] == 'Build HTML + Binary':
        node['parameters']['jsCode'] = js_html

# ============================================================
# 5. Update connections
# ============================================================

# Add Config -> GitHub Back PRs
config_name = 'Configuración'
if config_name not in wf['connections']:
    wf['connections'][config_name] = {"main": [[]]}

config_main = wf['connections'][config_name]['main']
# Ensure enough output slots
while len(config_main) < 1:
    config_main.append([])

# Add to output 0 (same as other data sources)
config_main[0].append({"node": "GitHub Back PRs", "type": "main", "index": 0})
config_main[0].append({"node": "GitHub Front PRs", "type": "main", "index": 0})

# Add GitHub PRs -> Merge Reporte
wf['connections']['GitHub Back PRs'] = {"main": [[{"node": "Merge Reporte", "type": "main", "index": 0}]]}
wf['connections']['GitHub Front PRs'] = {"main": [[{"node": "Merge Reporte", "type": "main", "index": 0}]]}

# Add Build HTML + Binary -> IF Deuda Técnica
html_name = 'Build HTML + Binary'
if html_name not in wf['connections']:
    wf['connections'][html_name] = {"main": [[]]}
wf['connections'][html_name]['main'][0].append({"node": "IF Deuda Técnica", "type": "main", "index": 0})

# IF Deuda (output 0 = true) -> Build PM Request
wf['connections']['IF Deuda Técnica'] = {"main": [[{"node": "Build PM Request", "type": "main", "index": 0}], []]}

# Build PM Request -> Discord PM + PG
wf['connections']['Build PM Request'] = {"main": [[
    {"node": "Discord PM Debt Alert", "type": "main", "index": 0},
    {"node": "PG Guardar Solicitud Deuda", "type": "main", "index": 0}
]]}

# Fix renamed node reference: "Gemini Executive Summary" -> "Gemini Deep Analysis"
for node_name, conns in wf['connections'].items():
    if 'main' in conns:
        for outputs in conns['main']:
            for target in outputs:
                if target.get('node') == 'Gemini Executive Summary':
                    target['node'] = 'Gemini Deep Analysis'

# Also fix any node references in parameters
for node in wf['nodes']:
    params_str = json.dumps(node.get('parameters', {}))
    if 'Gemini Executive Summary' in params_str:
        params_str = params_str.replace('Gemini Executive Summary', 'Gemini Deep Analysis')
        node['parameters'] = json.loads(params_str)

# ============================================================
# 6. Save
# ============================================================
with open(WF_PATH, 'w') as f:
    json.dump(wf, f, indent=2, ensure_ascii=False)

print("✅ Workflow updated successfully!")
print(f"   - Added: GitHub Back PRs, GitHub Front PRs")
print(f"   - Added: IF Deuda Técnica, Build PM Request, Discord PM Debt Alert, PG Guardar Solicitud Deuda")
print(f"   - Updated: Build Report Data (enriched analysis)")
print(f"   - Updated: Gemini Executive Summary → Gemini Deep Analysis (JSON mode, 8192 tokens)")
print(f"   - Updated: Build HTML + Binary (STRATIUM format)")
print(f"   - Updated: Connections")
