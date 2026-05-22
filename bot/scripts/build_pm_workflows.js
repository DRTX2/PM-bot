const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const coreDir = path.join(root, '2. ⚙️ Core System (Infraestructura y Ruteo)');
const pmoDir = path.join(root, '5. 📊 PMO & Reporting (Gestion y Seguimiento)');

const pgCreds = {
  postgres: {
    id: 'upx1y0H6Nw7XOqLJ',
    name: 'Postgres account',
  },
};

function code(fn) {
  const source = fn.toString();
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('Missing embedded code body');
  return source.slice(start + 1, end).replace(/^\n/, '').replace(/\n$/, '');
}

const settings = {
  executionOrder: 'v1',
  binaryMode: 'separate',
  errorWorkflow: 'wf-pm-error-handler',
};

function node(id, name, type, typeVersion, position, parameters = {}, extra = {}) {
  return { id, name, type, typeVersion, position, parameters, ...extra };
}

function workflow(id, name, nodes, connections, active = true) {
  return {
    id,
    name,
    active,
    nodes,
    connections,
    settings,
    pinData: {},
    tags: [],
    meta: {
      templateCredsSetupCompleted: true,
      instanceId: '2ea39fa17dcdc4ec838b704e984f07415fea66105c8eb910cc7de85c3d5eeea5',
    },
  };
}

function writeWorkflow(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

const pgNode = (id, name, pos, query, options = {}) =>
  node(id, name, 'n8n-nodes-base.postgres', 2.5, pos, {
    operation: 'executeQuery',
    query,
    options,
  }, { credentials: pgCreds });

const execNode = (id, name, pos, workflowId, cachedResultName) =>
  node(id, name, 'n8n-nodes-base.executeWorkflow', 1.1, pos, {
    workflowId: {
      __rl: true,
      value: workflowId,
      mode: 'id',
      cachedResultName,
    },
    options: {},
  });

const mergeNode = (id, name, pos, numberInputs) =>
  node(id, name, 'n8n-nodes-base.merge', 3, pos, { numberInputs });

const trigger = node('trigger', 'Execute Workflow Trigger', 'n8n-nodes-base.executeWorkflowTrigger', 1, [0, 0]);

const classifyIntentCode = code(function(){
const input = $json || {};
const env = process.env || {};
const msg = String(input.message || input.pregunta || input.content || input.mensaje_original || '').trim();
const low = msg.toLowerCase();
const user = input.user || input.usuario || input.actor || input.username || 'desconocido';
const userId = input.user_id || input.author_id || '';
const channel = String(input.channel_id || input.channelId || input.canal || '');
const channelName = input.channel_name || input.channelName || '';

const channelVars = {
  tareas: 'DISCORD_CHANNEL_TAREAS',
  bloqueos: 'DISCORD_CHANNEL_BLOQUEOS',
  reportes: 'DISCORD_CHANNEL_REPORTES',
  reuniones: 'DISCORD_CHANNEL_REUNIONES',
  entregables: 'DISCORD_CHANNEL_ENTREGABLES',
  riesgos: 'DISCORD_CHANNEL_RIESGOS',
  avances: 'DISCORD_CHANNEL_AVANCES',
  bot_log: 'DISCORD_CHANNEL_BOT_LOG',
  admin: 'DISCORD_CHANNEL_ADMIN',
};
const missing_config = Object.values(channelVars).filter((key) => !env[key]);
const channels = Object.fromEntries(Object.entries(channelVars).map(([k, v]) => [k, env[v] || '']));

const isCommand = /^\/pm(\s|$)/i.test(msg);
const cmdText = isCommand ? msg.replace(/^\/pm\s*/i, '').trim() : '';
const cmdParts = cmdText.split(/\s+/).filter(Boolean);
const cmd = (cmdParts[0] || '').toLowerCase();
const sub = (cmdParts[1] || '').toLowerCase();
const rest = cmdParts.slice(2).join(' ');

function clean(s) { return String(s || '').trim(); }
function match(rx) { const m = msg.match(rx); return m ? clean(m[1]) : null; }
function normalizePriority(value) {
  const v = clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (['baja','media','alta','critica'].includes(v)) return v;
  return null;
}
function normalizeState(value) {
  const v = clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
  const map = { progreso: 'en_progreso', revision: 'en_revision', revisada: 'en_revision', hecho: 'completada', terminada: 'completada', terminado: 'completada' };
  return ['pendiente','en_progreso','bloqueada','en_revision','completada','cancelada'].includes(v) ? v : (map[v] || null);
}
function parseDate(value) {
  const v = clean(value).toLowerCase();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date();
  if (v.includes('hoy')) return d.toISOString().slice(0, 10);
  if (v.includes('manana') || v.includes('mañana')) {
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  const days = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, miércoles: 3, jueves: 4, viernes: 5, sabado: 6, sábado: 6 };
  if (days[v] !== undefined) {
    const diff = (days[v] + 7 - d.getDay()) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

let intencion = 'desconocido';
let sub_intencion = null;
let datos = {};
let canal_destino = 'DISCORD_CHANNEL_REPORTES';

if (isCommand) {
  switch (cmd) {
    case '':
    case 'ayuda':
    case 'help':
      intencion = 'ayuda';
      break;
    case 'estado':
      intencion = 'estado_proyecto';
      sub_intencion = sub || 'general';
      break;
    case 'tarea':
      intencion = 'tarea';
      sub_intencion = sub || 'listar';
      datos.texto = rest || cmdParts.slice(1).join(' ');
      canal_destino = 'DISCORD_CHANNEL_TAREAS';
      break;
    case 'avance':
      intencion = 'avance';
      sub_intencion = sub || 'registrar';
      datos.texto = rest;
      canal_destino = 'DISCORD_CHANNEL_AVANCES';
      break;
    case 'bloqueo':
      intencion = 'bloqueo';
      sub_intencion = sub || 'registrar';
      datos.texto = rest;
      canal_destino = 'DISCORD_CHANNEL_BLOQUEOS';
      break;
    case 'riesgo':
      intencion = 'riesgo';
      sub_intencion = sub || 'registrar';
      datos.texto = rest;
      canal_destino = 'DISCORD_CHANNEL_RIESGOS';
      break;
    case 'reporte':
      intencion = 'reporte';
      sub_intencion = sub || 'diario';
      canal_destino = 'DISCORD_CHANNEL_REPORTES';
      break;
    case 'reunion':
    case 'reunión':
      intencion = 'reunion';
      sub_intencion = sub || 'preparar';
      datos.texto = rest || cmdParts.slice(1).join(' ');
      canal_destino = 'DISCORD_CHANNEL_REUNIONES';
      break;
    case 'decision':
    case 'decisión':
      intencion = 'decision';
      sub_intencion = sub || 'registrar';
      datos.texto = rest || cmdParts.slice(1).join(' ');
      canal_destino = 'DISCORD_CHANNEL_REUNIONES';
      break;
    case 'entregable':
      intencion = 'entregable';
      sub_intencion = sub || 'listar';
      datos.texto = rest || cmdParts.slice(1).join(' ');
      canal_destino = 'DISCORD_CHANNEL_ENTREGABLES';
      break;
    case 'pendientes':
      intencion = 'tarea';
      sub_intencion = 'pendientes';
      canal_destino = 'DISCORD_CHANNEL_TAREAS';
      break;
    case 'atrasos':
      intencion = 'tarea';
      sub_intencion = 'atrasos';
      canal_destino = 'DISCORD_CHANNEL_TAREAS';
      break;
    case 'sprint':
      intencion = 'estado_proyecto';
      sub_intencion = 'sprint';
      break;
    case 'retrospectiva':
    case 'retro':
      intencion = 'retrospectiva';
      sub_intencion = sub || 'registrar';
      datos.texto = rest || cmdParts.slice(1).join(' ');
      break;
    case 'recordatorio':
    case 'recordatorios':
      intencion = 'recordatorio';
      sub_intencion = sub || 'revisar';
      break;
    case 'admin':
      intencion = 'administracion';
      sub_intencion = sub || 'estado';
      datos.texto = rest;
      canal_destino = 'DISCORD_CHANNEL_ADMIN';
      break;
    default:
      intencion = 'desconocido';
  }
} else if (/crea(r)? (una )?tarea|nueva tarea|registra(r)? tarea|agregar tarea/i.test(low)) {
  intencion = 'tarea'; sub_intencion = 'crear'; canal_destino = 'DISCORD_CHANNEL_TAREAS';
} else if (/asigna(r)?\s|asignale|asígnale/i.test(low)) {
  intencion = 'tarea'; sub_intencion = 'asignar'; canal_destino = 'DISCORD_CHANNEL_TAREAS';
} else if (/tareas? (pendiente|atrasad|vencid)|pendientes|atrasos/i.test(low)) {
  intencion = 'tarea'; sub_intencion = /atrasad|vencid|atrasos/i.test(low) ? 'atrasos' : 'pendientes'; canal_destino = 'DISCORD_CHANNEL_TAREAS';
} else if (/registr(ar|a) avance|termin[eé]|complet[eé]|avance diario|progreso/i.test(low)) {
  intencion = 'avance'; sub_intencion = 'registrar'; canal_destino = 'DISCORD_CHANNEL_AVANCES';
} else if (/bloque(o|ado)|impedimento|no puedo avanzar|detenid|trabado|atascado/i.test(low)) {
  intencion = 'bloqueo'; sub_intencion = 'registrar'; canal_destino = 'DISCORD_CHANNEL_BLOQUEOS';
} else if (/riesgo|peligro|amenaza|podr[ií]a fallar/i.test(low)) {
  intencion = 'riesgo'; sub_intencion = 'registrar'; canal_destino = 'DISCORD_CHANNEL_RIESGOS';
} else if (/reporte (diario|semanal)|genera(r)? reporte|resumen (del|de la) semana|estado (del|general)/i.test(low)) {
  intencion = 'reporte'; sub_intencion = /semanal|semana/i.test(low) ? 'semanal' : 'diario'; canal_destino = 'DISCORD_CHANNEL_REPORTES';
} else if (/reuni[oó]n|prepara(r)? la reuni|agenda|acta|acuerdo|compromiso/i.test(low)) {
  intencion = 'reunion'; sub_intencion = /acta|acuerdo|compromiso/i.test(low) ? 'registrar_acta' : 'preparar'; canal_destino = 'DISCORD_CHANNEL_REUNIONES';
} else if (/decisi[oó]n|decidimos|usaremos|registra(r)? esta decisi/i.test(low)) {
  intencion = 'decision'; sub_intencion = 'registrar'; canal_destino = 'DISCORD_CHANNEL_REUNIONES';
} else if (/entregable|document(o|aci)|versi[oó]n|informe|prototipo|entregables falt/i.test(low)) {
  intencion = 'entregable'; sub_intencion = /registr|crear|agregar/i.test(low) ? 'registrar' : 'pendientes'; canal_destino = 'DISCORD_CHANNEL_ENTREGABLES';
} else if (/retrospectiva|retro|qu[eé] sali[oó] bien|qu[eé] mejorar|lecciones aprendidas/i.test(low)) {
  intencion = 'retrospectiva'; sub_intencion = 'registrar';
} else if (/estado (actual|del proyecto|de petsafe)|resume(n|me)|c[oó]mo va(mos)?|overview/i.test(low)) {
  intencion = 'estado_proyecto'; sub_intencion = 'general';
} else if (/ayuda|help|c[oó]mo (te uso|funciona)/i.test(low)) {
  intencion = 'ayuda';
}

datos.responsable = match(/(?:asigna(?:r|le)?\s+a\s+|responsable:?\s*|para\s+)(@[^\s]+|[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/);
datos.fecha_limite = parseDate(match(/(?:para|antes del?|fecha:?|limite:?|l[ií]mite:?)\s+(\d{4}-\d{2}-\d{2}|ma[nñ]ana|hoy|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)/i));
datos.prioridad = normalizePriority(match(/prioridad:?\s*(baja|media|alta|cr[ií]tica)/i));
datos.estado = normalizeState(match(/estado:?\s*([a-záéíóúñ_ ]+)/i));
datos.id = Number(match(/#?(\d+)/)) || null;
datos.porcentaje = Number(match(/(\d{1,3})\s*%/)) || null;
datos.probabilidad = match(/probabilidad:?\s*(baja|media|alta)/i);
datos.impacto = match(/impacto:?\s*(bajo|medio|alto|cr[ií]tico)/i);
datos.texto_original = msg;
datos.texto = datos.texto || msg;

if (intencion === 'administracion' && channels.admin && channel && channel !== channels.admin) {
  return [{ json: {
    intencion: 'administracion_denegada',
    sub_intencion: 'denegada',
    respuesta: 'No tengo permisos para ejecutar esta accion desde este canal. Usa #admin-bot o solicita autorizacion.',
    canal_destino: 'DISCORD_CHANNEL_ADMIN',
    canal_id: channels.admin,
    usuario: user,
    user_id: userId,
    canal_origen: channel,
    canal_nombre: channelName,
    mensaje_original: msg,
    datos,
    missing_config,
    channels,
    timestamp: new Date().toISOString()
  }}];
}

return [{ json: {
  intencion,
  sub_intencion,
  datos,
  canal_destino,
  canal_id: env[canal_destino] || channel || channels.reportes,
  usuario: user,
  user_id: userId,
  canal_origen: channel,
  canal_nombre: channelName,
  mensaje_original: msg,
  es_comando: isCommand,
  missing_config,
  channels,
  timestamp: new Date().toISOString()
}}];
});

const helpCode = code(function(){
const text = [
  '**PetSafe PM Bot - comandos disponibles**',
  '`/pm ayuda`',
  '`/pm estado`',
  '`/pm tarea crear [titulo] responsable: David limite: 2026-05-30 prioridad: alta`',
  '`/pm tarea listar`, `/pm pendientes`, `/pm atrasos`',
  '`/pm tarea actualizar #12 estado: en_progreso`',
  '`/pm tarea asignar #12 responsable: David`',
  '`/pm avance registrar #12 40% descripcion del avance`',
  '`/pm bloqueo registrar descripcion prioridad: alta`',
  '`/pm riesgo registrar descripcion probabilidad: alta impacto: critico`',
  '`/pm reporte diario`, `/pm reporte semanal`',
  '`/pm reunion preparar seguimiento sprint`',
  '`/pm decision registrar usaremos Contabo como VPS`',
  '`/pm entregable registrar Project Charter responsable: Joel limite: 2026-06-01`',
  '`/pm retrospectiva bien|mejorar|accion texto`',
  '`/pm admin estado` solo en #admin-bot',
  '',
  'Tambien entiendo lenguaje natural para crear tareas, registrar avances, bloqueos, riesgos, decisiones y reportes.'
].join('\n');
return [{ json: { respuesta: text, canal_destino: 'DISCORD_CHANNEL_REPORTES', canal_id: process.env.DISCORD_CHANNEL_REPORTES || $json.canal_origen } }];
});

const fallbackCode = code(function(){
return [{ json: {
  respuesta: 'No pude identificar completamente la accion. Puedes pedirme crear una tarea, registrar avance, reportar bloqueo, generar reporte o consultar pendientes.',
  canal_destino: 'DISCORD_CHANNEL_BOT_LOG',
  canal_id: process.env.DISCORD_CHANNEL_BOT_LOG || $json.canal_origen,
  intencion: $json.intencion || 'desconocido'
}}];
});

const passDeniedCode = code(function(){
return [{ json: { respuesta: $json.respuesta, canal_destino: $json.canal_destino, canal_id: $json.canal_id, intencion: $json.intencion } }];
});

const auditRouterQuery = `INSERT INTO pm_command_log (comando, intencion, usuario, canal, datos_extraidos, respuesta_bot, exito)
VALUES ($1, $2, $3, $4, $5::jsonb, $6, true)
RETURNING id;`;

const returnRouterCode = code(function(){
const result = $('Merge PM Results').item.json;
const missing = $('Classify Intent').item.json.missing_config || [];
let respuesta = result.respuesta || result.response || 'Accion PM ejecutada.';
if (missing.length) {
  respuesta += '\n\nAviso de configuracion: faltan variables en n8n: ' + missing.join(', ') + '.';
}
return [{ json: { ...result, respuesta } }];
});

const routerNodes = [
  trigger,
  node('classify', 'Classify Intent', 'n8n-nodes-base.code', 2, [240, 0], { jsCode: classifyIntentCode }),
  node('route', 'Route by Intent', 'n8n-nodes-base.switch', 3, [500, 0], {
    rules: { values: [
      { conditions: [{ value1: '={{ $json.intencion }}', operation: 'equal', value2: 'tarea' }], renameOutput: true, outputKey: 'tarea' },
      { conditions: [{ value1: '={{ $json.intencion }}', operation: 'equal', value2: 'avance' }], renameOutput: true, outputKey: 'avance' },
      { conditions: [{ value1: '={{ $json.intencion }}', operation: 'equal', value2: 'bloqueo' }], renameOutput: true, outputKey: 'bloqueo' },
      { conditions: [{ value1: '={{ $json.intencion }}', operation: 'equal', value2: 'riesgo' }], renameOutput: true, outputKey: 'riesgo' },
      { conditions: [{ value1: '={{ $json.intencion }}', operation: 'equal', value2: 'reporte' }], renameOutput: true, outputKey: 'reporte' },
      { conditions: [{ value1: '={{ $json.intencion }}', operation: 'equal', value2: 'reunion' }], renameOutput: true, outputKey: 'reunion' },
      { conditions: [{ value1: '={{ $json.intencion }}', operation: 'equal', value2: 'decision' }], renameOutput: true, outputKey: 'decision' },
      { conditions: [{ value1: '={{ $json.intencion }}', operation: 'equal', value2: 'entregable' }], renameOutput: true, outputKey: 'entregable' },
      { conditions: [{ value1: '={{ $json.intencion }}', operation: 'equal', value2: 'retrospectiva' }], renameOutput: true, outputKey: 'retrospectiva' },
      { conditions: [{ value1: '={{ $json.intencion }}', operation: 'equal', value2: 'estado_proyecto' }], renameOutput: true, outputKey: 'estado' },
      { conditions: [{ value1: '={{ $json.intencion }}', operation: 'equal', value2: 'recordatorio' }], renameOutput: true, outputKey: 'recordatorio' },
      { conditions: [{ value1: '={{ $json.intencion }}', operation: 'equal', value2: 'ayuda' }], renameOutput: true, outputKey: 'ayuda' },
      { conditions: [{ value1: '={{ $json.intencion }}', operation: 'equal', value2: 'administracion' }], renameOutput: true, outputKey: 'admin' },
      { conditions: [{ value1: '={{ $json.intencion }}', operation: 'equal', value2: 'administracion_denegada' }], renameOutput: true, outputKey: 'admin_denegada' },
    ] },
    options: { fallbackOutput: 'extra' },
  }),
  execNode('call-tareas', 'Call WF_PM_Tareas', [820, -420], 'wf-pm-tareas', 'WF_PM_Tareas'),
  execNode('call-avances', 'Call WF_PM_Avances', [820, -300], 'wf-pm-avances', 'WF_PM_Avances'),
  execNode('call-bloqueos', 'Call WF_PM_Bloqueos', [820, -180], 'wf-pm-bloqueos-riesgos', 'WF_PM_Bloqueos_Riesgos'),
  execNode('call-riesgos', 'Call WF_PM_Riesgos', [820, -60], 'wf-pm-bloqueos-riesgos', 'WF_PM_Bloqueos_Riesgos'),
  execNode('call-reportes', 'Call WF_PM_Reportes', [820, 60], 'wf-pm-reportes', 'WF_PM_Reportes'),
  execNode('call-reuniones', 'Call WF_PM_Reuniones', [820, 180], 'wf-pm-reuniones', 'WF_PM_Reuniones'),
  execNode('call-decisiones', 'Call WF_PM_Decisiones', [820, 300], 'wf-pm-decisiones', 'WF_PM_Decisiones'),
  execNode('call-entregables', 'Call WF_PM_Entregables', [820, 420], 'wf-pm-entregables', 'WF_PM_Entregables'),
  execNode('call-retro', 'Call WF_PM_Retrospectiva', [820, 540], 'wf-pm-retrospectiva', 'WF_PM_Retrospectiva'),
  execNode('call-estado', 'Call WF_PM_Estado', [820, 660], 'wf-pm-reportes', 'WF_PM_Reportes'),
  execNode('call-recordatorios', 'Call WF_PM_Recordatorios', [820, 780], 'wf-pm-recordatorios', 'WF_PM_Recordatorios'),
  node('help', 'Format PM Help', 'n8n-nodes-base.code', 2, [820, 900], { jsCode: helpCode }),
  execNode('call-admin', 'Call WF_PM_Admin', [820, 1020], 'wf-pm-admin', 'WF_PM_Admin'),
  node('admin-denied', 'Admin Denied Response', 'n8n-nodes-base.code', 2, [820, 1140], { jsCode: passDeniedCode }),
  node('fallback', 'Unknown Intent Response', 'n8n-nodes-base.code', 2, [820, 1260], { jsCode: fallbackCode }),
  mergeNode('merge-results', 'Merge PM Results', [1120, 360], 15),
  pgNode('audit-router', 'Audit PM Command', [1360, 360], auditRouterQuery, {
    queryReplacement: '={{ [ $("Classify Intent").item.json.mensaje_original, $("Classify Intent").item.json.intencion, $("Classify Intent").item.json.usuario, $("Classify Intent").item.json.canal_origen, JSON.stringify($("Classify Intent").item.json.datos || {}), $("Merge PM Results").item.json.respuesta || "" ] }}',
  }),
  node('return-response', 'Return PM Response', 'n8n-nodes-base.code', 2, [1580, 360], { jsCode: returnRouterCode }),
];

const routerConnections = {
  'Execute Workflow Trigger': { main: [[{ node: 'Classify Intent', type: 'main', index: 0 }]] },
  'Classify Intent': { main: [[{ node: 'Route by Intent', type: 'main', index: 0 }]] },
  'Route by Intent': { main: [
    [{ node: 'Call WF_PM_Tareas', type: 'main', index: 0 }],
    [{ node: 'Call WF_PM_Avances', type: 'main', index: 0 }],
    [{ node: 'Call WF_PM_Bloqueos', type: 'main', index: 0 }],
    [{ node: 'Call WF_PM_Riesgos', type: 'main', index: 0 }],
    [{ node: 'Call WF_PM_Reportes', type: 'main', index: 0 }],
    [{ node: 'Call WF_PM_Reuniones', type: 'main', index: 0 }],
    [{ node: 'Call WF_PM_Decisiones', type: 'main', index: 0 }],
    [{ node: 'Call WF_PM_Entregables', type: 'main', index: 0 }],
    [{ node: 'Call WF_PM_Retrospectiva', type: 'main', index: 0 }],
    [{ node: 'Call WF_PM_Estado', type: 'main', index: 0 }],
    [{ node: 'Call WF_PM_Recordatorios', type: 'main', index: 0 }],
    [{ node: 'Format PM Help', type: 'main', index: 0 }],
    [{ node: 'Call WF_PM_Admin', type: 'main', index: 0 }],
    [{ node: 'Admin Denied Response', type: 'main', index: 0 }],
    [{ node: 'Unknown Intent Response', type: 'main', index: 0 }],
  ] },
};
[
  'Call WF_PM_Tareas','Call WF_PM_Avances','Call WF_PM_Bloqueos','Call WF_PM_Riesgos','Call WF_PM_Reportes',
  'Call WF_PM_Reuniones','Call WF_PM_Decisiones','Call WF_PM_Entregables','Call WF_PM_Retrospectiva',
  'Call WF_PM_Estado','Call WF_PM_Recordatorios','Format PM Help','Call WF_PM_Admin','Admin Denied Response','Unknown Intent Response',
].forEach((name, idx) => {
  routerConnections[name] = { main: [[{ node: 'Merge PM Results', type: 'main', index: idx }]] };
});
routerConnections['Merge PM Results'] = { main: [[{ node: 'Audit PM Command', type: 'main', index: 0 }]] };
routerConnections['Audit PM Command'] = { main: [[{ node: 'Return PM Response', type: 'main', index: 0 }]] };

writeWorkflow(
  path.join(coreDir, 'WF_PM_Router_Intenciones.json'),
  workflow('wf-pm-router-intenciones', 'WF_PM_Router_Intenciones', routerNodes, routerConnections),
);

const taskBuildCode = code(function(){
const ctx = $json;
const datos = ctx.datos || {};
const raw = String(datos.texto || datos.texto_original || ctx.mensaje_original || '');
const sub = String(ctx.sub_intencion || 'listar').toLowerCase();
const q = (v) => v === null || v === undefined || v === '' ? 'NULL' : "'" + String(v).replace(/'/g, "''") + "'";
const id = Number(datos.id || (raw.match(/#?(\d+)/) || [])[1] || 0);
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const prio = ['baja','media','alta','critica'].includes(norm(datos.prioridad)) ? norm(datos.prioridad) : (norm(raw).match(/prioridad:?\s*(baja|media|alta|critica)/)?.[1] || 'media');
const stateMap = { progreso: 'en_progreso', revision: 'en_revision', revisar: 'en_revision', terminado: 'completada', terminada: 'completada', hecho: 'completada' };
let estado = norm(datos.estado) || norm(raw).match(/estado:?\s*([a-z_]+)/)?.[1] || '';
estado = stateMap[estado] || estado;
if (!['pendiente','en_progreso','bloqueada','en_revision','completada','cancelada'].includes(estado)) estado = 'pendiente';
const responsable = datos.responsable || raw.match(/responsable:?\s*([^,;\n]+)/i)?.[1]?.trim() || raw.match(/asigna(?:r|le)?\s+a\s+([^,;\n]+)/i)?.[1]?.trim() || null;
const fecha = datos.fecha_limite || raw.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || null;
const entregable = raw.match(/entregable:?\s*([^,;\n]+)/i)?.[1]?.trim() || null;
const sprint = raw.match(/sprint:?\s*([^,;\n]+)/i)?.[1]?.trim() || null;
const cleaned = raw
  .replace(/^\/pm\s+tarea\s+\w+/i, '')
  .replace(/responsable:?\s*[^,;\n]+/ig, '')
  .replace(/prioridad:?\s*(baja|media|alta|cr[ií]tica)/ig, '')
  .replace(/estado:?\s*[a-z_]+/ig, '')
  .replace(/limite:?\s*\d{4}-\d{2}-\d{2}/ig, '')
  .replace(/l[ií]mite:?\s*\d{4}-\d{2}-\d{2}/ig, '')
  .replace(/#?\d+/g, '')
  .trim();
const titulo = cleaned || datos.titulo || datos.texto || 'Tarea sin titulo';

let query;
let action = sub;
if (['crear','nueva','registrar'].includes(sub)) {
  query = `INSERT INTO pm_tareas (titulo, descripcion, responsable, prioridad, estado, fecha_limite, entregable, sprint, creado_por, canal_origen)
VALUES (${q(titulo)}, ${q(raw)}, ${q(responsable)}, ${q(prio)}, 'pendiente', ${fecha ? q(fecha) + '::date' : 'NULL'}, ${q(entregable)}, ${q(sprint)}, ${q(ctx.usuario)}, ${q(ctx.canal_origen)})
RETURNING 'created' AS action, id, titulo, responsable, prioridad, estado, fecha_limite, entregable, sprint;`;
} else if (['asignar','assign'].includes(sub)) {
  if (!id || !responsable) {
    return [{ json: { action: 'validation_error', respuesta: 'Faltan datos para asignar la tarea. Indica ID y responsable. Ejemplo: `/pm tarea asignar #12 responsable: David`', canal_destino: 'DISCORD_CHANNEL_TAREAS', canal_id: process.env.DISCORD_CHANNEL_TAREAS || ctx.canal_origen } }];
  }
  query = `UPDATE pm_tareas SET responsable=${q(responsable)}, fecha_actualizacion=NOW() WHERE id=${id} RETURNING 'assigned' AS action, id, titulo, responsable, prioridad, estado, fecha_limite;`;
} else if (['actualizar','update','estado'].includes(sub)) {
  if (!id) {
    return [{ json: { action: 'validation_error', respuesta: 'Falta el ID de la tarea para actualizar. Ejemplo: `/pm tarea actualizar #12 estado: en_revision`', canal_destino: 'DISCORD_CHANNEL_TAREAS', canal_id: process.env.DISCORD_CHANNEL_TAREAS || ctx.canal_origen } }];
  }
  const updates = [`estado=${q(estado)}`, `prioridad=${q(prio)}`, `fecha_actualizacion=NOW()`];
  if (responsable) updates.push(`responsable=${q(responsable)}`);
  if (fecha) updates.push(`fecha_limite=${q(fecha)}::date`);
  query = `UPDATE pm_tareas SET ${updates.join(', ')} WHERE id=${id} RETURNING 'updated' AS action, id, titulo, responsable, prioridad, estado, fecha_limite;`;
} else if (['atrasos','vencidas','vencidos'].includes(sub)) {
  query = `SELECT 'overdue' AS action, id, titulo, responsable, prioridad, estado, fecha_limite, (CURRENT_DATE - fecha_limite::date) AS dias_atraso
FROM pm_tareas WHERE fecha_limite < CURRENT_DATE AND estado NOT IN ('completada','cancelada')
ORDER BY dias_atraso DESC, prioridad LIMIT 20;`;
} else {
  action = ['pendientes','listar','lista','list'].includes(sub) ? sub : 'listar';
  query = `SELECT 'list' AS action, id, titulo, responsable, prioridad, estado, fecha_limite, entregable, sprint
FROM pm_tareas WHERE estado NOT IN ('completada','cancelada')
ORDER BY CASE prioridad WHEN 'critica' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END, fecha_limite NULLS LAST LIMIT 20;`;
}
return [{ json: { query, action, canal_destino: 'DISCORD_CHANNEL_TAREAS', canal_id: process.env.DISCORD_CHANNEL_TAREAS || ctx.canal_origen } }];
});

const taskFormatCode = code(function(){
const rows = $input.all().map(i => i.json);
const ctx = $('Build Task Query').item.json;
if (ctx.respuesta) return [{ json: ctx }];
const action = rows[0]?.action || ctx.action;
const lineTask = (t) => `#${t.id} ${t.prioridad ? '[' + t.prioridad + '] ' : ''}${t.titulo} - ${t.responsable || 'sin responsable'}${t.fecha_limite ? ' - vence ' + t.fecha_limite : ''}`;
let respuesta;
if (!rows.length) {
  respuesta = action === 'overdue' ? 'No hay tareas atrasadas. El proyecto va en tiempo.' : 'No hay tareas activas registradas.';
} else if (action === 'created') {
  const t = rows[0];
  respuesta = `Tarea registrada.\nID: #${t.id}\nTitulo: ${t.titulo}\nResponsable: ${t.responsable || 'sin asignar'}\nFecha limite: ${t.fecha_limite || 'sin fecha'}\nPrioridad: ${t.prioridad}\nProximo paso: validar avance antes de la siguiente reunion de seguimiento.`;
} else if (action === 'assigned') {
  const t = rows[0];
  respuesta = `Tarea asignada.\nID: #${t.id}\nTitulo: ${t.titulo}\nResponsable: ${t.responsable}\nProximo paso: registrar avance con /pm avance registrar #${t.id}.`;
} else if (action === 'updated') {
  const t = rows[0];
  respuesta = `Tarea actualizada.\nID: #${t.id}\nEstado: ${t.estado}\nPrioridad: ${t.prioridad}\nResponsable: ${t.responsable || 'sin asignar'}\nProximo paso: revisar si requiere bloqueo, entregable o evidencia.`;
} else if (action === 'overdue') {
  respuesta = `Tareas atrasadas (${rows.length}):\n` + rows.map(t => `- ${lineTask(t)} - atraso: ${t.dias_atraso} dia(s)`).join('\n') + '\nRecomendacion PM: revisar responsables y bloqueos activos hoy.';
} else {
  respuesta = `Tareas activas (${rows.length}):\n` + rows.map(t => `- ${lineTask(t)}`).join('\n');
}
return [{ json: { respuesta, canal_destino: ctx.canal_destino, canal_id: ctx.canal_id, storage: 'postgres:pm_tareas' } }];
});

writeWorkflow(path.join(pmoDir, 'WF_PM_Tareas.json'), workflow('wf-pm-tareas', 'WF_PM_Tareas', [
  trigger,
  node('build-task', 'Build Task Query', 'n8n-nodes-base.code', 2, [240, 0], { jsCode: taskBuildCode }),
  node('task-valid?', 'Task Validation Error?', 'n8n-nodes-base.if', 2.2, [500, 0], {
    conditions: { options: { caseSensitive: true, typeValidation: 'loose' }, conditions: [{ id: 'has-response', leftValue: '={{ $json.respuesta }}', rightValue: '', operator: { type: 'string', operation: 'notEmpty', singleValue: true } }], combinator: 'and' },
    options: {},
  }),
  pgNode('run-task', 'Run Task Query', [760, 120], '={{ $json.query }}'),
  node('format-task', 'Format Task Response', 'n8n-nodes-base.code', 2, [1000, 0], { jsCode: taskFormatCode }),
], {
  'Execute Workflow Trigger': { main: [[{ node: 'Build Task Query', type: 'main', index: 0 }]] },
  'Build Task Query': { main: [[{ node: 'Task Validation Error?', type: 'main', index: 0 }]] },
  'Task Validation Error?': { main: [[{ node: 'Format Task Response', type: 'main', index: 0 }], [{ node: 'Run Task Query', type: 'main', index: 0 }]] },
  'Run Task Query': { main: [[{ node: 'Format Task Response', type: 'main', index: 0 }]] },
}));

const avancesBuildCode = code(function(){
const ctx = $json;
const datos = ctx.datos || {};
const raw = String(datos.texto || datos.texto_original || ctx.mensaje_original || '');
const sub = String(ctx.sub_intencion || 'registrar').toLowerCase();
const q = (v) => v === null || v === undefined || v === '' ? 'NULL' : "'" + String(v).replace(/'/g, "''") + "'";
const taskId = Number(datos.id || raw.match(/#?(\d+)/)?.[1] || 0) || null;
const pct = Math.max(0, Math.min(100, Number(datos.porcentaje || raw.match(/(\d{1,3})\s*%/)?.[1] || 0)));
const responsable = datos.responsable || ctx.usuario || 'sin responsable';
const desc = raw.replace(/^\/pm\s+avance\s+\w+/i, '').trim() || 'Avance registrado';
let query;
if (['resumen','listar','dia','diario'].includes(sub)) {
  query = `SELECT 'summary' AS action, responsable, COUNT(*) AS total, string_agg(descripcion, ' | ' ORDER BY fecha DESC) AS detalles
FROM pm_avances WHERE fecha::date = CURRENT_DATE GROUP BY responsable ORDER BY responsable;`;
} else {
  query = `INSERT INTO pm_avances (tarea_id, responsable, descripcion, porcentaje, bloqueos_reportados)
VALUES (${taskId || 'NULL'}, ${q(responsable)}, ${q(desc)}, ${pct}, ${/bloque/i.test(raw) ? q(raw) : 'NULL'})
RETURNING 'created' AS action, id, tarea_id, responsable, descripcion, porcentaje, fecha;`;
}
return [{ json: { query, canal_destino: 'DISCORD_CHANNEL_AVANCES', canal_id: process.env.DISCORD_CHANNEL_AVANCES || ctx.canal_origen } }];
});

const avancesFormatCode = code(function(){
const rows = $input.all().map(i => i.json);
const ctx = $('Build Avance Query').item.json;
let respuesta;
if (!rows.length) {
  respuesta = 'No hay avances registrados hoy. Recomiendo pedir check-in en #avances-diarios.';
} else if (rows[0].action === 'summary') {
  respuesta = 'Resumen de avances de hoy:\n' + rows.map(r => `- ${r.responsable}: ${r.total} registro(s). ${r.detalles || ''}`).join('\n');
} else {
  const a = rows[0];
  respuesta = `Avance registrado.\nResponsable: ${a.responsable}\nTarea: ${a.tarea_id ? '#' + a.tarea_id : 'sin tarea asociada'}\nPorcentaje: ${a.porcentaje}%\nProximo paso: validar si requiere evidencia, revision o desbloqueo.`;
}
return [{ json: { respuesta, canal_destino: ctx.canal_destino, canal_id: ctx.canal_id, storage: 'postgres:pm_avances' } }];
});

writeWorkflow(path.join(pmoDir, 'WF_PM_Avances.json'), workflow('wf-pm-avances', 'WF_PM_Avances', [
  trigger,
  node('build-avance', 'Build Avance Query', 'n8n-nodes-base.code', 2, [240, 0], { jsCode: avancesBuildCode }),
  pgNode('run-avance', 'Run Avance Query', [500, 0], '={{ $json.query }}'),
  node('format-avance', 'Format Avance Response', 'n8n-nodes-base.code', 2, [760, 0], { jsCode: avancesFormatCode }),
], {
  'Execute Workflow Trigger': { main: [[{ node: 'Build Avance Query', type: 'main', index: 0 }]] },
  'Build Avance Query': { main: [[{ node: 'Run Avance Query', type: 'main', index: 0 }]] },
  'Run Avance Query': { main: [[{ node: 'Format Avance Response', type: 'main', index: 0 }]] },
}));

const bloqueoRiesgoBuildCode = code(function(){
const ctx = $json;
const datos = ctx.datos || {};
const raw = String(datos.texto || datos.texto_original || ctx.mensaje_original || '');
const q = (v) => v === null || v === undefined || v === '' ? 'NULL' : "'" + String(v).replace(/'/g, "''") + "'";
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const intencion = ctx.intencion;
const taskId = Number(datos.id || raw.match(/#?(\d+)/)?.[1] || 0) || null;
const sev = ['baja','media','alta','critica'].includes(norm(datos.prioridad)) ? norm(datos.prioridad) : (/crit|urg/i.test(raw) ? 'critica' : /alta|bloquea/i.test(raw) ? 'alta' : 'media');
const prob = ['baja','media','alta'].includes(norm(datos.probabilidad)) ? norm(datos.probabilidad) : (/probabilidad alta|muy probable/i.test(raw) ? 'alta' : 'media');
const impactoRaw = norm(datos.impacto || '');
const impacto = ['bajo','medio','alto','critico'].includes(impactoRaw) ? impactoRaw : (/crit|grave/i.test(raw) ? 'critico' : /alto/i.test(raw) ? 'alto' : 'medio');
const prioMap = { 'baja-bajo': 'baja', 'baja-medio': 'baja', 'baja-alto': 'media', 'baja-critico': 'alta', 'media-bajo': 'baja', 'media-medio': 'media', 'media-alto': 'alta', 'media-critico': 'critica', 'alta-bajo': 'media', 'alta-medio': 'alta', 'alta-alto': 'critica', 'alta-critico': 'critica' };
const desc = raw.replace(/^\/pm\s+(bloqueo|riesgo)\s+\w+/i, '').trim() || raw;
let query;
let target;
if (intencion === 'riesgo') {
  target = 'DISCORD_CHANNEL_RIESGOS';
  const prioridad = prioMap[`${prob}-${impacto}`] || 'media';
  const mitigacion = raw.match(/mitigaci[oó]n:?\s*([^;\n]+)/i)?.[1]?.trim() || 'Definir mitigacion, responsable y fecha de revision.';
  query = `INSERT INTO pm_riesgos (descripcion, probabilidad, impacto, prioridad_calculada, mitigacion, estado, responsable, creado_por)
VALUES (${q(desc)}, ${q(prob)}, ${q(impacto)}, ${q(prioridad)}, ${q(mitigacion)}, 'abierto', ${q(datos.responsable || ctx.usuario)}, ${q(ctx.usuario)})
RETURNING 'risk' AS action, id, descripcion, probabilidad, impacto, prioridad_calculada, mitigacion, responsable;`;
} else {
  target = 'DISCORD_CHANNEL_BLOQUEOS';
  const action = raw.match(/accion:?\s*([^;\n]+)/i)?.[1]?.trim() || 'Asignar responsable de resolucion y revisar impacto en el plan.';
  query = `INSERT INTO pm_bloqueos (descripcion, responsable_afectado, tarea_id, severidad, estado, accion_recomendada, creado_por)
VALUES (${q(desc)}, ${q(datos.responsable || ctx.usuario)}, ${taskId || 'NULL'}, ${q(sev)}, 'abierto', ${q(action)}, ${q(ctx.usuario)})
RETURNING 'blocker' AS action, id, descripcion, responsable_afectado, tarea_id, severidad, accion_recomendada;`;
}
return [{ json: { query, canal_destino: target, canal_id: process.env[target] || ctx.canal_origen } }];
});

const bloqueoRiesgoFormatCode = code(function(){
const r = $json;
const ctx = $('Build Bloqueo/Riesgo Query').item.json;
let respuesta;
if (r.action === 'risk') {
  respuesta = `Riesgo registrado.\nID: #${r.id}\nDescripcion: ${r.descripcion}\nProbabilidad: ${r.probabilidad}\nImpacto: ${r.impacto}\nPrioridad calculada: ${r.prioridad_calculada}\nMitigacion sugerida: ${r.mitigacion}\nProximo paso: revisar el riesgo en el siguiente reporte PM.`;
} else {
  respuesta = `Detecte y registre un bloqueo.\nID: #${r.id}\nAfectado: ${r.responsable_afectado}\nSeveridad: ${r.severidad}\nTarea: ${r.tarea_id ? '#' + r.tarea_id : 'sin tarea asociada'}\nAccion recomendada: ${r.accion_recomendada}`;
}
return [{ json: { respuesta, canal_destino: ctx.canal_destino, canal_id: ctx.canal_id, storage: r.action === 'risk' ? 'postgres:pm_riesgos' : 'postgres:pm_bloqueos' } }];
});

writeWorkflow(path.join(pmoDir, 'WF_PM_Bloqueos_Riesgos.json'), workflow('wf-pm-bloqueos-riesgos', 'WF_PM_Bloqueos_Riesgos', [
  trigger,
  node('build-br', 'Build Bloqueo/Riesgo Query', 'n8n-nodes-base.code', 2, [240, 0], { jsCode: bloqueoRiesgoBuildCode }),
  pgNode('run-br', 'Run Bloqueo/Riesgo Query', [500, 0], '={{ $json.query }}'),
  node('format-br', 'Format Bloqueo/Riesgo Response', 'n8n-nodes-base.code', 2, [760, 0], { jsCode: bloqueoRiesgoFormatCode }),
], {
  'Execute Workflow Trigger': { main: [[{ node: 'Build Bloqueo/Riesgo Query', type: 'main', index: 0 }]] },
  'Build Bloqueo/Riesgo Query': { main: [[{ node: 'Run Bloqueo/Riesgo Query', type: 'main', index: 0 }]] },
  'Run Bloqueo/Riesgo Query': { main: [[{ node: 'Format Bloqueo/Riesgo Response', type: 'main', index: 0 }]] },
}));

const reportQuery = `SELECT
  (SELECT COUNT(*) FROM pm_tareas WHERE estado = 'completada' AND fecha_actualizacion::date >= CURRENT_DATE - INTERVAL '7 days') AS tareas_completadas_7d,
  (SELECT COUNT(*) FROM pm_tareas WHERE estado NOT IN ('completada','cancelada')) AS tareas_pendientes,
  (SELECT COUNT(*) FROM pm_tareas WHERE fecha_limite < CURRENT_DATE AND estado NOT IN ('completada','cancelada')) AS tareas_atrasadas,
  (SELECT COUNT(*) FROM pm_bloqueos WHERE estado <> 'resuelto') AS bloqueos_activos,
  (SELECT COUNT(*) FROM pm_riesgos WHERE estado = 'abierto') AS riesgos_abiertos,
  (SELECT COALESCE(json_agg(t ORDER BY fecha_limite NULLS LAST), '[]'::json) FROM (SELECT id,titulo,responsable,prioridad,estado,fecha_limite FROM pm_tareas WHERE estado NOT IN ('completada','cancelada') ORDER BY fecha_limite NULLS LAST LIMIT 8) t) AS tareas,
  (SELECT COALESCE(json_agg(b ORDER BY fecha_creacion DESC), '[]'::json) FROM (SELECT id,descripcion,responsable_afectado,severidad FROM pm_bloqueos WHERE estado <> 'resuelto' ORDER BY fecha_creacion DESC LIMIT 5) b) AS bloqueos,
  (SELECT COALESCE(json_agg(r ORDER BY fecha_creacion DESC), '[]'::json) FROM (SELECT id,descripcion,prioridad_calculada,mitigacion FROM pm_riesgos WHERE estado='abierto' ORDER BY fecha_creacion DESC LIMIT 5) r) AS riesgos,
  (SELECT COALESCE(json_agg(e ORDER BY fecha_limite NULLS LAST), '[]'::json) FROM (SELECT id,nombre,responsable,estado,fecha_limite FROM pm_entregables WHERE estado NOT IN ('entregado','aprobado') ORDER BY fecha_limite NULLS LAST LIMIT 5) e) AS entregables,
  (SELECT COALESCE(json_agg(d ORDER BY fecha DESC), '[]'::json) FROM (SELECT id,decision,responsable,fecha FROM pm_decisiones ORDER BY fecha DESC LIMIT 5) d) AS decisiones;`;

const reportFormatCode = code(function(){
const row = $json;
const ctx = $('Execute Workflow Trigger').item.json || {};
const tipo = ctx.sub_intencion === 'semanal' ? 'semanal' : (ctx.intencion === 'estado_proyecto' ? 'estado general' : 'diario');
function list(arr, fn, empty) { return (arr || []).length ? arr.map(fn).join('\n') : empty; }
const tareas = typeof row.tareas === 'string' ? JSON.parse(row.tareas) : row.tareas;
const bloqueos = typeof row.bloqueos === 'string' ? JSON.parse(row.bloqueos) : row.bloqueos;
const riesgos = typeof row.riesgos === 'string' ? JSON.parse(row.riesgos) : row.riesgos;
const entregables = typeof row.entregables === 'string' ? JSON.parse(row.entregables) : row.entregables;
const decisiones = typeof row.decisiones === 'string' ? JSON.parse(row.decisiones) : row.decisiones;
const recomendaciones = [];
if (Number(row.tareas_atrasadas) > 0) recomendaciones.push('Priorizar tareas atrasadas y validar bloqueos con responsables hoy.');
if (Number(row.bloqueos_activos) > 0) recomendaciones.push('Revisar bloqueos activos antes de abrir trabajo nuevo.');
if (Number(row.riesgos_abiertos) > 0) recomendaciones.push('Actualizar mitigaciones de riesgos abiertos y asignar fecha de revision.');
if (!recomendaciones.length) recomendaciones.push('Mantener cadencia de avances y preparar evidencia de entregables.');
const respuesta = [
  `Reporte ${tipo} PetSafe`,
  `Tareas completadas ultimos 7 dias: ${row.tareas_completadas_7d}`,
  `Pendientes: ${row.tareas_pendientes} | Atrasadas: ${row.tareas_atrasadas}`,
  `Bloqueos activos: ${row.bloqueos_activos} | Riesgos abiertos: ${row.riesgos_abiertos}`,
  '',
  'Tareas clave:',
  list(tareas, t => `- #${t.id} [${t.estado}/${t.prioridad}] ${t.titulo} - ${t.responsable || 'sin responsable'}${t.fecha_limite ? ' - ' + t.fecha_limite : ''}`, '- Sin tareas activas.'),
  '',
  'Bloqueos:',
  list(bloqueos, b => `- #${b.id} [${b.severidad}] ${b.descripcion}`, '- Sin bloqueos activos.'),
  '',
  'Riesgos:',
  list(riesgos, r => `- #${r.id} [${r.prioridad_calculada}] ${r.descripcion}`, '- Sin riesgos abiertos.'),
  '',
  'Entregables proximos:',
  list(entregables, e => `- #${e.id} ${e.nombre} - ${e.estado} - ${e.responsable || 'sin responsable'}${e.fecha_limite ? ' - ' + e.fecha_limite : ''}`, '- Sin entregables pendientes.'),
  '',
  'Decisiones recientes:',
  list(decisiones, d => `- #${d.id} ${d.decision} (${d.responsable || 'sin responsable'})`, '- Sin decisiones registradas.'),
  '',
  'Recomendaciones PM:',
  recomendaciones.map(r => `- ${r}`).join('\n')
].join('\n');
return [{ json: { respuesta, canal_destino: 'DISCORD_CHANNEL_REPORTES', canal_id: process.env.DISCORD_CHANNEL_REPORTES || ctx.canal_origen, should_publish: ctx.intencion === 'reporte' } }];
});

const outboxReportQuery = `INSERT INTO events_outbox (event_id, target, action, idempotency_key, payload)
VALUES ($1, 'discord', 'pm_report', $2, $3::jsonb)
ON CONFLICT (idempotency_key) DO NOTHING
RETURNING outbox_id;`;

writeWorkflow(path.join(pmoDir, 'WF_PM_Reportes.json'), workflow('wf-pm-reportes', 'WF_PM_Reportes', [
  trigger,
  pgNode('query-report', 'Query PM Report Data', [240, 0], reportQuery),
  node('format-report', 'Format PM Report', 'n8n-nodes-base.code', 2, [500, 0], { jsCode: reportFormatCode }),
  node('publish?', 'Publish Report?', 'n8n-nodes-base.if', 2.2, [760, 0], {
    conditions: { options: { caseSensitive: true, typeValidation: 'loose' }, conditions: [{ id: 'publish', leftValue: '={{ $json.should_publish ? 1 : 0 }}', rightValue: 1, operator: { type: 'number', operation: 'equals' } }], combinator: 'and' },
    options: {},
  }),
  pgNode('outbox-report', 'Queue Report To Discord', [1000, -80], outboxReportQuery, {
    queryReplacement: '={{ [ "pm-report-" + Date.now(), "pm-report-" + Date.now(), JSON.stringify({ content: $json.respuesta, channel_id: $json.canal_id }) ] }}',
  }),
  node('return-report', 'Return Report Response', 'n8n-nodes-base.code', 2, [1240, 0], { jsCode: "const r = $('Format PM Report').item.json; return [{ json: r }];" }),
], {
  'Execute Workflow Trigger': { main: [[{ node: 'Query PM Report Data', type: 'main', index: 0 }]] },
  'Query PM Report Data': { main: [[{ node: 'Format PM Report', type: 'main', index: 0 }]] },
  'Format PM Report': { main: [[{ node: 'Publish Report?', type: 'main', index: 0 }]] },
  'Publish Report?': { main: [[{ node: 'Queue Report To Discord', type: 'main', index: 0 }], [{ node: 'Return Report Response', type: 'main', index: 0 }]] },
  'Queue Report To Discord': { main: [[{ node: 'Return Report Response', type: 'main', index: 0 }]] },
}));

const simpleCrudBuilder = (kind) => code(function(){
const ctx = $json; const datos = ctx.datos || {}; const raw = String(datos.texto || datos.texto_original || ctx.mensaje_original || '');
const sub = String(ctx.sub_intencion || '').toLowerCase(); const q = (v) => v === null || v === undefined || v === '' ? 'NULL' : "'" + String(v).replace(/'/g, "''") + "'";
const date = datos.fecha_limite || raw.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || null;
let query;
if ('${kind}' === 'entregable') {
  const name = raw.replace(/^\/pm\s+entregable\s+\w+/i, '').replace(/responsable:?\s*[^,;\n]+/ig, '').replace(/limite:?\s*\d{4}-\d{2}-\d{2}/ig, '').trim();
  if (['registrar','crear','agregar'].includes(sub)) query = "INSERT INTO pm_entregables (nombre,responsable,estado,fecha_limite,version,enlace,observaciones,creado_por) VALUES (" + q(name || 'Entregable sin nombre') + "," + q(datos.responsable || raw.match(/responsable:?\s*([^,;\n]+)/i)?.[1]?.trim()) + ",'pendiente'," + (date ? q(date) + "::date" : "NULL") + "," + q(raw.match(/version:?\s*([^,;\n]+)/i)?.[1]?.trim() || '1.0') + "," + q(raw.match(/https?:\/\/\S+/)?.[0]) + "," + q(raw) + "," + q(ctx.usuario) + ") RETURNING 'created' AS action,*;";
  else query = "SELECT 'list' AS action,* FROM pm_entregables WHERE estado NOT IN ('entregado','aprobado') ORDER BY fecha_limite NULLS LAST LIMIT 15;";
} else if ('${kind}' === 'decision') {
  const decision = raw.replace(/^\/pm\s+decision\s+\w+/i, '').trim();
  if (sub === 'listar' || /listar|consulta|historial/i.test(raw)) query = "SELECT 'list' AS action,* FROM pm_decisiones ORDER BY fecha DESC LIMIT 12;";
  else query = "INSERT INTO pm_decisiones (decision,contexto,justificacion,responsable,creado_por) VALUES (" + q(decision || raw) + "," + q(raw.match(/contexto:?\s*([^;\n]+)/i)?.[1]?.trim()) + "," + q(raw.match(/justificaci[oó]n:?\s*([^;\n]+)/i)?.[1]?.trim()) + "," + q(datos.responsable || ctx.usuario) + "," + q(ctx.usuario) + ") RETURNING 'created' AS action,*;";
} else {
  const type = /bien/i.test(sub || raw) ? 'bien' : /mejorar|mejora/i.test(sub || raw) ? 'mejorar' : 'accion';
  if (sub === 'listar' || /resumen|listar/i.test(raw)) query = "SELECT 'list' AS action,* FROM pm_retrospectivas ORDER BY fecha DESC LIMIT 15;";
  else query = "INSERT INTO pm_retrospectivas (sprint,tipo,descripcion,responsable,estado,creado_por) VALUES (" + q(raw.match(/sprint:?\s*([^,;\n]+)/i)?.[1]?.trim()) + "," + q(type) + "," + q(raw.replace(/^\/pm\s+(retrospectiva|retro)\s+\w+/i, '').trim() || raw) + "," + q(datos.responsable || null) + ",'pendiente'," + q(ctx.usuario) + ") RETURNING 'created' AS action,*;";
}
return [{ json: { query, kind: '${kind}', canal_destino: '${kind}' === 'entregable' ? 'DISCORD_CHANNEL_ENTREGABLES' : '${kind}' === 'decision' ? 'DISCORD_CHANNEL_REUNIONES' : 'DISCORD_CHANNEL_REPORTES', canal_id: process.env['${kind}' === 'entregable' ? 'DISCORD_CHANNEL_ENTREGABLES' : '${kind}' === 'decision' ? 'DISCORD_CHANNEL_REUNIONES' : 'DISCORD_CHANNEL_REPORTES'] || ctx.canal_origen } }];
}).replaceAll('${kind}', kind);

const simpleCrudFormatter = (kind) => code(function(){
const rows = $input.all().map(i => i.json); const ctx = $('Build Query').item.json; const first = rows[0] || {};
let respuesta;
if ('${kind}' === 'entregable') {
  if (!rows.length) respuesta = 'No hay entregables pendientes.';
  else if (first.action === 'created') respuesta = `Entregable registrado.\nID: #${first.id}\nNombre: ${first.nombre}\nResponsable: ${first.responsable || 'sin asignar'}\nFecha limite: ${first.fecha_limite || 'sin fecha'}\nProximo paso: adjuntar enlace/evidencia cuando este listo.`;
  else respuesta = 'Entregables pendientes:\n' + rows.map(e => `- #${e.id} ${e.nombre} - ${e.estado} - ${e.responsable || 'sin responsable'}${e.fecha_limite ? ' - ' + e.fecha_limite : ''}`).join('\n');
} else if ('${kind}' === 'decision') {
  if (!rows.length) respuesta = 'No hay decisiones registradas.';
  else if (first.action === 'created') respuesta = `Decision registrada.\nID: #${first.id}\nDecision: ${first.decision}\nResponsable: ${first.responsable}\nTrazabilidad: quedo guardada para reportes y reuniones.`;
  else respuesta = 'Decisiones recientes:\n' + rows.map(d => `- #${d.id} ${d.decision} (${d.responsable || 'sin responsable'})`).join('\n');
} else {
  if (!rows.length) respuesta = 'No hay elementos de retrospectiva registrados.';
  else if (first.action === 'created') respuesta = `Retrospectiva registrada.\nTipo: ${first.tipo}\nDescripcion: ${first.descripcion}\nProximo paso: convertir acciones de mejora en tareas con responsable.`;
  else respuesta = 'Resumen de retrospectiva:\n' + rows.map(r => `- [${r.tipo}] ${r.descripcion}${r.responsable ? ' - ' + r.responsable : ''}`).join('\n');
}
const storageMap = { entregable: 'pm_entregables', decision: 'pm_decisiones', retrospectiva: 'pm_retrospectivas' };
return [{ json: { respuesta, canal_destino: ctx.canal_destino, canal_id: ctx.canal_id, storage: 'postgres:' + storageMap['${kind}'] } }];
}).replaceAll('${kind}', kind);

for (const [id, name, file, kind] of [
  ['wf-pm-entregables', 'WF_PM_Entregables', 'WF_PM_Entregables.json', 'entregable'],
  ['wf-pm-decisiones', 'WF_PM_Decisiones', 'WF_PM_Decisiones.json', 'decision'],
  ['wf-pm-retrospectiva', 'WF_PM_Retrospectiva', 'WF_PM_Retrospectiva.json', 'retrospectiva'],
]) {
  writeWorkflow(path.join(pmoDir, file), workflow(id, name, [
    trigger,
    node('build', 'Build Query', 'n8n-nodes-base.code', 2, [240, 0], { jsCode: simpleCrudBuilder(kind) }),
    pgNode('run', 'Run Query', [500, 0], '={{ $json.query }}'),
    node('format', 'Format Response', 'n8n-nodes-base.code', 2, [760, 0], { jsCode: simpleCrudFormatter(kind) }),
  ], {
    'Execute Workflow Trigger': { main: [[{ node: 'Build Query', type: 'main', index: 0 }]] },
    'Build Query': { main: [[{ node: 'Run Query', type: 'main', index: 0 }]] },
    'Run Query': { main: [[{ node: 'Format Response', type: 'main', index: 0 }]] },
  }));
}

const reunionesQuery = `SELECT
  (SELECT COALESCE(json_agg(t), '[]'::json) FROM (SELECT id,titulo,responsable,prioridad,fecha_limite FROM pm_tareas WHERE estado NOT IN ('completada','cancelada') ORDER BY fecha_limite NULLS LAST LIMIT 8) t) AS tareas,
  (SELECT COALESCE(json_agg(b), '[]'::json) FROM (SELECT id,descripcion,severidad,responsable_afectado FROM pm_bloqueos WHERE estado <> 'resuelto' ORDER BY fecha_creacion DESC LIMIT 5) b) AS bloqueos,
  (SELECT COALESCE(json_agg(r), '[]'::json) FROM (SELECT id,descripcion,prioridad_calculada FROM pm_riesgos WHERE estado='abierto' ORDER BY fecha_creacion DESC LIMIT 5) r) AS riesgos,
  (SELECT COALESCE(json_agg(e), '[]'::json) FROM (SELECT id,nombre,responsable,fecha_limite,estado FROM pm_entregables WHERE estado NOT IN ('entregado','aprobado') ORDER BY fecha_limite NULLS LAST LIMIT 5) e) AS entregables;`;

const reunionesFormatCode = code(function(){
const row = $json; const ctx = $('Execute Workflow Trigger').item.json || {};
const tareas = typeof row.tareas === 'string' ? JSON.parse(row.tareas) : row.tareas;
const bloqueos = typeof row.bloqueos === 'string' ? JSON.parse(row.bloqueos) : row.bloqueos;
const riesgos = typeof row.riesgos === 'string' ? JSON.parse(row.riesgos) : row.riesgos;
const entregables = typeof row.entregables === 'string' ? JSON.parse(row.entregables) : row.entregables;
const titulo = (ctx.datos?.texto || '').replace(/^\/pm\s+reunion\s+\w+/i, '').trim() || 'Reunion de seguimiento PetSafe';
const respuesta = [
  `Agenda preparada: ${titulo}`,
  '',
  '1. Estado general: pendientes, atrasos y entregables proximos.',
  '2. Tareas a revisar:',
  ...(tareas.length ? tareas.map(t => `- #${t.id} ${t.titulo} - ${t.responsable || 'sin responsable'}${t.fecha_limite ? ' - ' + t.fecha_limite : ''}`) : ['- Sin tareas activas.']),
  '3. Bloqueos:',
  ...(bloqueos.length ? bloqueos.map(b => `- #${b.id} [${b.severidad}] ${b.descripcion}`) : ['- Sin bloqueos activos.']),
  '4. Riesgos:',
  ...(riesgos.length ? riesgos.map(r => `- #${r.id} [${r.prioridad_calculada}] ${r.descripcion}`) : ['- Sin riesgos abiertos.']),
  '5. Entregables:',
  ...(entregables.length ? entregables.map(e => `- #${e.id} ${e.nombre} - ${e.responsable || 'sin responsable'}${e.fecha_limite ? ' - ' + e.fecha_limite : ''}`) : ['- Sin entregables pendientes.']),
  '',
  'Cierre esperado: registrar decisiones, acuerdos y compromisos con responsable y fecha.'
].join('\n');
return [{ json: { respuesta, titulo, canal_destino: 'DISCORD_CHANNEL_REUNIONES', canal_id: process.env.DISCORD_CHANNEL_REUNIONES || ctx.canal_origen } }];
});

const reunionesInsert = `INSERT INTO pm_reuniones (titulo, tipo, agenda, creado_por)
VALUES ($1, 'seguimiento', $2, $3)
RETURNING id;`;

writeWorkflow(path.join(pmoDir, 'WF_PM_Reuniones.json'), workflow('wf-pm-reuniones', 'WF_PM_Reuniones', [
  trigger,
  pgNode('query-meeting', 'Query Meeting Context', [240, 0], reunionesQuery),
  node('format-meeting', 'Format Meeting Agenda', 'n8n-nodes-base.code', 2, [500, 0], { jsCode: reunionesFormatCode }),
  pgNode('store-meeting', 'Store Meeting Agenda', [760, 0], reunionesInsert, {
    queryReplacement: '={{ [ $json.titulo, $json.respuesta, $("Execute Workflow Trigger").item.json.usuario ] }}',
  }),
  node('return-meeting', 'Return Meeting Response', 'n8n-nodes-base.code', 2, [1000, 0], { jsCode: "return [{ json: $('Format Meeting Agenda').item.json }];" }),
], {
  'Execute Workflow Trigger': { main: [[{ node: 'Query Meeting Context', type: 'main', index: 0 }]] },
  'Query Meeting Context': { main: [[{ node: 'Format Meeting Agenda', type: 'main', index: 0 }]] },
  'Format Meeting Agenda': { main: [[{ node: 'Store Meeting Agenda', type: 'main', index: 0 }]] },
  'Store Meeting Agenda': { main: [[{ node: 'Return Meeting Response', type: 'main', index: 0 }]] },
}));

const adminQuery = `SELECT
  (SELECT COUNT(*) FROM pm_tareas) AS tareas,
  (SELECT COUNT(*) FROM pm_avances) AS avances,
  (SELECT COUNT(*) FROM pm_bloqueos WHERE estado <> 'resuelto') AS bloqueos_activos,
  (SELECT COUNT(*) FROM pm_riesgos WHERE estado = 'abierto') AS riesgos_abiertos,
  (SELECT COUNT(*) FROM pm_entregables) AS entregables,
  (SELECT COUNT(*) FROM pm_decisiones) AS decisiones,
  (SELECT COUNT(*) FROM events_outbox WHERE status IN ('pending','sending')) AS outbox_pendiente,
  (SELECT COUNT(*) FROM events_outbox WHERE status IN ('failed','dead')) AS outbox_fallido,
  (SELECT COALESCE(json_agg(l), '[]'::json) FROM (SELECT id,intencion,usuario,canal,exito,fecha FROM pm_command_log ORDER BY fecha DESC LIMIT 5) l) AS ultimos_comandos;`;

const adminFormatCode = code(function(){
const row = $json; const ctx = $('Execute Workflow Trigger').item.json || {};
const required = ['DISCORD_BOT_TOKEN','DISCORD_CHANNEL_TAREAS','DISCORD_CHANNEL_AVANCES','DISCORD_CHANNEL_BLOQUEOS','DISCORD_CHANNEL_REPORTES','DISCORD_CHANNEL_REUNIONES','DISCORD_CHANNEL_ENTREGABLES','DISCORD_CHANNEL_RIESGOS','DISCORD_CHANNEL_BOT_LOG','DISCORD_CHANNEL_ADMIN'];
const missing = required.filter(k => !process.env[k]);
const logs = typeof row.ultimos_comandos === 'string' ? JSON.parse(row.ultimos_comandos) : row.ultimos_comandos;
const respuesta = [
  'Estado administrativo del PM Bot',
  `Storage: Postgres`,
  `Tareas: ${row.tareas} | Avances: ${row.avances} | Entregables: ${row.entregables} | Decisiones: ${row.decisiones}`,
  `Bloqueos activos: ${row.bloqueos_activos} | Riesgos abiertos: ${row.riesgos_abiertos}`,
  `Outbox pendiente: ${row.outbox_pendiente} | Outbox fallido: ${row.outbox_fallido}`,
  `Variables faltantes: ${missing.length ? missing.join(', ') : 'ninguna'}`,
  '',
  'Ultimos comandos:',
  ...(logs.length ? logs.map(l => `- #${l.id} ${l.intencion} por ${l.usuario} en ${l.canal}`) : ['- Sin comandos auditados.'])
].join('\n');
return [{ json: { respuesta, canal_destino: 'DISCORD_CHANNEL_ADMIN', canal_id: process.env.DISCORD_CHANNEL_ADMIN || ctx.canal_origen, storage: 'postgres:pm_command_log/events_outbox' } }];
});

writeWorkflow(path.join(pmoDir, 'WF_PM_Admin.json'), workflow('wf-pm-admin', 'WF_PM_Admin', [
  trigger,
  pgNode('query-admin', 'Query Bot Status', [240, 0], adminQuery),
  node('format-admin', 'Format Admin Status', 'n8n-nodes-base.code', 2, [500, 0], { jsCode: adminFormatCode }),
], {
  'Execute Workflow Trigger': { main: [[{ node: 'Query Bot Status', type: 'main', index: 0 }]] },
  'Query Bot Status': { main: [[{ node: 'Format Admin Status', type: 'main', index: 0 }]] },
}));

const remindersQuery = `SELECT
  (SELECT COALESCE(json_agg(t), '[]'::json) FROM (SELECT id,titulo,responsable,fecha_limite, CURRENT_DATE - fecha_limite::date AS dias_atraso FROM pm_tareas WHERE fecha_limite < CURRENT_DATE AND estado NOT IN ('completada','cancelada') ORDER BY fecha_limite LIMIT 10) t) AS tareas_atrasadas,
  (SELECT COALESCE(json_agg(e), '[]'::json) FROM (SELECT id,nombre,responsable,fecha_limite, fecha_limite::date - CURRENT_DATE AS dias_restantes FROM pm_entregables WHERE fecha_limite <= CURRENT_DATE + INTERVAL '3 days' AND estado NOT IN ('entregado','aprobado') ORDER BY fecha_limite LIMIT 10) e) AS entregables_proximos,
  (SELECT COUNT(*) FROM pm_bloqueos WHERE estado <> 'resuelto') AS bloqueos_activos;`;

const remindersFormatCode = code(function(){
const row = $json; const ctx = $('Execute Workflow Trigger').item?.json || {};
const tareas = typeof row.tareas_atrasadas === 'string' ? JSON.parse(row.tareas_atrasadas) : row.tareas_atrasadas;
const entregables = typeof row.entregables_proximos === 'string' ? JSON.parse(row.entregables_proximos) : row.entregables_proximos;
const lines = ['Recordatorio PM PetSafe'];
if (tareas.length) lines.push('Tareas atrasadas:', ...tareas.map(t => `- #${t.id} ${t.titulo} - ${t.responsable || 'sin responsable'} - ${t.dias_atraso} dia(s)`));
if (entregables.length) lines.push('Entregables proximos/vencidos:', ...entregables.map(e => `- #${e.id} ${e.nombre} - ${e.responsable || 'sin responsable'} - ${e.dias_restantes} dia(s)`));
if (Number(row.bloqueos_activos) > 0) lines.push(`Bloqueos activos: ${row.bloqueos_activos}. Revisar #bloqueos.`);
if (lines.length === 1) lines.push('Sin atrasos ni entregables criticos para los proximos 3 dias.');
const respuesta = lines.join('\n');
return [{ json: { respuesta, canal_destino: 'DISCORD_CHANNEL_REPORTES', canal_id: process.env.DISCORD_CHANNEL_REPORTES || ctx.canal_origen, should_publish: true } }];
});

writeWorkflow(path.join(pmoDir, 'WF_PM_Recordatorios.json'), workflow('wf-pm-recordatorios', 'WF_PM_Recordatorios', [
  node('schedule', 'Daily Reminder Trigger', 'n8n-nodes-base.scheduleTrigger', 1.1, [0, -120], { rule: { interval: [{ field: 'cronExpression', expression: '0 8 * * 1-5' }] } }),
  trigger,
  pgNode('query-reminders', 'Query Reminder Data', [260, 0], remindersQuery),
  node('format-reminders', 'Format Reminder', 'n8n-nodes-base.code', 2, [520, 0], { jsCode: remindersFormatCode }),
  pgNode('queue-reminder', 'Queue Reminder To Discord', [780, 0], outboxReportQuery, {
    queryReplacement: '={{ [ "pm-reminder-" + Date.now(), "pm-reminder-" + Date.now(), JSON.stringify({ content: $json.respuesta, channel_id: $json.canal_id }) ] }}',
  }),
  node('return-reminder', 'Return Reminder Response', 'n8n-nodes-base.code', 2, [1020, 0], { jsCode: "return [{ json: $('Format Reminder').item.json }];" }),
], {
  'Daily Reminder Trigger': { main: [[{ node: 'Query Reminder Data', type: 'main', index: 0 }]] },
  'Execute Workflow Trigger': { main: [[{ node: 'Query Reminder Data', type: 'main', index: 0 }]] },
  'Query Reminder Data': { main: [[{ node: 'Format Reminder', type: 'main', index: 0 }]] },
  'Format Reminder': { main: [[{ node: 'Queue Reminder To Discord', type: 'main', index: 0 }]] },
  'Queue Reminder To Discord': { main: [[{ node: 'Return Reminder Response', type: 'main', index: 0 }]] },
}));

const schemaFile = path.join(coreDir, 'System - PM Schema Manager.json');
const schema = JSON.parse(fs.readFileSync(schemaFile, 'utf8'));
schema.id = 'wf-pm-schema-manager';
schema.settings = settings;
const createTables = schema.nodes.find((n) => n.name === 'Create PM Tables');
if (createTables) {
  createTables.parameters.query = createTables.parameters.query.replace(
    /\n-- 10\. PM Bot errors\nCREATE TABLE IF NOT EXISTS pm_bot_errors \([\s\S]*?CREATE INDEX IF NOT EXISTS idx_pm_bot_errors_fecha ON pm_bot_errors\(fecha\);\n/g,
    '\n'
  );
  createTables.parameters.query = createTables.parameters.query.replace(
    "CREATE INDEX IF NOT EXISTS idx_pm_command_log_fecha ON pm_command_log(fecha);",
    `CREATE INDEX IF NOT EXISTS idx_pm_command_log_fecha ON pm_command_log(fecha);

-- 10. PM Bot errors
CREATE TABLE IF NOT EXISTS pm_bot_errors (
  id bigserial PRIMARY KEY,
  workflow_name text,
  node_name text,
  error_message text,
  execution_id text,
  payload jsonb,
  fecha timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pm_bot_errors_fecha ON pm_bot_errors(fecha);`
  );
}
writeWorkflow(schemaFile, schema);

const errorFormatCode = code(function(){
const e = $json || {};
const workflow = e.workflow?.name || e.workflowName || 'workflow desconocido';
const node = e.execution?.lastNodeExecuted || e.node?.name || 'nodo desconocido';
const msg = e.error?.message || e.message || JSON.stringify(e).slice(0, 500);
const content = `Error critico en PM Bot\nWorkflow: ${workflow}\nNodo: ${node}\nError: ${msg}`;
return [{ json: { workflow, node, msg, execution_id: e.execution?.id || e.executionId || '', payload: e, content, channel_id: process.env.DISCORD_CHANNEL_ADMIN || process.env.DISCORD_CHANNEL_BOT_LOG || '' } }];
});

writeWorkflow(path.join(coreDir, 'WF_PM_Error_Handler.json'), workflow('wf-pm-error-handler', 'WF_PM_Error_Handler', [
  node('error-trigger', 'Error Trigger', 'n8n-nodes-base.errorTrigger', 1, [0, 0]),
  node('format-error', 'Format Error', 'n8n-nodes-base.code', 2, [240, 0], { jsCode: errorFormatCode }),
  pgNode('store-error', 'Store PM Bot Error', [500, 0], `INSERT INTO pm_bot_errors (workflow_name,node_name,error_message,execution_id,payload)
VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING id;`, {
    queryReplacement: '={{ [ $json.workflow, $json.node, $json.msg, $json.execution_id, JSON.stringify($json.payload || {}) ] }}',
  }),
  pgNode('queue-error', 'Queue Error Notification', [760, 0], outboxReportQuery, {
    queryReplacement: '={{ [ "pm-error-" + Date.now(), "pm-error-" + Date.now(), JSON.stringify({ content: $("Format Error").item.json.content, channel_id: $("Format Error").item.json.channel_id }) ] }}',
  }),
], {
  'Error Trigger': { main: [[{ node: 'Format Error', type: 'main', index: 0 }]] },
  'Format Error': { main: [[{ node: 'Store PM Bot Error', type: 'main', index: 0 }]] },
  'Store PM Bot Error': { main: [[{ node: 'Queue Error Notification', type: 'main', index: 0 }]] },
}, true));

function ensureNode(wf, newNode) {
  const idx = wf.nodes.findIndex((n) => n.name === newNode.name);
  if (idx >= 0) wf.nodes[idx] = { ...wf.nodes[idx], ...newNode };
  else wf.nodes.push(newNode);
}

function patchChatWorkflow() {
  const file = path.join(root, '3. 💬 Communication & Events (Canales de Entrada o Salida)', 'Chat Discord PetSafe.json');
  const wf = JSON.parse(fs.readFileSync(file, 'utf8'));
  wf.settings = { ...(wf.settings || {}), errorWorkflow: 'wf-pm-error-handler' };

  const router = wf.nodes.find((n) => n.name === 'Router Comandos1');
  if (router && !router.parameters.jsCode.includes('pm_project_manager')) {
    router.parameters.jsCode = router.parameters.jsCode.replace(
      "const low = pregunta.toLowerCase();",
      `const low = pregunta.toLowerCase();
const body = $node['Discord Webhook1'].json.body || {};
const channelId = String(body.channel_id || body.channelId || body.channel || '');
const pmChannels = new Set([
  process.env.DISCORD_CHANNEL_TAREAS,
  process.env.DISCORD_CHANNEL_AVANCES,
  process.env.DISCORD_CHANNEL_BLOQUEOS,
  process.env.DISCORD_CHANNEL_REPORTES,
  process.env.DISCORD_CHANNEL_REUNIONES,
  process.env.DISCORD_CHANNEL_ENTREGABLES,
  process.env.DISCORD_CHANNEL_RIESGOS,
  process.env.DISCORD_CHANNEL_ADMIN
].filter(Boolean).map(String));
const pmIntentHint = /^\\/pm(\\s|$)/i.test(pregunta)
  || (pmChannels.has(channelId) && /(tarea|avance|bloqueo|riesgo|reporte|reunion|reunión|decision|decisión|entregable|retrospectiva|pendiente|atraso|sprint|estado)/i.test(low));`
    );
    router.parameters.jsCode = router.parameters.jsCode.replace(
      "if (!pregunta.startsWith('!')) {\n  if (pregunta.includes('ha saltado al servidor') || pregunta.includes('joined the server')) {",
      "if (!pregunta.startsWith('!')) {\n  if (pmIntentHint) {\n    comando.nombre = 'pm';\n    comando.tipo = 'pm_project_manager';\n  } else if (pregunta.includes('ha saltado al servidor') || pregunta.includes('joined the server')) {"
    );
    router.parameters.jsCode = router.parameters.jsCode.replace(
      "usuario: $node['Config1'].json.usuario_discord\n  }",
      `usuario: $node['Config1'].json.usuario_discord,
    channel_id: channelId,
    channel_name: body.channel_name || body.channelName || '',
    message_id: body.message_id || body.messageId || '',
    user_id: body.user_id || body.userId || '',
    content: pregunta
  }`
    );
  }

  ensureNode(wf, node('if-pm', 'IF Es PM Project Manager', 'n8n-nodes-base.if', 2.2, [45152, 36624], {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
      combinator: 'and',
      conditions: [{
        id: 'is-pm',
        leftValue: '={{ $json.tipo }}',
        rightValue: 'pm_project_manager',
        operator: { type: 'string', operation: 'equals' },
      }],
    },
    options: {},
  }));
  ensureNode(wf, execNode('execute-pm-router', 'Execute PM Router', [45424, 36496], 'wf-pm-router-intenciones', 'WF_PM_Router_Intenciones'));
  ensureNode(wf, node('resp-pm-bot', 'Resp PM Bot', 'n8n-nodes-base.respondToWebhook', 1.1, [45680, 36496], {
    respondWith: 'text',
    responseBody: '={{ $json.respuesta || $json.response || "Accion PM procesada." }}',
    options: {},
  }));

  wf.connections['Router Comandos1'] = { main: [[{ node: 'IF Es PM Project Manager', type: 'main', index: 0 }]] };
  wf.connections['IF Es PM Project Manager'] = {
    main: [
      [{ node: 'Execute PM Router', type: 'main', index: 0 }],
      [{ node: 'IF Es Ayuda1', type: 'main', index: 0 }],
    ],
  };
  wf.connections['Execute PM Router'] = { main: [[{ node: 'Resp PM Bot', type: 'main', index: 0 }]] };
  wf.connections['Resp PM Bot'] = { main: [[{ node: 'Audit Success', type: 'main', index: 0 }]] };

  writeWorkflow(file, wf);
}

function patchOutbox(fileName) {
  const file = path.join(root, '3. 💬 Communication & Events (Canales de Entrada o Salida)', fileName);
  const wf = JSON.parse(fs.readFileSync(file, 'utf8'));
  const send = wf.nodes.find((n) => n.name === 'Send Discord' || n.name === 'Send Discord Webhook');
  if (send) {
    send.parameters.url = "={{ $json.payload?.channel_id ? 'https://discord.com/api/v10/channels/' + $json.payload.channel_id + '/messages' : $env.DISCORD_WEBHOOK_URL }}";
    send.parameters.sendHeaders = true;
    send.parameters.headerParameters = {
      parameters: [
        { name: 'Authorization', value: "={{ $json.payload?.channel_id ? 'Bot ' + $env.DISCORD_BOT_TOKEN : '' }}" },
        { name: 'Content-Type', value: 'application/json' },
      ],
    };
    send.parameters.sendBody = true;
    send.parameters.specifyBody = 'json';
    send.parameters.jsonBody = "={{ $json.payload?.channel_id ? { content: String($json.payload.content || $json.payload.text || '').slice(0, 2000), embeds: $json.payload.embeds, components: $json.payload.components } : ($json.payload || { content: $json.content || 'outbox event' }) }}";
  }
  writeWorkflow(file, wf);
}

patchChatWorkflow();
patchOutbox('Executor - Discord Outbox.json');
patchOutbox('Outbox Discord Sender.json');

console.log('PM workflows generated.');
