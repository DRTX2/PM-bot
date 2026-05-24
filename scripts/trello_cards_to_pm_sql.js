#!/usr/bin/env node

const fs = require('fs');

const [cardsPath, listsPath] = process.argv.slice(2);

if (!cardsPath || !listsPath) {
  console.error('Usage: trello_cards_to_pm_sql.js <cards.json> <lists.json>');
  process.exit(1);
}

const cards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
const lists = JSON.parse(fs.readFileSync(listsPath, 'utf8'));
const listById = new Map(lists.map((list) => [list.id, list.name]));

function q(value) {
  if (value === null || value === undefined || value === '') return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function dateOnly(value) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

function normalizeState(card, listName) {
  const list = String(listName || '').toLowerCase();
  if (card.dueComplete) return 'completada';
  if (list.includes('desarrollo')) return 'en_progreso';
  if (list.includes('seguimiento')) return 'en_revision';
  if (list.includes('cierre')) return 'pendiente';
  return 'pendiente';
}

function priorityFromLabels(labels) {
  const text = (labels || []).map((label) => `${label.name || ''} ${label.color || ''}`).join(' ').toLowerCase();
  if (/crit|urgent|rojo|red/.test(text)) return 'critica';
  if (/alta|high|orange/.test(text)) return 'alta';
  if (/baja|low|green/.test(text)) return 'baja';
  return 'media';
}

console.log('BEGIN;');
console.log('CREATE UNIQUE INDEX IF NOT EXISTS ux_pm_tareas_trello_card_id ON pm_tareas(trello_card_id) WHERE trello_card_id IS NOT NULL;');

for (const card of cards) {
  const listName = listById.get(card.idList) || 'Trello';
  const due = dateOnly(card.due);
  const state = normalizeState(card, listName);
  const priority = priorityFromLabels(card.labels);
  const responsible = (card.members || []).map((member) => member.fullName || member.username || member.initials).filter(Boolean).join(', ') || null;
  const description = [
    `Trello: ${card.shortUrl || ''}`.trim(),
    `Lista: ${listName}`,
    card.dueComplete ? 'Marcada como completada en Trello' : null,
  ].filter(Boolean).join('\n');
  const updatedAt = state === 'completada' && due ? `${q(due)}::date::timestamptz` : 'NOW()';

  console.log(`
INSERT INTO pm_tareas (
  titulo, descripcion, responsable, prioridad, estado, fecha_limite,
  entregable, sprint, canal_origen, creado_por, trello_card_id,
  fecha_creacion, fecha_actualizacion
) VALUES (
  ${q(card.name)}, ${q(description)}, ${q(responsible)}, ${q(priority)}, ${q(state)}, ${due ? `${q(due)}::date` : 'NULL'},
  ${q(listName)}, ${q(listName)}, 'trello', 'trello_sync', ${q(card.id)},
  NOW(), ${updatedAt}
)
ON CONFLICT (trello_card_id) WHERE trello_card_id IS NOT NULL
DO UPDATE SET
  titulo = EXCLUDED.titulo,
  descripcion = EXCLUDED.descripcion,
  responsable = EXCLUDED.responsable,
  prioridad = EXCLUDED.prioridad,
  estado = EXCLUDED.estado,
  fecha_limite = EXCLUDED.fecha_limite,
  entregable = EXCLUDED.entregable,
  sprint = EXCLUDED.sprint,
  canal_origen = EXCLUDED.canal_origen,
  creado_por = EXCLUDED.creado_por,
  fecha_actualizacion = EXCLUDED.fecha_actualizacion;
`);
}

console.log('COMMIT;');
