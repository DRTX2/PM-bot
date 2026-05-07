import yaml

with open('docker-compose.yml', 'r') as f:
    data = yaml.safe_load(f)

# Remove the postgres DB env vars from n8n to revert to SQLite
if 'n8n' in data['services']:
    env = data['services']['n8n'].get('environment', [])
    new_env = []
    if isinstance(env, list):
        for e in env:
            if not e.startswith('DB_'):
                new_env.append(e)
    elif isinstance(env, dict):
        new_env = {k: v for k, v in env.items() if not k.startswith('DB_')}
    
    if new_env:
        data['services']['n8n']['environment'] = new_env
    else:
        if 'environment' in data['services']['n8n']:
            del data['services']['n8n']['environment']

with open('docker-compose.yml', 'w') as f:
    yaml.dump(data, f, sort_keys=False)

