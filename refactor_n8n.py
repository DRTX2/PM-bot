import os
import json
import glob
import re

BOT_DIR = '/home/david/Desktop/personal/docker-programs/n8n/bot'

def fix_postgres_interpolation(node):
    if node['type'] == 'n8n-nodes-base.postgres' and node['parameters'].get('operation') == 'executeQuery':
        query = node['parameters'].get('query', '')
        if '{{' in query:
            # Replaces '{{ ... }}' with $1, $2, etc.
            matches = re.findall(r"'{{(.*?)}}'", query)
            params = []
            new_query = query
            i = 1
            for m in matches:
                new_query = new_query.replace(f"'{{{{{m}}}}}'", f"${i}")
                expr = m.strip()
                # Clean up .replace(/'/g, "''") since it's not needed for parameterized
                expr = re.sub(r'\.replace\([^\)]+\)', '', expr)
                params.append(f"={{{{{expr}}}}}")
                i += 1
            
            # also handle unquoted {{ ... }}::jsonb
            matches2 = re.findall(r"{{(.*?)}}", new_query)
            for m in matches2:
                new_query = new_query.replace(f"{{{{{m}}}}}", f"${i}")
                expr = m.strip()
                expr = re.sub(r'\.replace\([^\)]+\)', '', expr)
                params.append(f"={{{{{expr}}}}}")
                i += 1
                
            node['parameters']['query'] = new_query
            if 'options' not in node['parameters']:
                node['parameters']['options'] = {}
            if params:
                node['parameters']['options']['queryParameters'] = ",".join(params)

def process_workflow(filepath):
    with open(filepath, 'r') as f:
        try:
            wf = json.load(f)
        except json.JSONDecodeError:
            return

    # 4. Observabilidad: Add Error Workflow
    if 'settings' not in wf:
        wf['settings'] = {}
    wf['settings']['errorWorkflow'] = 'monitor-petsafe-error-handler'
    
    nodes = wf.get('nodes', [])
    for node in nodes:
        # 5. SQL fragil
        fix_postgres_interpolation(node)
        
        # 1. Integraciones GitHub/Trello
        if node['name'] == 'GitHub Event Webhook1' and node['type'] == 'n8n-nodes-base.webhook':
            node['type'] = 'n8n-nodes-base.githubTrigger'
            node['typeVersion'] = 1
            node['parameters'] = {
                "events": ["*"],
                "owner": "={{ $env.GITHUB_OWNER }}",
                "repository": "={{ $env.GITHUB_REPO }}"
            }
            if 'webhookId' in node:
                del node['webhookId']
        
        if node['name'] == 'Trello Event Webhook' and node['type'] == 'n8n-nodes-base.webhook':
            node['type'] = 'n8n-nodes-base.trelloTrigger'
            node['typeVersion'] = 1
            node['parameters'] = {
                "modelId": "={{ $env.TRELLO_BOARD_ID }}"
            }
            if 'webhookId' in node:
                del node['webhookId']

    with open(filepath, 'w') as f:
        json.dump(wf, f, indent=2)
        
for file in glob.glob(os.path.join(BOT_DIR, '*.json')):
    if os.path.basename(file) == 'Monitor PetSafe - Error Handler.json':
        continue
    process_workflow(file)

# 2. Configuracion duplicada
config_wf = {
  "name": "System - Config Resolver",
  "nodes": [
    {
      "parameters": {},
      "id": "trigger",
      "name": "On Execute",
      "type": "n8n-nodes-base.executeWorkflowTrigger",
      "typeVersion": 1,
      "position": [0, 0]
    },
    {
      "parameters": {
        "values": {
          "string": [
            {
              "name": "GITHUB_OWNER",
              "value": "={{ $env.GITHUB_OWNER }}"
            },
            {
              "name": "GITHUB_REPO",
              "value": "={{ $env.GITHUB_REPO }}"
            },
            {
              "name": "TRELLO_BOARD_ID",
              "value": "={{ $env.TRELLO_BOARD_ID }}"
            }
          ]
        },
        "options": {}
      },
      "id": "config",
      "name": "Set Config",
      "type": "n8n-nodes-base.set",
      "typeVersion": 1,
      "position": [200, 0]
    }
  ],
  "pinData": {},
  "connections": {
    "On Execute": {
      "main": [
        [
          {
            "node": "Set Config",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "active": True,
  "settings": {
    "errorWorkflow": "monitor-petsafe-error-handler"
  },
  "id": "system-config-resolver"
}
with open(os.path.join(BOT_DIR, 'System - Config Resolver.json'), 'w') as f:
    json.dump(config_wf, f, indent=2)

print("Migration completed.")
