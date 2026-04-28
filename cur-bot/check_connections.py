import json

def check(file):
    print(f"--- {file} ---")
    with open(file, "r") as f:
        wf = json.load(f)
        
    for name, targets in wf.get("connections", {}).items():
        if "Gemini" in name or "AI" in name or "Redis" in name or "Calculator" in name or name == "Construir Contexto" or name == "Llamada a Gemini" or name == "Preparar Prompt":
            print(f"{name}: {targets}")

check("Chat Discord PetSafe.json")
check("Monitor PetSafe.json")
