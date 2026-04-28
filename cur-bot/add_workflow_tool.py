import json, uuid

def uid(): return str(uuid.uuid4())

with open("Chat Discord PetSafe.json") as f:
    wf = json.load(f)

tool_node = {
    "parameters": {
        "name": "crear_tarjeta_trello",
        "description": "Crea una nueva tarjeta en Trello. Recibe: nombre (título de la tarea), descripcion, lista (ej. Pendientes, En Progreso) y miembro (a quien asignar).",
        "workflowId": {
            "value": "tool-crear-tarjeta",
            "mode": "id"
        },
        "workflowInputs": {
            "mappingMode": "defineBelow",
            "value": {
                "nombre": "={{ $fromAI('nombre') }}",
                "descripcion": "={{ $fromAI('descripcion') }}",
                "lista": "={{ $fromAI('lista') }}",
                "miembro": "={{ $fromAI('miembro') }}"
            }
        },
        "options": {}
    },
    "id": uid(),
    "name": "Tool Workflow Crear Tarjeta",
    "type": "@n8n/n8n-nodes-langchain.toolWorkflow",
    "typeVersion": 1,
    "position": [2920, 4560]
}

wf["nodes"].append(tool_node)
wf["connections"]["Tool Workflow Crear Tarjeta"] = {"ai_tool": [[{"node": "Gemini Chat", "type": "ai_tool", "index": 0}]]}

with open("Chat Discord PetSafe.json", "w") as f:
    json.dump(wf, f, indent=2, ensure_ascii=False)

print("Tool added.")
