const fs = require('fs');
const files = fs.readdirSync('bot').filter(f => f.endsWith('.json'));

files.forEach(file => {
  if (file.includes('System') || file.includes('Router')) return;
  const data = JSON.parse(fs.readFileSync('bot/' + file, 'utf8'));
  const nodes = data.nodes ? data.nodes.map(n => n.name) : [];
  const connections = data.connections || {};
  const outgoing = new Set();
  Object.keys(connections).forEach(source => {
    if (nodes.includes(source)) {
      const targets = connections[source].main || [];
      targets.forEach(branch => {
        if (branch && branch.length > 0) outgoing.add(source);
      });
    }
  });
  const endNodes = nodes.filter(n => !outgoing.has(n));
  console.log(file, 'End nodes:', endNodes);
});
