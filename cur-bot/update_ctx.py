import json

with open("Chat Discord PetSafe.json") as f:
    wf = json.load(f)

for n in wf['nodes']:
    if n['name'] == 'Construir Contexto':
        code = n['parameters']['jsCode']
        
        # Insert tareas_resumen
        new_tareas = """  tareas: {
    total: tareas.length,
    vencidas,
    por_vencer_3dias: porVencer,
    completadas_count: tareas.filter(t => t.completada).length,
    recientes_completadas: tareas.filter(t => t.completada).slice(0, 15).map(t => t.nombre),
    resumen_todas: tareas.map(t => ({n: t.nombre, l: t.lista, c: t.completada ? 1 : 0})),
    distribucion: tareas.reduce((acc, t) => {"""
        
        code = code.replace("""  tareas: {
    total: tareas.length,
    vencidas,
    por_vencer_3dias: porVencer,
    completadas_count: tareas.filter(t => t.completada).length,
    distribucion: tareas.reduce((acc, t) => {""", new_tareas)
        
        n['parameters']['jsCode'] = code

with open("Chat Discord PetSafe.json", "w") as f:
    json.dump(wf, f, indent=2, ensure_ascii=False)

print("Context updated to include task names.")
