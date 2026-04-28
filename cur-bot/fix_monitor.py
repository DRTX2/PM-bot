import json

with open("Monitor PetSafe.json", "r") as f:
    wf = json.load(f)

for node in wf["nodes"]:
    if node["name"] == "Gemini Análisis":
        node["type"] = "@n8n/n8n-nodes-langchain.chainLlm"
        node["typeVersion"] = 1.4
        node["parameters"] = {
            "promptType": "define",
            "text": "={{ $json.user_prompt }}",
            "options": {
                "systemMessage": "={{ $json.system_prompt }}"
            }
        }
    
    elif node["name"] == "Build Discord Payload":
        code = node["parameters"].get("jsCode", "")
        # Replace the old reference with the new one (.json.text instead of .json.candidates[0]...)
        code = code.replace("$node['Gemini Análisis'].json.candidates[0].content.parts[0].text", "$node['Gemini Análisis'].json.text")
        node["parameters"]["jsCode"] = code
        
    elif node["name"] == "Guardar Recomendación IA":
        query = node["parameters"].get("query", "")
        query = query.replace("$node[\"Gemini Análisis\"].json.candidates[0].content.parts[0].text", "$node[\"Gemini Análisis\"].json.text")
        node["parameters"]["query"] = query

# Fix connections
if "Google Gemini Model" in wf["connections"]:
    wf["connections"]["Google Gemini Model"] = {"ai_languageModel": [[{"node": "Gemini Análisis", "type": "ai_languageModel", "index": 0}]]}

with open("Monitor PetSafe.json", "w") as f:
    json.dump(wf, f, indent=2)

print("Monitor fixed")
