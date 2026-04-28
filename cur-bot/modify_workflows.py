import json

with open("Chat Discord PetSafe.json", "r") as f:
    chat_wf = json.load(f)

# 1. Modify Construir Contexto
for node in chat_wf["nodes"]:
    if node["name"] == "Construir Contexto":
        code = node["parameters"]["jsCode"]
        # Replace the prompt generation
        old_prompt_code = "`Eres asistente experto"
        code = code.replace("const prompt = `Eres asistente experto", "const system_prompt = `Eres asistente experto")
        code = code.replace("\\n\\nPREGUNTA DE ${usuario}:\\n${pregunta || 'Pregunta no disponible'}`;", "`;\nconst user_prompt = pregunta || 'Pregunta no disponible';")
        code = code.replace("prompt,", "system_prompt, user_prompt,")
        node["parameters"]["jsCode"] = code

    elif node["name"] == "Gemini Chat":
        # Convert to AI Agent
        node["type"] = "@n8n/n8n-nodes-langchain.agent"
        node["typeVersion"] = 1.7
        node["parameters"] = {
            "promptType": "define",
            "text": "={{ $json.user_prompt }}",
            "options": {
                "systemMessage": "={{ $json.system_prompt }}"
            }
        }
    
    elif node["name"] == "Guardar Q&A":
        query = node["parameters"]["query"]
        query = query.replace("$node[\"Gemini Chat\"].json.candidates?.[0]?.content?.parts?.[0]?.text", "$node[\"Gemini Chat\"].json.output")
        node["parameters"]["query"] = query
        
    elif node["name"] == "Resp Chat":
        node["parameters"]["responseBody"] = "={{ $node['Gemini Chat'].json.output || '(respuesta vacia o bloqueada por seguridad)' }}"

# Add the AI sub-nodes
new_nodes = [
    {
        "parameters": {
            "modelName": "models/gemini-1.5-pro",
            "options": {
                "temperature": 0.3
            }
        },
        "id": "gemini-model-1234",
        "name": "Google Gemini Chat Model",
        "type": "@n8n/n8n-nodes-langchain.lmChatGoogleGemini",
        "typeVersion": 1,
        "position": [2640, 4504],
        "credentials": {
            "googlePalmApi": {
                "id": "aFcqI71CduhYfRTh",
                "name": "Google Gemini(PaLM) Api account"
            }
        }
    },
    {
        "parameters": {
            "sessionIdType": "customKey",
            "sessionKey": "={{ $json.usuario }}",
            "sessionTTL": 60
        },
        "id": "redis-memory-1234",
        "name": "Redis Chat Memory",
        "type": "@n8n/n8n-nodes-langchain.memoryRedisChat",
        "typeVersion": 1.5,
        "position": [2800, 4504],
        "credentials": {
            "redis": {
                "id": "jAyEo3o5v0RaQJoI",
                "name": "Redis account"
            }
        }
    }
]
chat_wf["nodes"].extend(new_nodes)

# Connect them to Gemini Chat (the AI Agent)
if "Google Gemini Chat Model" not in chat_wf["connections"]:
    chat_wf["connections"]["Google Gemini Chat Model"] = {"ai_languageModel": [[{"node": "Gemini Chat", "type": "ai_languageModel", "index": 0}]]}
if "Redis Chat Memory" not in chat_wf["connections"]:
    chat_wf["connections"]["Redis Chat Memory"] = {"ai_memory": [[{"node": "Gemini Chat", "type": "ai_memory", "index": 0}]]}

with open("Chat Discord PetSafe.json", "w") as f:
    json.dump(chat_wf, f, indent=2)

with open("Monitor PetSafe.json", "r") as f:
    mon_wf = json.load(f)

# Do the same for Monitor PetSafe
for node in mon_wf["nodes"]:
    if node["name"] == "Preparar Prompt":
        code = node["parameters"]["jsCode"]
        code = code.replace("const prompt = `", "const system_prompt = `")
        code = code.replace("`;\n\nreturn", "`;\nconst user_prompt = \"Por favor, evalúa el estado del proyecto según los datos provistos.\";\nreturn")
        code = code.replace("prompt:", "system_prompt, user_prompt,")
        node["parameters"]["jsCode"] = code
        
    elif node["name"] == "Llamada a Gemini":
        node["type"] = "@n8n/n8n-nodes-langchain.chainLlm"
        node["typeVersion"] = 1.4
        node["parameters"] = {
            "promptType": "define",
            "text": "={{ $json.user_prompt }}",
            "options": {
                "systemMessage": "={{ $json.system_prompt }}"
            }
        }
        
    elif node["name"] == "Construir Embed":
        code = node["parameters"]["jsCode"]
        code = code.replace("$node['Llamada a Gemini'].json.candidates[0].content.parts[0].text", "$node['Llamada a Gemini'].json.text")
        node["parameters"]["jsCode"] = code

new_mon_nodes = [
    {
        "parameters": {
            "modelName": "models/gemini-1.5-pro",
            "options": {
                "temperature": 0.2
            }
        },
        "id": "gemini-model-mon",
        "name": "Google Gemini Model",
        "type": "@n8n/n8n-nodes-langchain.lmChatGoogleGemini",
        "typeVersion": 1,
        "position": [700, 300],
        "credentials": {
            "googlePalmApi": {
                "id": "aFcqI71CduhYfRTh",
                "name": "Google Gemini(PaLM) Api account"
            }
        }
    }
]
mon_wf["nodes"].extend(new_mon_nodes)

if "Google Gemini Model" not in mon_wf["connections"]:
    mon_wf["connections"]["Google Gemini Model"] = {"ai_languageModel": [[{"node": "Llamada a Gemini", "type": "ai_languageModel", "index": 0}]]}

with open("Monitor PetSafe.json", "w") as f:
    json.dump(mon_wf, f, indent=2)

print("Done")
