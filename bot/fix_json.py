import json

def fix(filename):
    with open(filename, "r") as f:
        content = f.read()
    try:
        json.loads(content)
        print(f"{filename} is valid.")
    except json.JSONDecodeError as e:
        print(f"Error in {filename}: {e}")

fix("System - AI Decision Logger.json")
fix("AI - PM Orchestrator.json")
