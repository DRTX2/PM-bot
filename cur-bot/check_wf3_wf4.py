import json
import glob

def check_wf(filename):
    print(f'=== {filename} ===')
    try:
        with open(filename) as f:
            wf = json.load(f)
            print(f"Nodes: {len(wf['nodes'])}")
            
            # Find issues mentioned in the MD
            if "Delta Detector" in filename:
                for n in wf['nodes']:
                    if n['name'] == 'Normalizar Evento Trello':
                        print('Trello Normalizer code preview:', n['parameters'].get('jsCode', '')[:100].replace('\n', ' '))
            
            if "Reporte" in filename:
                conns = wf['connections']
                # Check for dead links
                all_nodes = {n['name'] for n in wf['nodes']}
                for src, branches in conns.items():
                    for branch in branches.get("main", []):
                        for e in branch:
                            if e["node"] not in all_nodes:
                                print(f"DEAD LINK: {src} -> {e['node']}")
    except Exception as e:
        print(e)

for f in glob.glob("*Delta*.json") + glob.glob("*Reporte*.json"):
    check_wf(f)
