import json
with open('Chat Discord PetSafe.json') as f:
    wf = json.load(f)
for n in wf['nodes']:
    if n['name'] == 'Construir Contexto':
        code = n['parameters']['jsCode']
        idx = code.find('const ctx = {')
        idx2 = code.find('const system_prompt =')
        print(code[idx:idx2])
