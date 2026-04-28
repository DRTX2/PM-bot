import json

with open("Chat Discord PetSafe.json", "r") as f:
    chat_wf = json.load(f)

# Add Calculator Tool
calc_tool = {
    "parameters": {},
    "id": "calc-tool-1234",
    "name": "Calculator",
    "type": "@n8n/n8n-nodes-langchain.toolCalculator",
    "typeVersion": 1,
    "position": [2800, 4304]
}
chat_wf["nodes"].append(calc_tool)

# Connect to Gemini Chat (AI Agent)
if "Calculator" not in chat_wf["connections"]:
    chat_wf["connections"]["Calculator"] = {"ai_tool": [[{"node": "Gemini Chat", "type": "ai_tool", "index": 0}]]}

with open("Chat Discord PetSafe.json", "w") as f:
    json.dump(chat_wf, f, indent=2)

print("Tool added")
