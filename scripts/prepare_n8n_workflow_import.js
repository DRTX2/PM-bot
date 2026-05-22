const fs = require('fs');
const path = require('path');

const sourceDir = process.argv[2] || '/workflows/import';
const outputDir = process.argv[3] || '/tmp/n8n-workflows-import';
const groupingMode = process.env.N8N_WORKFLOW_GROUPING_MODE || 'prefix';

const GROUPS = new Map([
  ['1. 🧠 AI Intelligence (Agentes Especializados)', { tag: '01 AI Intelligence', prefix: '01 AI' }],
  ['2. ⚙️ Core System (Infraestructura y Ruteo)', { tag: '02 Core System', prefix: '02 Core' }],
  ['3. 💬 Communication & Events (Canales de Entrada o Salida)', { tag: '03 Communication & Events', prefix: '03 Events' }],
  ['4. 🛠️ Monitoring & Reliability (Salud del Sistema)', { tag: '04 Monitoring & Reliability', prefix: '04 Monitor' }],
  ['5. 📊 PMO & Reporting (Gestion y Seguimiento)', { tag: '05 PMO & Reporting', prefix: '05 PMO' }],
]);

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    if (entry.isFile() && entry.name.endsWith('.json')) return [fullPath];
    return [];
  });
}

function tag(name) {
  const id = `tag-${name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)}`;

  return {
    id,
    name,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

function uniqueTags(tags) {
  const seen = new Set();
  const result = [];

  for (const current of tags) {
    const name = typeof current === 'string' ? current : current?.name;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    result.push(tag(name));
  }

  return result;
}

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

const files = walk(sourceDir);

for (const file of files) {
  const workflow = JSON.parse(fs.readFileSync(file, 'utf8'));
  const relative = path.relative(sourceDir, file);
  const [groupFolder] = relative.split(path.sep);
  const group = GROUPS.get(groupFolder) || { tag: groupFolder, prefix: groupFolder };
  const isPmWorkflow = /^WF_PM_|PMO -|Dashboard - PM|System - PM/.test(workflow.name || '');

  if (groupingMode === 'tags') {
    workflow.tags = uniqueTags([
      ...(workflow.tags || []),
      'PetSafe',
      group.tag,
      ...(isPmWorkflow ? ['PM Bot'] : []),
    ]);
  } else {
    const cleanName = String(workflow.name || path.basename(file, '.json')).replace(/^\d{2}\s+[^|]+\|\s+/, '');
    workflow.name = `${group.prefix} | ${cleanName}`;
  }

  const safeName = path.basename(file);
  fs.writeFileSync(path.join(outputDir, safeName), `${JSON.stringify(workflow, null, 2)}\n`);
}

console.log(`Prepared ${files.length} workflows with ${groupingMode} grouping in ${outputDir}`);
