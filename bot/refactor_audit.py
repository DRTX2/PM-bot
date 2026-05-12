import json
import uuid

def add_audit_node(filepath, prev_nodes, status="success"):
    with open(filepath, "r") as f:
        data = json.load(f)

    nodes = data.get("nodes", [])
    connections = data.get("connections", {})

    # Generate a unique ID for the node
    node_id = str(uuid.uuid4())
    node_name = "Audit Log " + status.capitalize()

    # Create the Postgres node
    if status == "error":
        # In the error workflow, we want to extract error explicitly
        query = "INSERT INTO workflow_runs_audit (workflow_id, workflow_name, status, completed_at, error_details) VALUES ($1, $2, $3, NOW(), $4::jsonb);"
        replacement = "={{ [ $workflow.id || 'unknown', $workflow.name, 'error', JSON.stringify({ node: $json.error?.node?.name || $json.node?.name, message: $json.error?.message || $json.message }) ] }}"
    else:
        query = "INSERT INTO workflow_runs_audit (workflow_id, workflow_name, status, completed_at, correlation_id) VALUES ($1, $2, $3, NOW(), $4);"
        replacement = "={{ [ $workflow.id || 'unknown', $workflow.name, 'success', $json.correlation_id || null ] }}"

    pg_node = {
        "parameters": {
            "operation": "executeQuery",
            "query": query,
            "options": {
                "queryReplacement": replacement
            }
        },
        "id": node_id,
        "name": node_name,
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2.5,
        "position": [ 2000, 0 ] # just a mock position
    }

    nodes.append(pg_node)

    for prev_name in prev_nodes:
        if prev_name not in connections:
            connections[prev_name] = {"main": [[]]}
        if len(connections[prev_name]["main"]) == 0:
            connections[prev_name]["main"].append([])
        connections[prev_name]["main"][0].append({
            "node": node_name,
            "type": "main",
            "index": 0
        })

    data["nodes"] = nodes
    data["connections"] = connections

    with open(filepath, "w") as f:
        json.dump(data, f, indent=2)

add_audit_node("bot/Monitor PetSafe - Error Handler.json", ["Alerta a Discord"], "error")
