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
  const body = source.slice(start + 1, end).replace(/^\n/, '').replace(/\n$/, '');
  return `const process = { env: typeof $env !== 'undefined' ? $env : {} };\n${body}`;
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

function switchEqualsRule(intent, outputKey) {
  return {
    conditions: {
      options: {
        caseSensitive: true,
        leftValue: '',
        typeValidation: 'strict',
        version: 3,
      },
      conditions: [
        {
          id: `pm-intent-${outputKey}`,
          leftValue: '={{ $json.intencion }}',
          rightValue: intent,
          operator: {
            type: 'string',
            operation: 'equals',
          },
        },
      ],
      combinator: 'and',
    },
    renameOutput: true,
    outputKey,
  };
}

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
const channelRole = Object.entries(channels).find(([, id]) => id && String(id) === channel)?.[0] || null;

const slashAlias = msg.match(/^\/(ayuda|estado|reporte|kpis|pendientes|atrasos|tarea|avance|bloqueo|bloqueos|impedimento|impedimentos|riesgo|riesgos|decision|decisiones|entregable|entregables|retrospectiva|retrospectivas|reunion|reuniones|recordatorio|admin)(?:\s+(.*))?$/i);
const legacyBang = msg.match(/^!(\w+)(?:\s+(.*))?$/i);
const isCommand = /^\/pm(\s|$)/i.test(msg) || !!slashAlias || !!legacyBang;
let cmdText = '';
let legacyCommand = false;
if (/^\/pm(\s|$)/i.test(msg)) {
  cmdText = msg.replace(/^\/pm\s*/i, '').trim();
} else if (slashAlias) {
  cmdText = `${slashAlias[1].toLowerCase()} ${slashAlias[2] || ''}`.trim();
} else if (legacyBang) {
  legacyCommand = true;
  cmdText = `${legacyBang[1].toLowerCase()} ${legacyBang[2] || ''}`.trim();
}
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
function clampDays(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.max(1, Math.min(90, Math.floor(n)));
}
function actionOrDefault(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

let intencion = 'desconocido';
let sub_intencion = null;
let datos = {};
let canal_destino = 'DISCORD_CHANNEL_REPORTES';

function applyChannelDefault() {
  if (!channelRole || intencion !== 'desconocido') return;
  if (channelRole === 'tareas') {
    intencion = 'tarea';
    sub_intencion = /atrasad|vencid|atrasos/i.test(low) ? 'atrasos' : (/pendiente/i.test(low) ? 'pendientes' : (/listar|lista|ver|mostrar/i.test(low) ? 'listar' : 'crear'));
    canal_destino = 'DISCORD_CHANNEL_TAREAS';
  } else if (channelRole === 'avances') {
    intencion = 'avance';
    sub_intencion = /resumen|listar|lista|ver|diario/i.test(low) ? 'resumen' : 'registrar';
    canal_destino = 'DISCORD_CHANNEL_AVANCES';
  } else if (channelRole === 'bloqueos') {
    intencion = 'bloqueo';
    sub_intencion = /listar|lista|ver|mostrar|consultar/i.test(low) ? 'listar' : 'registrar';
    canal_destino = 'DISCORD_CHANNEL_BLOQUEOS';
  } else if (channelRole === 'riesgos') {
    intencion = 'riesgo';
    sub_intencion = /listar|lista|ver|mostrar|consultar/i.test(low) ? 'listar' : 'registrar';
    canal_destino = 'DISCORD_CHANNEL_RIESGOS';
  } else if (channelRole === 'reportes') {
    intencion = /kpis?|indicadores/i.test(low) ? 'reporte' : 'estado_proyecto';
    sub_intencion = /kpis?|indicadores/i.test(low) ? 'kpis' : (/semanal|semana/i.test(low) ? 'semanal' : 'general');
    canal_destino = 'DISCORD_CHANNEL_REPORTES';
  } else if (channelRole === 'reuniones') {
    intencion = 'reunion';
    sub_intencion = /listar|lista|ver|mostrar/i.test(low) ? 'listar' : 'agendar';
    canal_destino = 'DISCORD_CHANNEL_REUNIONES';
  } else if (channelRole === 'entregables') {
    intencion = 'entregable';
    sub_intencion = /registr|crear|agregar/i.test(low) ? 'registrar' : 'pendientes';
    canal_destino = 'DISCORD_CHANNEL_ENTREGABLES';
  } else if (channelRole === 'admin') {
    intencion = 'administracion';
    sub_intencion = 'estado';
    canal_destino = 'DISCORD_CHANNEL_ADMIN';
  }
  if (intencion !== 'desconocido') datos.texto = msg;
}

if (isCommand) {
  switch (cmd) {
    case '':
    case 'ayuda':
    case 'help':
      intencion = 'ayuda';
      sub_intencion = sub || channelRole || 'general';
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
    case 'bloqueos':
    case 'impedimento':
    case 'impedimentos':
      intencion = 'bloqueo';
      sub_intencion = actionOrDefault(sub, ['registrar','crear','agregar','listar','lista','ver','resolver','cerrar'], 'registrar');
      datos.texto = sub_intencion === sub ? rest : cmdParts.slice(1).join(' ');
      canal_destino = 'DISCORD_CHANNEL_BLOQUEOS';
      break;
    case 'riesgo':
    case 'riesgos':
      intencion = 'riesgo';
      sub_intencion = actionOrDefault(sub, ['registrar','crear','agregar','listar','lista','ver','mitigar','cerrar'], 'registrar');
      datos.texto = sub_intencion === sub ? rest : cmdParts.slice(1).join(' ');
      canal_destino = 'DISCORD_CHANNEL_RIESGOS';
      break;
    case 'reporte':
      intencion = 'reporte';
      sub_intencion = /^\d+$/.test(sub) ? 'rango' : (sub || 'diario');
      canal_destino = 'DISCORD_CHANNEL_REPORTES';
      break;
    case 'kpis':
      intencion = 'reporte';
      sub_intencion = 'kpis';
      canal_destino = 'DISCORD_CHANNEL_REPORTES';
      break;
    case 'reunion':
    case 'reunión':
    case 'reuniones':
      intencion = 'reunion';
      sub_intencion = actionOrDefault(sub, ['preparar','agendar','programar','listar','lista','ver','actualizar','update','editar','reprogramar','cancelar','cancelada','eliminar','borrar','acta','registrar_acta','acuerdos','compromisos'], 'agendar');
      datos.texto = sub_intencion === sub ? rest : cmdParts.slice(1).join(' ');
      canal_destino = 'DISCORD_CHANNEL_REUNIONES';
      break;
    case 'decision':
    case 'decisión':
    case 'decisiones':
      intencion = 'decision';
      sub_intencion = actionOrDefault(sub, ['registrar','crear','agregar','listar','lista','ver'], 'registrar');
      datos.texto = sub_intencion === sub ? rest : cmdParts.slice(1).join(' ');
      canal_destino = 'DISCORD_CHANNEL_REUNIONES';
      break;
    case 'entregable':
    case 'entregables':
      intencion = 'entregable';
      sub_intencion = actionOrDefault(sub, ['registrar','crear','agregar','listar','lista','ver','pendientes'], 'listar');
      datos.texto = sub_intencion === sub ? rest : cmdParts.slice(1).join(' ');
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
    case 'retrospectivas':
      intencion = 'retrospectiva';
      sub_intencion = actionOrDefault(sub, ['registrar','crear','agregar','listar','lista','ver','bien','mejorar','accion'], 'registrar');
      datos.texto = sub_intencion === sub ? rest : cmdParts.slice(1).join(' ');
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
  intencion = 'bloqueo'; sub_intencion = /listar|lista|ver|mostrar|consultar/i.test(low) ? 'listar' : 'registrar'; canal_destino = 'DISCORD_CHANNEL_BLOQUEOS';
} else if (/riesgo|peligro|amenaza|podr[ií]a fallar/i.test(low)) {
  intencion = 'riesgo'; sub_intencion = /listar|lista|ver|mostrar|consultar/i.test(low) ? 'listar' : 'registrar'; canal_destino = 'DISCORD_CHANNEL_RIESGOS';
} else if (/kpis?|indicadores|reporte (diario|semanal)|genera(r)? reporte|resumen (del|de la) semana|estado (del|general)/i.test(low)) {
  intencion = 'reporte'; sub_intencion = /kpis?|indicadores/i.test(low) ? 'kpis' : (/semanal|semana/i.test(low) ? 'semanal' : 'diario'); canal_destino = 'DISCORD_CHANNEL_REPORTES';
} else if (/reuni[oó]n|prepara(r)? la reuni|agenda|acta|acuerdo|compromiso/i.test(low)) {
  intencion = 'reunion'; sub_intencion = /cancelar|cancela|eliminar|borrar/i.test(low) ? 'cancelar' : (/actualizar|editar|reprogramar|mover/i.test(low) ? 'actualizar' : (/listar|lista|ver|mostrar/i.test(low) ? 'listar' : (/acta|acuerdo|compromiso/i.test(low) ? 'registrar_acta' : 'agendar'))); canal_destino = 'DISCORD_CHANNEL_REUNIONES';
} else if (/decisi[oó]n|decidimos|usaremos|registra(r)? esta decisi/i.test(low)) {
  intencion = 'decision'; sub_intencion = /listar|lista|ver|historial|mostrar/i.test(low) ? 'listar' : 'registrar'; canal_destino = 'DISCORD_CHANNEL_REUNIONES';
} else if (/entregable|document(o|aci)|versi[oó]n|informe|prototipo|entregables falt/i.test(low)) {
  intencion = 'entregable'; sub_intencion = /registr|crear|agregar/i.test(low) ? 'registrar' : 'pendientes'; canal_destino = 'DISCORD_CHANNEL_ENTREGABLES';
} else if (/retrospectiva|retro|qu[eé] sali[oó] bien|qu[eé] mejorar|lecciones aprendidas/i.test(low)) {
  intencion = 'retrospectiva'; sub_intencion = /listar|lista|ver|resumen|mostrar/i.test(low) ? 'listar' : 'registrar';
} else if (/estado (actual|del proyecto|de petsafe)|resume(n|me)|c[oó]mo va(mos)?|overview/i.test(low)) {
  intencion = 'estado_proyecto'; sub_intencion = 'general';
} else if (/ayuda|help|c[oó]mo (te uso|funciona)/i.test(low)) {
  intencion = 'ayuda';
}

applyChannelDefault();

datos.responsable = match(/(?:asigna(?:r|le)?\s+a\s+|responsable:?\s*|para\s+)(@[^\s]+|[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/);
datos.fecha_limite = parseDate(match(/(?:para|antes del?|fecha:?|limite:?|l[ií]mite:?)\s+(\d{4}-\d{2}-\d{2}|ma[nñ]ana|hoy|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)/i));
datos.prioridad = normalizePriority(match(/prioridad:?\s*(baja|media|alta|cr[ií]tica)/i));
datos.estado = normalizeState(match(/estado:?\s*([a-záéíóúñ_ ]+)/i));
datos.id = Number(match(/#?(\d+)/)) || null;
datos.porcentaje = Number(match(/(\d{1,3})\s*%/)) || null;
datos.probabilidad = match(/probabilidad:?\s*(baja|media|alta)/i);
datos.impacto = match(/impacto:?\s*(bajo|medio|alto|cr[ií]tico)/i);
datos.dias = clampDays(
  cmdParts.find((p, idx) => idx > 0 && /^\d{1,3}$/.test(p)) ||
  msg.match(/(?:u[uú]ltimos?|rango|dias|d[ií]as)\D{0,12}(\d{1,3})/i)?.[1]
);
datos.fase = match(/(?:fase|hito|lista):?\s*([^,;\n]+)/i);
datos.fecha_inicio = parseDate(match(/(?:inicio|desde):?\s+(\d{4}-\d{2}-\d{2}|ma[nñ]ana|hoy|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)/i));
datos.fecha_reunion = parseDate(match(/(?:cuando|cu[aá]ndo|fecha|para):?\s+(\d{4}-\d{2}-\d{2}|ma[nñ]ana|hoy|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)/i));
datos.hora_reunion = match(/(?:hora|a las|desde las)\s*([01]?\d|2[0-3])(?::([0-5]\d))?/i);
datos.lugar = match(/(?:donde|d[oó]nde|lugar|ubicacion|ubicaci[oó]n):?\s*([^,;\n]+?)(?=\s+(?:participantes|asistentes|con|duracion|duraci[oó]n|minutos|cuando|cu[aá]ndo|fecha|hora):?\s|$)/i);
datos.participantes = match(/(?:con|participan|participantes|asistentes):?\s*([^;\n]+)/i);
datos.legacy_command = legacyCommand;
datos.channel_role = channelRole;
datos.texto_original = msg;
datos.texto = datos.texto || msg;

if (['bloqueos','impedimentos','riesgos','decisiones','retrospectivas','reuniones','entregables'].includes(cmd) && !sub) {
  sub_intencion = 'listar';
}

if (legacyCommand) {
  intencion = 'desconocido';
  sub_intencion = 'legacy_prefix';
}

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
    channel_role: channelRole,
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
  channel_role: channelRole,
  mensaje_original: msg,
  es_comando: isCommand,
  missing_config,
  channels,
  timestamp: new Date().toISOString()
}}];
});

const helpCode = code(function(){
const topic = String($json.sub_intencion || $json.channel_role || 'general').toLowerCase();
const role = ['tareas','avances','bloqueos','riesgos','reportes','reuniones','entregables','admin','general'].includes(topic)
  ? topic
  : ($json.channel_role || 'general');
const sections = {
  tareas: [
    '**Ayuda PM - tareas**',
    'Este canal es para crear, asignar, listar y actualizar tareas. Si escribes una tarea sin comando, la interpreto como tarea nueva.',
    '`/pm tarea crear [titulo] fase: Pruebas responsable: Barragan limite: 2026-05-30 prioridad: alta`',
    '`/pm tarea listar` muestra tareas por fase/hito',
    '`/pm pendientes` muestra pendientes accionables por urgencia',
    '`/pm atrasos` muestra vencidas',
    '`/pm tarea actualizar #12 estado: en_progreso prioridad: alta`',
    '`/pm tarea asignar #12 responsable: Barragan`',
    'Estados: pendiente, en_progreso, bloqueada, en_revision, completada, cancelada. Prioridades: baja, media, alta, critica.'
  ],
  avances: [
    '**Ayuda PM - avances**',
    'Este canal es para registrar progreso real del equipo. Si escribes sin comando, lo interpreto como avance.',
    '`/pm avance registrar #12 40% descripcion del avance`',
    '`/pm avance resumen` muestra avances de hoy',
    'Incluye ID de tarea y porcentaje cuando aplique para que el seguimiento sea util.'
  ],
  bloqueos: [
    '**Ayuda PM - bloqueos e impedimentos**',
    'Este canal es para impedimentos que detienen trabajo. Si escribes sin comando, lo registro como bloqueo.',
    '`/pm bloqueo registrar descripcion prioridad: alta tarea: #12 responsable: Manjarres`',
    '`/pm bloqueo listar`',
    '`/pm bloqueo cerrar #3`',
    'El bot clasifica area de aplicacion y propone accion de desbloqueo.'
  ],
  riesgos: [
    '**Ayuda PM - riesgos**',
    'Este canal es para amenazas potenciales. Si escribes sin comando, lo registro como riesgo.',
    '`/pm riesgo registrar descripcion probabilidad: alta impacto: critico mitigacion: plan`',
    '`/pm riesgo listar`',
    '`/pm riesgo mitigar #2`',
    'La prioridad se calcula con probabilidad e impacto.'
  ],
  reportes: [
    '**Ayuda PM - reportes y KPIs**',
    'Este canal concentra estado ejecutivo, reportes y lectura PM del proyecto.',
    '`/pm estado` o `/estado`',
    '`/pm reporte diario`, `/pm reporte semanal`, `/pm reporte 14`, `/reporte 7`',
    '`/pm kpis 7` o `/kpis 7`',
    'Usa rangos de 1 a 90 dias.'
  ],
  reuniones: [
    '**Ayuda PM - reuniones, decisiones y acuerdos**',
    'Este canal es para preparar/agendar reuniones y dejar trazabilidad de decisiones.',
    '`/pm reunion agendar tema cuando: 2026-05-27 hora: 10:00 donde: videollamada participantes: todos`',
    '`/pm reunion actualizar #2 cuando: 2026-05-28 hora: 11:00 participantes: todos`',
    '`/pm reunion cancelar #2`',
    '`/pm reunion acta #2 acuerdos: ... compromisos: ... decisiones: ...`',
    '`/pm reunion listar`',
    '`/pm decision registrar usaremos Contabo como VPS`',
    '`/pm decision listar`',
    '`/pm retrospectiva accion mejorar evidencias responsable: David`'
  ],
  entregables: [
    '**Ayuda PM - entregables**',
    'Este canal es para entregables, evidencias, documentos, versiones y fechas limite.',
    '`/pm entregable registrar Project Charter responsable: Joel limite: 2026-06-01`',
    '`/pm entregable listar`',
    'Incluye responsable, fecha limite y enlace/evidencia cuando exista.'
  ],
  admin: [
    '**Ayuda PM - admin**',
    'Este canal es solo para salud del bot, variables, auditoria y outbox.',
    '`/pm admin estado`',
    'Si se ejecuta fuera de #admin-bot, el bot lo bloquea.'
  ],
  general: [
    '**PetSafe PM Bot - organizacion por canales**',
    'Prefijo unico: `/`. Puedes escribir comandos desde cualquier canal PM, pero la respuesta se publica en el canal propietario del tema.',
    '#tareas: tareas, pendientes y atrasos.',
    '#avances: progreso diario y porcentajes.',
    '#bloqueos: impedimentos que frenan trabajo.',
    '#riesgos: amenazas potenciales y mitigaciones.',
    '#reportes: estado, reportes y KPIs.',
    '#reuniones: reuniones, decisiones y acuerdos.',
    '#entregables: evidencias/documentos/versiones.',
    '#admin-bot: salud/configuracion/outbox.',
    '',
    'Pide `/ayuda` dentro de un canal para ver ayuda contextual o usa `/pm ayuda general` para esta vista.'
  ]
};
const text = (sections[role] || sections.general).join('\n');
return [{ json: { respuesta: text, canal_destino: $json.canal_destino || 'DISCORD_CHANNEL_REPORTES', canal_id: $json.canal_origen || process.env.DISCORD_CHANNEL_REPORTES } }];
});

const fallbackCode = code(function(){
const datos = $json.datos || {};
if (datos.legacy_command) {
  return [{ json: {
    respuesta: 'Los comandos del bot quedaron estandarizados con `/`. Prueba `/pm ayuda`, `/kpis 7` o `/reporte 7`.',
    canal_destino: 'DISCORD_CHANNEL_REPORTES',
    canal_id: process.env.DISCORD_CHANNEL_REPORTES || $json.canal_origen,
    intencion: 'legacy_prefix'
  }}];
}
const role = $json.channel_role || datos.channel_role || '';
const hints = {
  tareas: 'Este es el canal de tareas. Puedes usar `/pm tarea crear ...`, `/pm tarea listar`, `/pm pendientes` o escribir una tarea con responsable/fecha.',
  avances: 'Este es el canal de avances. Puedes usar `/pm avance registrar #12 40% descripcion` o escribir el avance directamente.',
  bloqueos: 'Este es el canal de bloqueos. Puedes usar `/pm bloqueo registrar ...` o `/pm bloqueo listar`.',
  riesgos: 'Este es el canal de riesgos. Puedes usar `/pm riesgo registrar ...` o `/pm riesgo listar`.',
  reportes: 'Este es el canal de reportes. Puedes usar `/reporte 7`, `/kpis 7` o `/estado`.',
  reuniones: 'Este es el canal de reuniones. Puedes usar `/pm reunion agendar ... cuando: YYYY-MM-DD hora: HH:mm` o `/pm decision listar`.',
  entregables: 'Este es el canal de entregables. Puedes usar `/pm entregable registrar ...` o `/pm entregable listar`.',
  admin: 'Este es el canal admin. Puedes usar `/pm admin estado`.'
};
if (hints[role]) {
  return [{ json: {
    respuesta: hints[role],
    canal_destino: $json.canal_destino || 'DISCORD_CHANNEL_BOT_LOG',
    canal_id: $json.canal_origen || process.env.DISCORD_CHANNEL_BOT_LOG,
    intencion: 'ayuda_contextual'
  }}];
}
return [{ json: {
  respuesta: 'No pude identificar completamente la accion. Puedes pedirme crear una tarea, registrar avance, listar bloqueos/riesgos/decisiones, generar `/reporte 7`, consultar `/kpis 7` o revisar pendientes.',
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
      switchEqualsRule('tarea', 'tarea'),
      switchEqualsRule('avance', 'avance'),
      switchEqualsRule('bloqueo', 'bloqueo'),
      switchEqualsRule('riesgo', 'riesgo'),
      switchEqualsRule('reporte', 'reporte'),
      switchEqualsRule('reunion', 'reunion'),
      switchEqualsRule('decision', 'decision'),
      switchEqualsRule('entregable', 'entregable'),
      switchEqualsRule('retrospectiva', 'retrospectiva'),
      switchEqualsRule('estado_proyecto', 'estado'),
      switchEqualsRule('recordatorio', 'recordatorio'),
      switchEqualsRule('ayuda', 'ayuda'),
      switchEqualsRule('administracion', 'admin'),
      switchEqualsRule('administracion_denegada', 'admin_denegada'),
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
  { ...pgNode('audit-router', 'Audit PM Command', [1360, 360], auditRouterQuery, {
    queryReplacement: '={{ [ $("Classify Intent").item.json.mensaje_original, $("Classify Intent").item.json.intencion, $("Classify Intent").item.json.usuario, $("Classify Intent").item.json.canal_origen, JSON.stringify($("Classify Intent").item.json.datos || {}), $("Merge PM Results").item.json.respuesta || "" ] }}',
  }), continueOnFail: true },
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
const VALID_PRIORITIES = ['baja','media','alta','critica'];
const VALID_STATES = ['pendiente','en_progreso','bloqueada','en_revision','completada','cancelada'];
const TEAM = [
  'David Manjarres',
  'David Josue Barragan Pozo',
  'Josue Joel Garcia Abata',
  'Fernando Joel Bonilla Guerrero',
  'Joel Bonilla'
];
function cleanField(value) {
  return String(value || '').replace(/\s+(responsable|prioridad|estado|limite|l[ií]mite|fase|hito|lista|inicio|desde):?.*$/i, '').trim();
}
function parseField(name) {
  const rx = new RegExp('(?:' + name + '):?\\s*([^,;\\n]+?)(?=\\s+(?:responsable|prioridad|estado|limite|l[ií]mite|fase|hito|lista|inicio|desde):?\\s|$)', 'i');
  return raw.match(rx)?.[1]?.trim() || null;
}
function normalizeState(value) {
  const v = norm(value).replace(/\s+/g, '_');
  const map = { progreso: 'en_progreso', revision: 'en_revision', revisar: 'en_revision', hecho: 'completada', terminado: 'completada', terminada: 'completada' };
  return VALID_STATES.includes(v) ? v : (map[v] || null);
}
function resolvePerson(value) {
  const input = cleanField(value);
  if (!input) return { status: 'empty', value: null, matches: [] };
  const wanted = norm(input).split(/\s+/).filter(Boolean);
  const matches = TEAM.filter((name) => wanted.every((part) => norm(name).includes(part)));
  if (matches.length === 1) return { status: 'ok', value: matches[0], matches };
  if (matches.length > 1) return { status: 'ambiguous', value: input, matches };
  return { status: 'unknown', value: input, matches: [] };
}

const priorityText = datos.prioridad || raw.match(/prioridad:?\s*([^,;\n]+?)(?=\s+(?:responsable|estado|limite|l[ií]mite|fase|hito|lista|inicio|desde):?\s|$)/i)?.[1]?.trim();
const stateText = datos.estado || raw.match(/estado:?\s*([^,;\n]+?)(?=\s+(?:responsable|prioridad|limite|l[ií]mite|fase|hito|lista|inicio|desde):?\s|$)/i)?.[1]?.trim();
const prio = priorityText ? norm(priorityText) : 'media';
if (priorityText && !VALID_PRIORITIES.includes(prio)) {
  return [{ json: { action: 'validation_error', respuesta: 'Prioridad no valida. Usa una de estas: baja, media, alta, critica.', canal_destino: 'DISCORD_CHANNEL_TAREAS', canal_id: process.env.DISCORD_CHANNEL_TAREAS || ctx.canal_origen } }];
}
let estado = stateText ? normalizeState(stateText) : null;
if (stateText && !estado) {
  return [{ json: { action: 'validation_error', respuesta: 'Estado no valido. Usa uno de estos: pendiente, en_progreso, bloqueada, en_revision, completada, cancelada.', canal_destino: 'DISCORD_CHANNEL_TAREAS', canal_id: process.env.DISCORD_CHANNEL_TAREAS || ctx.canal_origen } }];
}
const colonResponsible = ['crear','nueva','registrar','asignar','assign'].includes(sub)
  ? raw.match(/:\s*([A-ZÁÉÍÓÚÑa-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+){0,3})(?=\s+(?:limite|l[ií]mite|prioridad|estado|fase|hito|lista|inicio|desde)\b|$)/)?.[1]?.trim()
  : null;
const responsableInput = datos.responsable || parseField('responsable') || raw.match(/asigna(?:r|le)?\s+a\s+([^,;\n]+)/i)?.[1]?.trim() || colonResponsible || null;
const resolved = resolvePerson(responsableInput);
if (responsableInput && resolved.status === 'ambiguous') {
  return [{ json: { action: 'validation_error', respuesta: `Responsable ambiguo: "${resolved.value}". Coincide con: ${resolved.matches.join(', ')}. Especifica nombre y apellido, por ejemplo responsable: Barragan o responsable: Fernando Bonilla.`, canal_destino: 'DISCORD_CHANNEL_TAREAS', canal_id: process.env.DISCORD_CHANNEL_TAREAS || ctx.canal_origen } }];
}
if (responsableInput && resolved.status === 'unknown') {
  return [{ json: { action: 'validation_error', respuesta: `No pude identificar al responsable "${resolved.value}". Usa un nombre claro del equipo: ${TEAM.join(', ')}.`, canal_destino: 'DISCORD_CHANNEL_TAREAS', canal_id: process.env.DISCORD_CHANNEL_TAREAS || ctx.canal_origen } }];
}
const responsable = resolved.status === 'ok' ? resolved.value : null;
const fecha = datos.fecha_limite || raw.match(/(?:limite|l[ií]mite|vence|fecha):?\s*(\d{4}-\d{2}-\d{2})/i)?.[1] || raw.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || null;
const fechaInicio = datos.fecha_inicio || raw.match(/(?:inicio|desde):?\s*(\d{4}-\d{2}-\d{2})/i)?.[1] || null;
const entregable = raw.match(/entregable:?\s*([^,;\n]+)/i)?.[1]?.trim() || null;
const fase = cleanField(datos.fase || parseField('fase|hito|lista') || raw.match(/sprint:?\s*([^,;\n]+)/i)?.[1]?.trim() || '');
const cleaned = raw
  .replace(/^\/pm\s+tarea\s+\w+/i, '')
  .replace(/^\/tarea\s+\w+/i, '')
  .replace(/responsable:?\s*[^,;\n]+/ig, '')
  .replace(/prioridad:?\s*(baja|media|alta|cr[ií]tica)/ig, '')
  .replace(/estado:?\s*[^,;\n]+/ig, '')
  .replace(/(?:fase|hito|lista|sprint):?\s*[^,;\n]+/ig, '')
  .replace(/(?:inicio|desde):?\s*\d{4}-\d{2}-\d{2}/ig, '')
  .replace(/limite:?\s*\d{4}-\d{2}-\d{2}/ig, '')
  .replace(/l[ií]mite:?\s*\d{4}-\d{2}-\d{2}/ig, '')
  .replace(/:\s*[A-ZÁÉÍÓÚÑa-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+){0,3}\s*$/i, '')
  .replace(/#\d+/g, '')
  .trim();
const titulo = cleaned || datos.titulo || datos.texto || 'Tarea sin titulo';

let query;
let action = sub;
if (['crear','nueva','registrar'].includes(sub)) {
  query = `WITH ins AS (
  INSERT INTO pm_tareas (titulo, descripcion, responsable, prioridad, estado, fecha_inicio, fecha_limite, entregable, sprint, creado_por, canal_origen)
  VALUES (${q(titulo)}, ${q(raw)}, ${q(responsable)}, ${q(prio)}, 'pendiente', ${fechaInicio ? q(fechaInicio) + '::date' : 'NULL'}, ${fecha ? q(fecha) + '::date' : 'NULL'}, ${q(entregable)}, COALESCE(${q(fase)}, (SELECT name FROM project_phases WHERE status='active' ORDER BY position DESC LIMIT 1), 'Sin fase'), ${q(ctx.usuario)}, ${q(ctx.canal_origen)})
  RETURNING *
)
SELECT 'created' AS action, ins.id, ins.titulo, ins.descripcion, ins.responsable, ins.prioridad, ins.estado, ins.fecha_inicio, ins.fecha_limite, ins.entregable, ins.sprint, ins.trello_card_id,
  (SELECT list_id FROM project_phases p WHERE p.name = ins.sprint ORDER BY p.position DESC LIMIT 1) AS trello_list_id
FROM ins;`;
} else if (['asignar','assign'].includes(sub)) {
  if (!id || !responsable) {
    return [{ json: { action: 'validation_error', respuesta: 'Faltan datos para asignar la tarea. Indica ID y responsable. Ejemplo: `/pm tarea asignar #12 responsable: David`', canal_destino: 'DISCORD_CHANNEL_TAREAS', canal_id: process.env.DISCORD_CHANNEL_TAREAS || ctx.canal_origen } }];
  }
  query = `WITH upd AS (
  UPDATE pm_tareas SET responsable=${q(responsable)}, fecha_actualizacion=NOW() WHERE id=${id} RETURNING *
)
SELECT 'assigned' AS action, upd.id, upd.titulo, upd.descripcion, upd.responsable, upd.prioridad, upd.estado, upd.fecha_inicio, upd.fecha_limite, upd.entregable, upd.sprint, upd.trello_card_id,
  (SELECT list_id FROM project_phases p WHERE p.name = upd.sprint ORDER BY p.position DESC LIMIT 1) AS trello_list_id
FROM upd;`;
} else if (['actualizar','update','estado'].includes(sub)) {
  if (!id) {
    return [{ json: { action: 'validation_error', respuesta: 'Falta el ID de la tarea para actualizar. Ejemplo: `/pm tarea actualizar #12 estado: en_revision`', canal_destino: 'DISCORD_CHANNEL_TAREAS', canal_id: process.env.DISCORD_CHANNEL_TAREAS || ctx.canal_origen } }];
  }
  const updates = [`fecha_actualizacion=NOW()`];
  if (estado) updates.push(`estado=${q(estado)}`);
  if (priorityText) updates.push(`prioridad=${q(prio)}`);
  if (responsable) updates.push(`responsable=${q(responsable)}`);
  if (fecha) updates.push(`fecha_limite=${q(fecha)}::date`);
  if (fechaInicio) updates.push(`fecha_inicio=${q(fechaInicio)}::date`);
  if (fase) updates.push(`sprint=${q(fase)}`);
  if (updates.length === 1) {
    return [{ json: { action: 'validation_error', respuesta: 'No encontre campos para actualizar. Puedes usar estado, prioridad, responsable, fase, inicio o limite. Estados: pendiente, en_progreso, bloqueada, en_revision, completada, cancelada. Prioridades: baja, media, alta, critica.', canal_destino: 'DISCORD_CHANNEL_TAREAS', canal_id: process.env.DISCORD_CHANNEL_TAREAS || ctx.canal_origen } }];
  }
  query = `WITH upd AS (
  UPDATE pm_tareas SET ${updates.join(', ')} WHERE id=${id} RETURNING *
)
SELECT 'updated' AS action, upd.id, upd.titulo, upd.descripcion, upd.responsable, upd.prioridad, upd.estado, upd.fecha_inicio, upd.fecha_limite, upd.entregable, upd.sprint, upd.trello_card_id,
  (SELECT list_id FROM project_phases p WHERE p.name = upd.sprint ORDER BY p.position DESC LIMIT 1) AS trello_list_id
FROM upd;`;
} else if (['atrasos','vencidas','vencidos'].includes(sub)) {
  query = `SELECT 'overdue' AS action, id, titulo, responsable, prioridad, estado, fecha_limite, (CURRENT_DATE - fecha_limite::date) AS dias_atraso
FROM pm_tareas WHERE fecha_limite < CURRENT_DATE AND estado NOT IN ('completada','cancelada')
ORDER BY dias_atraso DESC, prioridad LIMIT 20;`;
} else {
  action = ['pendientes','listar','lista','list'].includes(sub) ? sub : 'listar';
  if (action === 'pendientes') {
    query = `SELECT 'pending' AS action, id, titulo, responsable, prioridad, estado, fecha_limite, entregable, sprint,
CASE WHEN fecha_limite < CURRENT_DATE THEN 'atrasada' WHEN fecha_limite <= CURRENT_DATE + INTERVAL '3 days' THEN 'proxima' ELSE 'normal' END AS urgencia
FROM pm_tareas WHERE estado NOT IN ('completada','cancelada')
ORDER BY CASE WHEN fecha_limite < CURRENT_DATE THEN 0 WHEN fecha_limite <= CURRENT_DATE + INTERVAL '3 days' THEN 1 ELSE 2 END,
CASE prioridad WHEN 'critica' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END, fecha_limite NULLS LAST LIMIT 25;`;
  } else {
    query = `SELECT 'list_by_phase' AS action, id, titulo, responsable, prioridad, estado, fecha_limite, entregable, COALESCE(sprint, entregable, 'Sin fase') AS sprint
FROM pm_tareas WHERE estado NOT IN ('completada','cancelada')
ORDER BY COALESCE(sprint, entregable, 'Sin fase'), fecha_limite NULLS LAST, CASE prioridad WHEN 'critica' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END LIMIT 30;`;
  }
}
return [{ json: { query, action, canal_destino: 'DISCORD_CHANNEL_TAREAS', canal_id: process.env.DISCORD_CHANNEL_TAREAS || ctx.canal_origen } }];
});

const taskFormatCode = code(function(){
const ctx = $('Build Task Query').item.json;
if (ctx.respuesta) return [{ json: ctx }];
let rows = [];
try { rows = $('Run Task Query').all().map(i => i.json); } catch (e) { rows = $input.all().map(i => i.json); }
const action = rows[0]?.action || ctx.action;
let trello = { status: 'no_aplica' };
try { trello = $('Build Trello Sync').item.json.trello_sync || trello; } catch (e) {}
try {
  const card = $('Trello Upsert Card').item.json;
  if (card?.id) trello = { status: 'sincronizado', card_id: card.id, url: card.shortUrl || card.url || '' };
  else if (trello.status === 'pendiente') trello = { status: 'fallo', detalle: 'Trello no devolvio id de tarjeta.' };
} catch (e) {}
const lineTask = (t) => `#${t.id} [${t.estado || 'sin_estado'}/${t.prioridad || 'media'}] ${t.titulo} - ${t.responsable || 'sin responsable'}${t.fecha_limite ? ' - vence ' + t.fecha_limite : ''}`;
function groupBy(items, keyFn) {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});
}
function trelloLine() {
  if (trello.status === 'sincronizado') return `\nTrello: sincronizado${trello.card_id ? ' (' + trello.card_id + ')' : ''}${trello.url ? ' - ' + trello.url : ''}.`;
  if (trello.status === 'omitido') return `\nTrello: no sincronizado (${trello.detalle}).`;
  if (trello.status === 'fallo') return `\nTrello: pendiente de revisar (${trello.detalle}).`;
  return '';
}
let respuesta;
if (!rows.length) {
  respuesta = action === 'overdue' ? 'No hay tareas atrasadas. El proyecto va en tiempo.' : 'No hay tareas activas registradas.';
} else if (action === 'created') {
  const t = rows[0];
  respuesta = `Tarea registrada.\nID: #${t.id}\nTitulo: ${t.titulo}\nFase/hito: ${t.sprint || 'Sin fase'}\nResponsable: ${t.responsable || 'sin asignar'}\nInicio: ${t.fecha_inicio || 'sin fecha'}\nFecha limite: ${t.fecha_limite || 'sin fecha'}\nPrioridad: ${t.prioridad}${trelloLine()}\nProximo paso: registrar avance con /pm avance registrar #${t.id}.`;
} else if (action === 'assigned') {
  const t = rows[0];
  respuesta = `Tarea asignada.\nID: #${t.id}\nTitulo: ${t.titulo}\nResponsable: ${t.responsable}${trelloLine()}\nProximo paso: registrar avance con /pm avance registrar #${t.id}.`;
} else if (action === 'updated') {
  const t = rows[0];
  respuesta = `Tarea actualizada.\nID: #${t.id}\nEstado: ${t.estado}\nPrioridad: ${t.prioridad}\nFase/hito: ${t.sprint || 'Sin fase'}\nResponsable: ${t.responsable || 'sin asignar'}${trelloLine()}\nValores permitidos: estados pendiente, en_progreso, bloqueada, en_revision, completada, cancelada; prioridades baja, media, alta, critica.`;
} else if (action === 'overdue') {
  respuesta = `Tareas atrasadas (${rows.length}):\n` + rows.map(t => `- ${lineTask(t)} - atraso: ${t.dias_atraso} dia(s)`).join('\n') + '\nRecomendacion PM: revisar responsables y bloqueos activos hoy.';
} else if (action === 'pending') {
  const labels = { atrasada: 'Atrasadas', proxima: 'Vencen pronto', normal: 'En curso sin urgencia inmediata' };
  const groups = groupBy(rows, t => t.urgencia || 'normal');
  const lines = [`Pendientes accionables (${rows.length}):`];
  ['atrasada','proxima','normal'].forEach((key) => {
    if (groups[key]?.length) {
      lines.push('', labels[key] + ':', ...groups[key].map(t => `- ${lineTask(t)}`));
    }
  });
  respuesta = lines.join('\n');
} else {
  const groups = groupBy(rows, t => t.sprint || t.entregable || 'Sin fase');
  const lines = [`Tareas por fase/hito (${rows.length}):`];
  Object.keys(groups).forEach((fase) => {
    lines.push('', fase + ':', ...groups[fase].map(t => `- ${lineTask(t)}`));
  });
  respuesta = lines.join('\n');
}
return [{ json: { respuesta, canal_destino: ctx.canal_destino, canal_id: ctx.canal_id, storage: 'postgres:pm_tareas' } }];
});

const taskTrelloSyncCode = code(function(){
const rows = $('Run Task Query').all().map(i => i.json);
const task = rows[0] || {};
const syncable = ['created','assigned','updated'].includes(task.action);
if (!syncable) {
  return [{ json: { needs_sync: false, trello_sync: { status: 'no_aplica' } } }];
}

const defaultListId = process.env.TRELLO_DEFAULT_LIST_ID || process.env.TRELLO_TASKS_LIST_ID || '';
const listId = task.trello_list_id || defaultListId;
if (!task.trello_card_id && !listId) {
  return [{ json: { needs_sync: false, trello_sync: { status: 'omitido', detalle: 'falta TRELLO_DEFAULT_LIST_ID o una fase vinculada a lista Trello' }, task_id: task.id } }];
}

function memberMap() {
  try { return JSON.parse(process.env.TRELLO_MEMBER_MAP_JSON || '{}'); } catch (e) { return {}; }
}
function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function memberIdFor(name) {
  const map = memberMap();
  const direct = map[name] || map[norm(name)];
  if (direct) return direct;
  const hit = Object.entries(map).find(([k]) => norm(k) === norm(name));
  return hit ? hit[1] : '';
}

const params = new URLSearchParams();
params.set('name', `#${task.id} ${task.titulo}`.slice(0, 160));
params.set('desc', String(task.descripcion || task.titulo || '').slice(0, 1500));
if (listId) params.set('idList', listId);
if (task.fecha_limite) params.set('due', task.fecha_limite);
if (task.fecha_inicio) params.set('start', task.fecha_inicio);
if (task.estado === 'completada') params.set('dueComplete', 'true');
if (task.estado && task.estado !== 'completada') params.set('dueComplete', 'false');
if (task.responsable) {
  const memberId = memberIdFor(task.responsable);
  if (memberId) params.set('idMembers', memberId);
}

const method = task.trello_card_id ? 'PUT' : 'POST';
const path = task.trello_card_id ? `/cards/${task.trello_card_id}` : '/cards';
return [{ json: {
  needs_sync: true,
  method,
  url: `https://api.trello.com/1${path}?${params.toString()}`,
  task_id: task.id,
  existing_card_id: task.trello_card_id || '',
  trello_sync: { status: 'pendiente' }
}}];
});

writeWorkflow(path.join(pmoDir, 'WF_PM_Tareas.json'), workflow('wf-pm-tareas', 'WF_PM_Tareas', [
  trigger,
  node('build-task', 'Build Task Query', 'n8n-nodes-base.code', 2, [240, 0], { jsCode: taskBuildCode }),
  node('task-valid?', 'Task Validation Error?', 'n8n-nodes-base.if', 2.2, [500, 0], {
    conditions: { options: { caseSensitive: true, typeValidation: 'loose' }, conditions: [{ id: 'has-response', leftValue: '={{ $json.respuesta }}', rightValue: '', operator: { type: 'string', operation: 'notEmpty', singleValue: true } }], combinator: 'and' },
    options: {},
  }),
  pgNode('run-task', 'Run Task Query', [760, 120], '={{ $json.query }}'),
  node('build-trello-sync', 'Build Trello Sync', 'n8n-nodes-base.code', 2, [1000, 120], { jsCode: taskTrelloSyncCode }),
  node('need-trello-sync?', 'Need Trello Sync?', 'n8n-nodes-base.if', 2.2, [1220, 120], {
    conditions: { options: { caseSensitive: true, typeValidation: 'loose' }, conditions: [{ id: 'needs-sync', leftValue: '={{ $json.needs_sync ? 1 : 0 }}', rightValue: 1, operator: { type: 'number', operation: 'equals' } }], combinator: 'and' },
    options: {},
  }),
  node('trello-upsert-card', 'Trello Upsert Card', 'n8n-nodes-base.httpRequest', 4.2, [1460, 40], {
    method: '={{ $json.method }}',
    url: '={{ $json.url }}',
    authentication: 'predefinedCredentialType',
    nodeCredentialType: 'trelloApi',
    options: {},
  }, {
    credentials: {
      trelloApi: {
        id: 'FWpamR2TOOuzCYJv',
        name: 'Trello account',
      },
    },
    continueOnFail: true,
    alwaysOutputData: true,
  }),
  { ...pgNode('store-trello-card', 'Store Trello Card Id', [1680, 40], `WITH upd AS (
  UPDATE pm_tareas
  SET trello_card_id = COALESCE(trello_card_id, $1), fecha_actualizacion = NOW()
  WHERE id = $2 AND $1 IS NOT NULL
  RETURNING trello_card_id
)
SELECT COALESCE((SELECT trello_card_id FROM upd), $1) AS trello_card_id;`, {
    queryReplacement: '={{ [ $json.id || $("Build Trello Sync").item.json.existing_card_id || null, $("Build Trello Sync").item.json.task_id ] }}',
  }), continueOnFail: true, alwaysOutputData: true },
  node('format-task', 'Format Task Response', 'n8n-nodes-base.code', 2, [1900, 120], { jsCode: taskFormatCode }),
], {
  'Execute Workflow Trigger': { main: [[{ node: 'Build Task Query', type: 'main', index: 0 }]] },
  'Build Task Query': { main: [[{ node: 'Task Validation Error?', type: 'main', index: 0 }]] },
  'Task Validation Error?': { main: [[{ node: 'Format Task Response', type: 'main', index: 0 }], [{ node: 'Run Task Query', type: 'main', index: 0 }]] },
  'Run Task Query': { main: [[{ node: 'Build Trello Sync', type: 'main', index: 0 }]] },
  'Build Trello Sync': { main: [[{ node: 'Need Trello Sync?', type: 'main', index: 0 }]] },
  'Need Trello Sync?': { main: [[{ node: 'Trello Upsert Card', type: 'main', index: 0 }], [{ node: 'Format Task Response', type: 'main', index: 0 }]] },
  'Trello Upsert Card': { main: [[{ node: 'Store Trello Card Id', type: 'main', index: 0 }]] },
  'Store Trello Card Id': { main: [[{ node: 'Format Task Response', type: 'main', index: 0 }]] },
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
const sub = String(ctx.sub_intencion || 'registrar').toLowerCase();
const q = (v) => v === null || v === undefined || v === '' ? 'NULL' : "'" + String(v).replace(/'/g, "''") + "'";
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const intencion = ctx.intencion;
const taskId = Number(datos.id || raw.match(/#?(\d+)/)?.[1] || 0) || null;
if (['listar','lista','ver'].includes(sub)) {
  const query = intencion === 'riesgo'
    ? `SELECT 'risk_list' AS action, id, descripcion, probabilidad, impacto, prioridad_calculada, mitigacion, responsable, estado, fecha_creacion FROM pm_riesgos WHERE estado = 'abierto' ORDER BY CASE prioridad_calculada WHEN 'critica' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END, fecha_creacion DESC LIMIT 15;`
    : `SELECT 'blocker_list' AS action, id, descripcion, responsable_afectado, tarea_id, severidad, accion_recomendada, estado, fecha_creacion FROM pm_bloqueos WHERE estado <> 'resuelto' ORDER BY CASE severidad WHEN 'critica' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END, fecha_creacion DESC LIMIT 15;`;
  return [{ json: { query, mode: 'list', canal_destino: intencion === 'riesgo' ? 'DISCORD_CHANNEL_RIESGOS' : 'DISCORD_CHANNEL_BLOQUEOS', canal_id: process.env[intencion === 'riesgo' ? 'DISCORD_CHANNEL_RIESGOS' : 'DISCORD_CHANNEL_BLOQUEOS'] || ctx.canal_origen } }];
}
if (['cerrar','resolver','mitigar'].includes(sub) && taskId) {
  const query = intencion === 'riesgo'
    ? `UPDATE pm_riesgos SET estado='mitigado', fecha_actualizacion=NOW() WHERE id=${taskId} RETURNING 'risk_closed' AS action, id, descripcion, estado;`
    : `UPDATE pm_bloqueos SET estado='resuelto', fecha_resolucion=NOW() WHERE id=${taskId} RETURNING 'blocker_closed' AS action, id, descripcion, estado;`;
  return [{ json: { query, mode: 'close', canal_destino: intencion === 'riesgo' ? 'DISCORD_CHANNEL_RIESGOS' : 'DISCORD_CHANNEL_BLOQUEOS', canal_id: process.env[intencion === 'riesgo' ? 'DISCORD_CHANNEL_RIESGOS' : 'DISCORD_CHANNEL_BLOQUEOS'] || ctx.canal_origen } }];
}
const sev = ['baja','media','alta','critica'].includes(norm(datos.prioridad)) ? norm(datos.prioridad) : (/crit|urg/i.test(raw) ? 'critica' : /alta|bloquea/i.test(raw) ? 'alta' : 'media');
const prob = ['baja','media','alta'].includes(norm(datos.probabilidad)) ? norm(datos.probabilidad) : (/probabilidad alta|muy probable/i.test(raw) ? 'alta' : 'media');
const impactoRaw = norm(datos.impacto || '');
const impacto = ['bajo','medio','alto','critico'].includes(impactoRaw) ? impactoRaw : (/crit|grave/i.test(raw) ? 'critico' : /alto/i.test(raw) ? 'alto' : 'medio');
const prioMap = { 'baja-bajo': 'baja', 'baja-medio': 'baja', 'baja-alto': 'media', 'baja-critico': 'alta', 'media-bajo': 'baja', 'media-medio': 'media', 'media-alto': 'alta', 'media-critico': 'critica', 'alta-bajo': 'media', 'alta-medio': 'alta', 'alta-alto': 'critica', 'alta-critico': 'critica' };
function areaFrom(text) {
  if (/backend|api|servidor|base de datos|db/i.test(text)) return 'backend/datos';
  if (/frontend|interfaz|ui|pantalla|angular/i.test(text)) return 'frontend';
  if (/testing|prueba|qa|test/i.test(text)) return 'testing/QA';
  if (/deploy|despliegue|vps|contabo|infra|servidor/i.test(text)) return 'infraestructura/despliegue';
  if (/cliente|usuario|firma|consentimiento|reunion/i.test(text)) return 'stakeholders';
  return 'gestion del proyecto';
}
function cleanDesc(text) {
  return String(text || '')
    .replace(/^\/pm\s+(bloqueo|bloqueos|impedimento|impedimentos|riesgo|riesgos)\s+\w+/i, '')
    .replace(/^\/(bloqueo|bloqueos|impedimento|impedimentos|riesgo|riesgos)\s*/i, '')
    .replace(/prioridad:?\s*(baja|media|alta|cr[ií]tica)/ig, '')
    .replace(/probabilidad:?\s*(baja|media|alta)/ig, '')
    .replace(/impacto:?\s*(bajo|medio|alto|cr[ií]tico)/ig, '')
    .replace(/responsable:?\s*[^,;\n]+/ig, '')
    .replace(/tarea:?\s*#?\d+/ig, '')
    .trim();
}
const area = areaFrom(raw);
const descBase = cleanDesc(raw) || raw;
const desc = `[${area}] ${descBase}`;
let query;
let target;
if (intencion === 'riesgo') {
  target = 'DISCORD_CHANNEL_RIESGOS';
  const prioridad = prioMap[`${prob}-${impacto}`] || 'media';
  const mitigacion = raw.match(/mitigaci[oó]n:?\s*([^;\n]+)/i)?.[1]?.trim() || (area === 'infraestructura/despliegue' ? 'Definir contingencia tecnica, responsable y fecha de revision.' : area === 'stakeholders' ? 'Alinear expectativa con el cliente y dejar acuerdo registrado.' : 'Definir mitigacion, responsable y fecha de revision.');
  query = `INSERT INTO pm_riesgos (descripcion, probabilidad, impacto, prioridad_calculada, mitigacion, estado, responsable, creado_por)
VALUES (${q(desc)}, ${q(prob)}, ${q(impacto)}, ${q(prioridad)}, ${q(mitigacion)}, 'abierto', ${q(datos.responsable || ctx.usuario)}, ${q(ctx.usuario)})
RETURNING 'risk' AS action, id, descripcion, probabilidad, impacto, prioridad_calculada, mitigacion, responsable, ${q(area)} AS area_aplicacion;`;
} else {
  target = 'DISCORD_CHANNEL_BLOQUEOS';
  const action = raw.match(/accion:?\s*([^;\n]+)/i)?.[1]?.trim() || (taskId ? 'Acordar desbloqueo con responsable de la tarea y actualizar fecha si cambia el plan.' : 'Asignar responsable de resolucion, vincular tarea afectada y revisar impacto en el plan.');
  query = `INSERT INTO pm_bloqueos (descripcion, responsable_afectado, tarea_id, severidad, estado, accion_recomendada, creado_por)
VALUES (${q(desc)}, ${q(datos.responsable || ctx.usuario)}, ${taskId || 'NULL'}, ${q(sev)}, 'abierto', ${q(action)}, ${q(ctx.usuario)})
RETURNING 'blocker' AS action, id, descripcion, responsable_afectado, tarea_id, severidad, accion_recomendada, ${q(area)} AS area_aplicacion;`;
}
return [{ json: { query, canal_destino: target, canal_id: process.env[target] || ctx.canal_origen } }];
});

const bloqueoRiesgoFormatCode = code(function(){
const rows = $input.all().map(i => i.json);
const r = rows[0] || {};
const ctx = $('Build Bloqueo/Riesgo Query').item.json;
let respuesta;
if (r.action === 'risk') {
  respuesta = `Riesgo registrado.\nID: #${r.id}\nAplicacion: ${r.area_aplicacion}\nDescripcion: ${r.descripcion}\nProbabilidad: ${r.probabilidad}\nImpacto: ${r.impacto}\nPrioridad calculada: ${r.prioridad_calculada}\nMitigacion sugerida: ${r.mitigacion}\nProximo paso: asignar responsable de mitigacion y fecha de revision.`;
} else {
  if (!rows.length && ctx.mode === 'list') respuesta = ctx.canal_destino === 'DISCORD_CHANNEL_RIESGOS' ? 'No hay riesgos abiertos registrados.' : 'No hay bloqueos activos registrados.';
  else if (r.action === 'risk_list') respuesta = 'Riesgos abiertos:\n' + rows.map(x => `- #${x.id} [${x.prioridad_calculada}] ${x.descripcion} | mitigacion: ${x.mitigacion || 'sin definir'} | responsable: ${x.responsable || 'sin asignar'}`).join('\n');
  else if (r.action === 'blocker_list') respuesta = 'Bloqueos activos:\n' + rows.map(x => `- #${x.id} [${x.severidad}] ${x.descripcion} | tarea: ${x.tarea_id ? '#' + x.tarea_id : 'sin asociar'} | accion: ${x.accion_recomendada || 'sin definir'}`).join('\n');
  else if (r.action === 'risk_closed' || r.action === 'blocker_closed') respuesta = `Elemento actualizado.\nID: #${r.id}\nEstado: ${r.estado}\nDescripcion: ${r.descripcion}`;
  else respuesta = `Detecte y registre un bloqueo.\nID: #${r.id}\nAplicacion: ${r.area_aplicacion}\nAfectado: ${r.responsable_afectado}\nSeveridad: ${r.severidad}\nTarea: ${r.tarea_id ? '#' + r.tarea_id : 'sin tarea asociada'}\nAccion recomendada: ${r.accion_recomendada}\nProximo paso: cerrar con /pm bloqueo cerrar #${r.id} cuando quede resuelto.`;
}
const storage = String(r.action || '').startsWith('risk') ? 'postgres:pm_riesgos' : 'postgres:pm_bloqueos';
return [{ json: { respuesta, canal_destino: ctx.canal_destino, canal_id: ctx.canal_id, storage } }];
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

const reportQuery = `WITH cfg AS (
  SELECT GREATEST(1, LEAST(90, $1::int)) AS dias
)
SELECT
  cfg.dias AS rango_dias,
  (CURRENT_DATE - ((cfg.dias - 1) * INTERVAL '1 day'))::date AS fecha_desde,
  CURRENT_DATE::date AS fecha_hasta,
  (SELECT COUNT(*) FROM pm_tareas WHERE estado = 'completada' AND fecha_actualizacion::date >= (CURRENT_DATE - ((cfg.dias - 1) * INTERVAL '1 day'))::date) AS tareas_completadas_periodo,
  (SELECT COUNT(*) FROM pm_tareas) AS tareas_totales,
  (SELECT COUNT(*) FROM pm_tareas WHERE estado = 'completada') AS tareas_completadas_total,
  (SELECT COUNT(*) FROM pm_tareas WHERE estado NOT IN ('completada','cancelada')) AS tareas_pendientes,
  (SELECT COUNT(*) FROM pm_tareas WHERE fecha_limite < CURRENT_DATE AND estado NOT IN ('completada','cancelada')) AS tareas_atrasadas,
  (SELECT COUNT(*) FROM pm_tareas WHERE fecha_limite <= CURRENT_DATE + INTERVAL '3 days' AND estado NOT IN ('completada','cancelada')) AS tareas_vencen_pronto,
  (SELECT COUNT(*) FROM pm_bloqueos WHERE estado <> 'resuelto') AS bloqueos_activos,
  (SELECT COUNT(*) FROM pm_bloqueos WHERE estado <> 'resuelto' AND severidad IN ('alta','critica')) AS bloqueos_altos,
  (SELECT COUNT(*) FROM pm_riesgos WHERE estado = 'abierto') AS riesgos_abiertos,
  (SELECT COUNT(*) FROM pm_riesgos WHERE estado = 'abierto' AND prioridad_calculada IN ('alta','critica')) AS riesgos_altos,
  (SELECT COUNT(*) FROM pm_avances WHERE fecha::date >= (CURRENT_DATE - ((cfg.dias - 1) * INTERVAL '1 day'))::date) AS avances_periodo,
  (SELECT COUNT(*) FROM pm_decisiones WHERE fecha::date >= (CURRENT_DATE - ((cfg.dias - 1) * INTERVAL '1 day'))::date) AS decisiones_periodo,
  (SELECT COALESCE(json_agg(t ORDER BY fecha_limite NULLS LAST), '[]'::json) FROM (SELECT id,titulo,responsable,prioridad,estado,fecha_limite FROM pm_tareas WHERE estado NOT IN ('completada','cancelada') ORDER BY fecha_limite NULLS LAST LIMIT 8) t) AS tareas,
  (SELECT COALESCE(json_agg(t ORDER BY fecha_limite NULLS LAST), '[]'::json) FROM (SELECT id,titulo,responsable,prioridad,estado,fecha_limite FROM pm_tareas WHERE fecha_limite <= CURRENT_DATE + INTERVAL '3 days' AND estado NOT IN ('completada','cancelada') ORDER BY fecha_limite NULLS LAST LIMIT 8) t) AS tareas_pronto,
  (SELECT COALESCE(json_agg(b ORDER BY fecha_creacion DESC), '[]'::json) FROM (SELECT id,descripcion,responsable_afectado,severidad,fecha_creacion FROM pm_bloqueos WHERE estado <> 'resuelto' ORDER BY fecha_creacion DESC LIMIT 5) b) AS bloqueos,
  (SELECT COALESCE(json_agg(r ORDER BY fecha_creacion DESC), '[]'::json) FROM (SELECT id,descripcion,prioridad_calculada,mitigacion,fecha_creacion FROM pm_riesgos WHERE estado='abierto' ORDER BY fecha_creacion DESC LIMIT 5) r) AS riesgos,
  (SELECT COALESCE(json_agg(e ORDER BY fecha_limite NULLS LAST), '[]'::json) FROM (SELECT id,nombre,responsable,estado,fecha_limite FROM pm_entregables WHERE estado NOT IN ('entregado','aprobado') ORDER BY fecha_limite NULLS LAST LIMIT 5) e) AS entregables,
  (SELECT COALESCE(json_agg(d ORDER BY fecha DESC), '[]'::json) FROM (SELECT id,decision,responsable,fecha FROM pm_decisiones ORDER BY fecha DESC LIMIT 5) d) AS decisiones,
  (SELECT COALESCE(json_agg(a ORDER BY avances DESC), '[]'::json) FROM (SELECT responsable, COUNT(*) AS avances, MAX(fecha) AS ultimo_avance FROM pm_avances WHERE fecha::date >= (CURRENT_DATE - ((cfg.dias - 1) * INTERVAL '1 day'))::date GROUP BY responsable) a) AS avances_por_responsable,
  (SELECT COALESCE(json_agg(c ORDER BY tareas DESC), '[]'::json) FROM (SELECT COALESCE(responsable,'sin responsable') AS responsable, COUNT(*) AS tareas FROM pm_tareas WHERE estado NOT IN ('completada','cancelada') GROUP BY COALESCE(responsable,'sin responsable')) c) AS carga_responsables
FROM cfg;`;

const reportFormatCode = code(function(){
const row = $json;
const ctx = $('Execute Workflow Trigger').item.json || {};
const dias = Number(row.rango_dias || ctx.datos?.dias || (ctx.sub_intencion === 'diario' ? 1 : 7));
const tipo = ctx.sub_intencion === 'kpis' ? 'KPIs' : (ctx.sub_intencion === 'semanal' ? 'semanal' : (ctx.intencion === 'estado_proyecto' ? 'estado general' : (dias === 1 ? 'diario' : 'periodo')));
const periodo = dias === 1 ? `hoy (${row.fecha_hasta})` : `ultimos ${dias} dias (${row.fecha_desde} a ${row.fecha_hasta})`;
function list(arr, fn, empty) { return (arr || []).length ? arr.map(fn).join('\n') : empty; }
const tareas = typeof row.tareas === 'string' ? JSON.parse(row.tareas) : row.tareas;
const bloqueos = typeof row.bloqueos === 'string' ? JSON.parse(row.bloqueos) : row.bloqueos;
const riesgos = typeof row.riesgos === 'string' ? JSON.parse(row.riesgos) : row.riesgos;
const entregables = typeof row.entregables === 'string' ? JSON.parse(row.entregables) : row.entregables;
const decisiones = typeof row.decisiones === 'string' ? JSON.parse(row.decisiones) : row.decisiones;
const tareasPronto = typeof row.tareas_pronto === 'string' ? JSON.parse(row.tareas_pronto) : row.tareas_pronto;
const avancesResp = typeof row.avances_por_responsable === 'string' ? JSON.parse(row.avances_por_responsable) : row.avances_por_responsable;
const cargaResp = typeof row.carga_responsables === 'string' ? JSON.parse(row.carga_responsables) : row.carga_responsables;
const total = Number(row.tareas_totales || 0);
const completadasTotal = Number(row.tareas_completadas_total || 0);
const avancePct = total ? Math.round((completadasTotal / total) * 100) : 0;
let semaforo = 'verde';
if (Number(row.tareas_atrasadas) > 0 || Number(row.bloqueos_altos) > 0 || Number(row.riesgos_altos) > 0) semaforo = 'rojo';
else if (Number(row.tareas_vencen_pronto) > 0 || Number(row.bloqueos_activos) > 0 || Number(row.riesgos_abiertos) > 0 || Number(row.avances_periodo) === 0) semaforo = 'amarillo';
const recomendaciones = [];
if (Number(row.tareas_atrasadas) > 0) recomendaciones.push('Priorizar tareas atrasadas y validar bloqueos con responsables hoy.');
if (Number(row.tareas_vencen_pronto) > 0) recomendaciones.push('Cerrar o replanificar tareas que vencen en los proximos 3 dias.');
if (Number(row.bloqueos_activos) > 0) recomendaciones.push('Revisar bloqueos activos antes de abrir trabajo nuevo.');
if (Number(row.riesgos_abiertos) > 0) recomendaciones.push('Actualizar mitigaciones de riesgos abiertos y asignar fecha de revision.');
if (Number(row.avances_periodo) === 0) recomendaciones.push('Pedir avances concretos; no hay actividad registrada en el periodo.');
if (!recomendaciones.length) recomendaciones.push('Mantener cadencia de avances y preparar evidencia de entregables.');
if (ctx.sub_intencion === 'kpis') {
  const respuestaKpis = [
    `KPIs PetSafe - ${periodo}`,
    `Semaforo PM: ${semaforo}`,
    `Avance global de tareas: ${avancePct}% (${completadasTotal}/${total})`,
    `Tareas completadas en el periodo: ${row.tareas_completadas_periodo}`,
    `Avances registrados: ${row.avances_periodo}`,
    `Tareas activas: ${row.tareas_pendientes}`,
    `Tareas atrasadas: ${row.tareas_atrasadas} | Vencen pronto: ${row.tareas_vencen_pronto}`,
    `Bloqueos activos: ${row.bloqueos_activos} | Altos/criticos: ${row.bloqueos_altos}`,
    `Riesgos abiertos: ${row.riesgos_abiertos} | Altos/criticos: ${row.riesgos_altos}`,
    `Decisiones registradas en el periodo: ${row.decisiones_periodo}`,
    '',
    'Avances por responsable:',
    list(avancesResp, a => `- ${a.responsable || 'sin responsable'}: ${a.avances}`, '- Sin avances registrados en el periodo.'),
    '',
    'Carga activa por responsable:',
    list(cargaResp, c => `- ${c.responsable}: ${c.tareas} tarea(s)`, '- Sin tareas activas.'),
    '',
    'Lectura PM:',
    recomendaciones.map(r => `- ${r}`).join('\n')
  ].join('\n');
  return [{ json: { respuesta: respuestaKpis, canal_destino: 'DISCORD_CHANNEL_REPORTES', canal_id: process.env.DISCORD_CHANNEL_REPORTES || ctx.canal_origen, should_publish: ctx.intencion === 'reporte' } }];
}
const respuesta = [
  `Reporte ${tipo} PetSafe`,
  `Periodo evaluado: ${periodo}`,
  `Semaforo PM: ${semaforo} | Avance global: ${avancePct}% (${completadasTotal}/${total})`,
  `Completadas en el periodo: ${row.tareas_completadas_periodo} | Avances registrados: ${row.avances_periodo}`,
  `Activas: ${row.tareas_pendientes} | Atrasadas: ${row.tareas_atrasadas} | Vencen pronto: ${row.tareas_vencen_pronto}`,
  `Bloqueos activos: ${row.bloqueos_activos} (${row.bloqueos_altos} altos/criticos) | Riesgos abiertos: ${row.riesgos_abiertos} (${row.riesgos_altos} altos/criticos) | Decisiones del periodo: ${row.decisiones_periodo}`,
  '',
  'Tareas clave:',
  list(tareas, t => `- #${t.id} [${t.estado}/${t.prioridad}] ${t.titulo} - ${t.responsable || 'sin responsable'}${t.fecha_limite ? ' - ' + t.fecha_limite : ''}`, '- Sin tareas activas.'),
  '',
  'Vencen pronto:',
  list(tareasPronto, t => `- #${t.id} [${t.estado}/${t.prioridad}] ${t.titulo} - ${t.responsable || 'sin responsable'}${t.fecha_limite ? ' - ' + t.fecha_limite : ''}`, '- Sin vencimientos criticos en 3 dias.'),
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
VALUES (NULL, 'discord', 'pm_report', $1, $2::jsonb)
ON CONFLICT (idempotency_key) DO NOTHING
RETURNING outbox_id;`;

writeWorkflow(path.join(pmoDir, 'WF_PM_Reportes.json'), workflow('wf-pm-reportes', 'WF_PM_Reportes', [
  trigger,
  pgNode('query-report', 'Query PM Report Data', [240, 0], reportQuery, {
    queryReplacement: '={{ [ $json.datos?.dias || ($json.sub_intencion === "diario" ? 1 : 7) ] }}',
  }),
  node('format-report', 'Format PM Report', 'n8n-nodes-base.code', 2, [500, 0], { jsCode: reportFormatCode }),
  node('publish?', 'Publish Report?', 'n8n-nodes-base.if', 2.2, [760, 0], {
    conditions: { options: { caseSensitive: true, typeValidation: 'loose' }, conditions: [{ id: 'publish', leftValue: '={{ $json.should_publish ? 1 : 0 }}', rightValue: 1, operator: { type: 'number', operation: 'equals' } }], combinator: 'and' },
    options: {},
  }),
  pgNode('outbox-report', 'Queue Report To Discord', [1000, -80], outboxReportQuery, {
    queryReplacement: '={{ [ "pm-report-" + Date.now(), JSON.stringify({ content: $json.respuesta, channel_id: $json.canal_id }) ] }}',
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
  (SELECT COALESCE(json_agg(e), '[]'::json) FROM (SELECT id,nombre,responsable,fecha_limite,estado FROM pm_entregables WHERE estado NOT IN ('entregado','aprobado') ORDER BY fecha_limite NULLS LAST LIMIT 5) e) AS entregables,
  (SELECT COALESCE(json_agg(m), '[]'::json) FROM (SELECT id,titulo,fecha_reunion,duracion_minutos,lugar,participantes,estado,discord_event_id,discord_event_url FROM pm_reuniones ORDER BY fecha_reunion NULLS LAST, fecha_creacion DESC LIMIT 10) m) AS reuniones;`;

const reunionesFormatCode = code(function(){
const row = $json; const ctx = $('Execute Workflow Trigger').item.json || {};
const tareas = typeof row.tareas === 'string' ? JSON.parse(row.tareas) : row.tareas;
const bloqueos = typeof row.bloqueos === 'string' ? JSON.parse(row.bloqueos) : row.bloqueos;
const riesgos = typeof row.riesgos === 'string' ? JSON.parse(row.riesgos) : row.riesgos;
const entregables = typeof row.entregables === 'string' ? JSON.parse(row.entregables) : row.entregables;
const reuniones = typeof row.reuniones === 'string' ? JSON.parse(row.reuniones) : row.reuniones;
const sub = String(ctx.sub_intencion || 'agendar').toLowerCase();
const raw = String(ctx.datos?.texto || ctx.mensaje_original || '');
const TEAM = ['David Manjarres','David Josue Barragan Pozo','Josue Joel Garcia Abata','Fernando Joel Bonilla Guerrero','Joel Bonilla'];
const guildId = process.env.DISCORD_GUILD_ID || '';
const voiceChannelId = process.env.DISCORD_MEETING_VOICE_CHANNEL_ID || '';
const meetingChannelId = process.env.DISCORD_CHANNEL_REUNIONES || ctx.canal_origen;
const stopFields = 'participantes|asistentes|con|duracion|duraci[oó]n|minutos|cuando|cu[aá]ndo|fecha|hora|donde|d[oó]nde|lugar|ubicacion|ubicaci[oó]n|acuerdos?|compromisos?|decisiones?|acta';
function field(rx) {
  return raw.match(new RegExp('(?:' + rx + '):?\\s*([^,;\\n]+?)(?=\\s+(?:' + stopFields + '):?\\s|$)', 'i'))?.[1]?.trim() || null;
}
function meetingId() { return Number(ctx.datos?.id || raw.match(/#?(\d+)/)?.[1] || 0) || null; }
function byId(id) { return reuniones.find(m => Number(m.id) === Number(id)); }
function localParts(iso) {
  if (!iso) return { date: null, hour: null, minute: null };
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return { date: null, hour: null, minute: null };
  const ec = new Date(d.getTime() - (5 * 60 * 60 * 1000));
  return { date: ec.toISOString().slice(0, 10), hour: ec.toISOString().slice(11, 13), minute: ec.toISOString().slice(14, 16) };
}
function dateFromText(fallbackIso = null) {
  const direct = ctx.datos?.fecha_reunion || raw.match(/(?:cuando|cu[aá]ndo|fecha|para):?\s*(\d{4}-\d{2}-\d{2})/i)?.[1];
  if (direct) return direct;
  const anyDate = raw.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
  if (anyDate) return anyDate;
  const d = new Date();
  if (/ma[nñ]ana/i.test(raw)) { d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }
  if (/\bhoy\b/i.test(raw)) return d.toISOString().slice(0, 10);
  return localParts(fallbackIso).date;
}
function timeFromText(fallbackIso = null) {
  const hit = raw.match(/(?:hora:?\s*|a las\s*|desde las\s*)([01]?\d|2[0-3])(?::([0-5]\d))?/i);
  if (hit) return { hour: String(hit[1]).padStart(2, '0'), minute: String(hit[2] || '00').padStart(2, '0') };
  const p = localParts(fallbackIso);
  return { hour: p.hour, minute: p.minute };
}
function topic(defaultTitle = 'Reunion de seguimiento PetSafe') {
  const text = raw
    .replace(/^\/pm\s+reuni[oó]n\s+\w+/i, '')
    .replace(/^\/reuni[oó]n\s+\w+/i, '')
    .replace(/#\d+/g, '')
    .replace(new RegExp('\\s+(?:' + stopFields + '):?.*$', 'i'), '')
    .trim();
  return text || defaultTitle;
}
function participantsFromText(existing = []) {
  const rawParticipants = ctx.datos?.participantes || field('participantes|asistentes|con') || (existing.length ? existing.join(',') : 'todos');
  return /todos|equipo/i.test(rawParticipants) ? TEAM : rawParticipants.split(/,|\sy\s/).map(p => p.trim()).filter(Boolean);
}
function mentions(participantes) {
  let mentionMap = {};
  try { mentionMap = JSON.parse(process.env.PM_TEAM_DISCORD_MAP_JSON || '{}'); } catch (e) {}
  return participantes.map(p => mentionMap[p] ? `<@${mentionMap[p]}>` : p).join(', ');
}
function agendaFor({ titulo, date, hour, minute, duracion, lugar, participantes }) {
  return [
    `Reunion PM PetSafe: ${titulo}`,
    `Cuando: ${date} ${hour}:${minute}`,
    `Duracion: ${duracion} min`,
    `Donde: ${lugar}`,
    `Participantes: ${participantes.join(', ')}`,
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
}
function eventPayload({ titulo, fechaReunion, fechaFin, agenda, lugar }) {
  const payload = {
    name: titulo.slice(0, 100),
    privacy_level: 2,
    scheduled_start_time: fechaReunion,
    scheduled_end_time: fechaFin,
    description: agenda.slice(0, 1000)
  };
  if (voiceChannelId) {
    payload.entity_type = 2;
    payload.channel_id = voiceChannelId;
  } else {
    payload.entity_type = 3;
    payload.channel_id = null;
    payload.entity_metadata = { location: lugar === 'videollamada' ? 'Discord: canal General / #reuniones' : lugar };
  }
  return payload;
}
if (['listar','lista','ver'].includes(sub)) {
  const respuestaLista = reuniones.length
    ? 'Reuniones registradas:\n' + reuniones.map(m => `- #${m.id} ${m.titulo} | ${m.fecha_reunion || 'sin fecha'} | ${m.estado || 'programada'} | ${m.discord_event_url || 'sin evento Discord'} | participantes: ${(m.participantes || []).join(', ') || 'sin definir'}`).join('\n')
    : 'No hay reuniones registradas.';
  return [{ json: { respuesta: respuestaLista, needs_write: false, canal_destino: 'DISCORD_CHANNEL_REUNIONES', canal_id: meetingChannelId } }];
}

if (['cancelar','cancelada','eliminar','borrar'].includes(sub)) {
  const id = meetingId();
  const current = byId(id);
  if (!id || !current) {
    return [{ json: { respuesta: 'Para cancelar necesito un ID valido. Ejemplo: `/pm reunion cancelar #2`.', needs_write: false, canal_destino: 'DISCORD_CHANNEL_REUNIONES', canal_id: meetingChannelId } }];
  }
  return [{ json: {
    operation: 'cancel',
    needs_write: true,
    needs_discord_delete: Boolean(current.discord_event_id && guildId && process.env.DISCORD_BOT_TOKEN),
    http_url: `https://discord.com/api/v10/guilds/${guildId}/scheduled-events/${current.discord_event_id || 'missing-event'}`,
    meeting_id: id,
    titulo: current.titulo,
    discord_event_id: current.discord_event_id || '',
    discord_event_url: current.discord_event_url || '',
    canal_destino: 'DISCORD_CHANNEL_REUNIONES',
    canal_id: meetingChannelId
  } }];
}

if (['acta','registrar_acta','acuerdos','compromisos'].includes(sub)) {
  const id = meetingId();
  const current = byId(id);
  if (!id || !current) {
    return [{ json: { respuesta: 'Para registrar acta necesito el ID de la reunion. Ejemplo: `/pm reunion acta #2 acuerdos: ... compromisos: ... decisiones: ...`.', needs_write: false, canal_destino: 'DISCORD_CHANNEL_REUNIONES', canal_id: meetingChannelId } }];
  }
  const acuerdos = field('acuerdos?') || '';
  const compromisos = field('compromisos?') || '';
  const decisiones = field('decisiones?') || '';
  const acta = field('acta') || raw.replace(/^\/pm\s+reuni[oó]n\s+\w+/i, '').replace(/#\d+/g, '').trim();
  if (!acta && !acuerdos && !compromisos && !decisiones) {
    return [{ json: { respuesta: 'No encontre contenido de acta. Usa `acuerdos:`, `compromisos:` o `decisiones:`.', needs_write: false, canal_destino: 'DISCORD_CHANNEL_REUNIONES', canal_id: meetingChannelId } }];
  }
  return [{ json: {
    operation: 'acta',
    needs_write: true,
    meeting_id: id,
    titulo: current.titulo,
    acta,
    acuerdos,
    compromisos,
    decisiones,
    canal_destino: 'DISCORD_CHANNEL_REUNIONES',
    canal_id: meetingChannelId
  } }];
}

const updating = ['actualizar','update','editar','reprogramar'].includes(sub);
const current = updating ? byId(meetingId()) : null;
if (updating && !current) {
  return [{ json: { respuesta: 'Para actualizar necesito un ID valido. Ejemplo: `/pm reunion actualizar #2 cuando: 2026-05-27 hora: 11:00 participantes: todos`.', needs_write: false, canal_destino: 'DISCORD_CHANNEL_REUNIONES', canal_id: meetingChannelId } }];
}
const titulo = updating ? topic(current.titulo) : topic();
const date = dateFromText(current?.fecha_reunion || null);
const time = timeFromText(current?.fecha_reunion || null);
const hour = time.hour;
const minute = time.minute;
if (!date || !hour) {
  const respuestaFaltante = [
    `Para agendar "${titulo}" necesito fecha y hora.`,
    'Formato sugerido: `/pm reunion agendar mitigar impedimentos cuando: 2026-05-27 hora: 10:00 donde: videollamada participantes: todos`.',
    'Si no indicas lugar usare videollamada; si no indicas participantes asumire todo el equipo.'
  ].join('\n');
  return [{ json: { respuesta: respuestaFaltante, needs_write: false, canal_destino: 'DISCORD_CHANNEL_REUNIONES', canal_id: meetingChannelId } }];
}
const durationRaw = Number(raw.match(/(?:duracion|duraci[oó]n|minutos):?\s*(\d{1,3})/i)?.[1] || process.env.PM_MEETING_DURATION_MINUTES || 45);
const duracionBase = updating ? Number(current.duracion_minutos || 45) : Number(process.env.PM_MEETING_DURATION_MINUTES || 45);
const duracion = Math.max(15, Math.min(240, Number.isFinite(durationRaw) && /(?:duracion|duraci[oó]n|minutos):?\s*\d/i.test(raw) ? durationRaw : duracionBase));
const lugar = ctx.datos?.lugar || field('donde|d[oó]nde|lugar|ubicacion|ubicaci[oó]n') || current?.lugar || 'videollamada';
const participantes = participantsFromText(current?.participantes || []);
const menciones = mentions(participantes);
const start = new Date(`${date}T${hour}:${minute}:00-05:00`);
if (!Number.isFinite(start.getTime()) || start <= new Date()) {
  return [{ json: { respuesta: `Para crear o actualizar una reunion real en Discord necesito fecha y hora futura. Recibi: ${date} ${hour}:${minute}.`, needs_write: false, canal_destino: 'DISCORD_CHANNEL_REUNIONES', canal_id: meetingChannelId } }];
}
const end = new Date(start.getTime() + duracion * 60000);
const fechaReunion = start.toISOString();
const fechaFin = end.toISOString();
const agenda = agendaFor({ titulo, date, hour, minute, duracion, lugar, participantes });
const payload = eventPayload({ titulo, fechaReunion, fechaFin, agenda, lugar });
const eventId = current?.discord_event_id || '';
return [{ json: {
  operation: updating ? 'update' : 'create',
  respuesta_base: agenda,
  titulo,
  fecha_reunion: fechaReunion,
  fecha_fin: fechaFin,
  duracion_minutos: duracion,
  participantes: participantes.join(','),
  participantes_texto: participantes.join(', '),
  menciones,
  lugar,
  guild_id: guildId,
  meeting_channel_id: meetingChannelId,
  discord_ready: Boolean(guildId && process.env.DISCORD_BOT_TOKEN),
  meeting_id: current?.id || null,
  existing_discord_event_id: eventId,
  existing_discord_event_url: current?.discord_event_url || '',
  discord_event_payload: payload,
  needs_write: true,
  needs_discord_upsert: Boolean(guildId && process.env.DISCORD_BOT_TOKEN && (!updating || eventId)),
  http_method: updating ? 'PATCH' : 'POST',
  http_url: updating
    ? `https://discord.com/api/v10/guilds/${guildId || 'missing-guild'}/scheduled-events/${eventId || 'missing-event'}`
    : `https://discord.com/api/v10/guilds/${guildId || 'missing-guild'}/scheduled-events`,
  should_queue_reminder: true,
  canal_destino: 'DISCORD_CHANNEL_REUNIONES',
  canal_id: meetingChannelId
} }];
});

const meetingMutationCode = code(function(){
const base = $('Format Meeting Agenda').item.json;
let discord = {};
try { discord = $('Discord Meeting Upsert').item.json || {}; } catch (e) {}
try { if (!Object.keys(discord).length) discord = $('Discord Meeting Delete').item.json || {}; } catch (e) {}
const rawError = discord.error?.message || discord.message || discord.errors || '';
const discordError = rawError ? (typeof rawError === 'string' ? rawError : JSON.stringify(rawError)).slice(0, 300) : '';
const eventId = discord.id || base.existing_discord_event_id || '';
const eventUrl = eventId && base.guild_id ? `https://discord.com/events/${base.guild_id}/${eventId}` : (base.existing_discord_event_url || '');
let query = 'SELECT 1;';
let queryParams = [];
if (base.operation === 'create') {
  query = `INSERT INTO pm_reuniones (titulo, tipo, fecha_reunion, duracion_minutos, participantes, lugar, agenda, creado_por, discord_event_id, discord_event_url, discord_event_status)
VALUES ($1, 'seguimiento', $2::timestamptz, $3, string_to_array($4, ','), $5, $6, $7, $8, $9, $10)
RETURNING id,titulo,fecha_reunion,duracion_minutos,lugar,participantes,estado,discord_event_id,discord_event_url,discord_event_status;`;
  queryParams = [base.titulo, base.fecha_reunion, base.duracion_minutos, base.participantes, base.lugar, base.respuesta_base, $('Execute Workflow Trigger').item.json.usuario, eventId || null, eventUrl || null, eventId ? 'created' : 'discord_error'];
} else if (base.operation === 'update') {
  query = `WITH upd AS (
  UPDATE pm_reuniones
  SET titulo=$1, fecha_reunion=$2::timestamptz, duracion_minutos=$3, participantes=string_to_array($4, ','), lugar=$5, agenda=$6,
      discord_event_id=COALESCE(NULLIF($7,''), discord_event_id),
      discord_event_url=COALESCE(NULLIF($8,''), discord_event_url),
      discord_event_status=$9
  WHERE id=$10
  RETURNING id,titulo,fecha_reunion,duracion_minutos,lugar,participantes,estado,discord_event_id,discord_event_url,discord_event_status
), cancel_old AS (
  UPDATE events_outbox SET status='cancelled'
  WHERE action='pm_meeting_reminder' AND status IN ('pending','sending') AND idempotency_key LIKE ('pm-meeting-reminder-' || $10 || '-%')
  RETURNING outbox_id
)
SELECT upd.*, (SELECT COUNT(*) FROM cancel_old) AS reminders_cancelled FROM upd;`;
  queryParams = [base.titulo, base.fecha_reunion, base.duracion_minutos, base.participantes, base.lugar, base.respuesta_base, eventId || '', eventUrl || '', discordError ? 'discord_update_error' : 'updated', base.meeting_id];
} else if (base.operation === 'cancel') {
  query = `WITH upd AS (
  UPDATE pm_reuniones
  SET estado='cancelada', discord_event_status=$2
  WHERE id=$1
  RETURNING id,titulo,fecha_reunion,duracion_minutos,lugar,participantes,estado,discord_event_id,discord_event_url,discord_event_status
), cancel_old AS (
  UPDATE events_outbox SET status='cancelled'
  WHERE action='pm_meeting_reminder' AND status IN ('pending','sending') AND idempotency_key LIKE ('pm-meeting-reminder-' || $1 || '-%')
  RETURNING outbox_id
)
SELECT upd.*, (SELECT COUNT(*) FROM cancel_old) AS reminders_cancelled FROM upd;`;
  queryParams = [base.meeting_id, discordError ? 'discord_cancel_error' : 'cancelled'];
} else if (base.operation === 'acta') {
  query = `UPDATE pm_reuniones
SET acta=$1, acuerdos=$2, compromisos=$3, decisiones=$4, estado='completada'
WHERE id=$5
RETURNING id,titulo,fecha_reunion,duracion_minutos,lugar,participantes,estado,discord_event_id,discord_event_url,discord_event_status;`;
  queryParams = [base.acta || null, base.acuerdos || null, base.compromisos || null, base.decisiones || null, base.meeting_id];
}
return [{ json: { ...base, query, query_params: queryParams, discord_event_id: eventId, discord_event_url: eventUrl, discord_error: discordError } }];
});

const meetingResponseCode = code(function(){
const base = $('Build Meeting Mutation').item.json;
const stored = $('Run Meeting Mutation').item.json || {};
const lines = [];
const eventId = base.discord_event_id || stored.discord_event_id || '';
const eventUrl = base.discord_event_url || stored.discord_event_url || '';
const discordError = base.discord_error || '';
if (base.operation === 'create') {
  if (eventId) {
    lines.push(`Reunion Discord programada: ${base.titulo}`);
    lines.push(`Evento: ${eventUrl}`);
  } else {
    lines.push(`Reunion registrada, pero el evento Discord no se pudo crear automaticamente.`);
    lines.push(`Motivo probable: ${base.discord_ready ? (discordError || 'Discord no devolvio id de evento.') : 'falta DISCORD_GUILD_ID o DISCORD_BOT_TOKEN en n8n.'}`);
  }
  lines.push(`ID interno: #${stored.id || 'pendiente'}`);
  lines.push(`Cuando: ${base.fecha_reunion}`);
  lines.push(`Duracion: ${base.duracion_minutos} min`);
  lines.push(`Donde: ${base.lugar}`);
  lines.push(`Participantes: ${base.participantes_texto}`);
  if (base.menciones) lines.push(`Notificados: ${base.menciones}`);
  lines.push('');
  lines.push(base.respuesta_base);
  if (eventId) lines.push('', 'Recordatorio automatico: 15 minutos antes en este canal.');
} else if (base.operation === 'update') {
  lines.push(`Reunion actualizada: #${stored.id || base.meeting_id} ${base.titulo}`);
  if (eventUrl) lines.push(`Evento: ${eventUrl}`);
  if (discordError) lines.push(`Discord: no pude actualizar el evento automaticamente (${discordError}).`);
  lines.push(`Cuando: ${base.fecha_reunion}`);
  lines.push(`Duracion: ${base.duracion_minutos} min`);
  lines.push(`Donde: ${base.lugar}`);
  lines.push(`Participantes: ${base.participantes_texto}`);
  lines.push('Recordatorio automatico reajustado a 15 minutos antes.');
} else if (base.operation === 'cancel') {
  lines.push(`Reunion cancelada: #${stored.id || base.meeting_id} ${stored.titulo || base.titulo}`);
  if (eventUrl) lines.push(`Evento: ${eventUrl}`);
  lines.push(discordError ? `Discord: revisar manualmente, no pude eliminar el evento (${discordError}).` : 'Discord: evento eliminado o no habia evento vinculado.');
  lines.push(`Recordatorios cancelados: ${stored.reminders_cancelled || 0}.`);
} else if (base.operation === 'acta') {
  lines.push(`Acta registrada: #${stored.id || base.meeting_id} ${stored.titulo || base.titulo}`);
  if (base.acuerdos) lines.push(`Acuerdos: ${base.acuerdos}`);
  if (base.compromisos) lines.push(`Compromisos: ${base.compromisos}`);
  if (base.decisiones) lines.push(`Decisiones: ${base.decisiones}`);
  lines.push('Estado: completada. Las decisiones/tareas derivadas se pueden registrar con `/pm decision registrar` y `/pm tarea crear`.');
} else {
  lines.push('Operacion de reunion ejecutada.');
}
const reminderContent = [
  `Recordatorio: la reunion "${base.titulo}" empieza en 15 minutos.`,
  eventUrl ? `Evento Discord: ${eventUrl}` : '',
  base.menciones ? `Participantes: ${base.menciones}` : `Participantes: ${base.participantes_texto}`
].filter(Boolean).join('\n');
return [{ json: {
  respuesta: lines.join('\n'),
  canal_destino: 'DISCORD_CHANNEL_REUNIONES',
  canal_id: base.meeting_channel_id,
  storage: 'postgres:pm_reuniones',
  reminder_payload: { channel_id: base.meeting_channel_id, content: reminderContent },
  reminder_at: base.fecha_reunion,
  should_queue_reminder: Boolean(base.should_queue_reminder && stored.id && base.fecha_reunion),
  meeting_id: stored.id || base.meeting_id || null,
  discord_event_id: eventId,
  discord_event_url: eventUrl
} }];
});

const meetingReminderQuery = `INSERT INTO events_outbox (event_id, target, action, idempotency_key, payload, scheduled_at)
VALUES (NULL, 'discord', 'pm_meeting_reminder', $1, $2::jsonb, GREATEST($3::timestamptz - INTERVAL '15 minutes', NOW()))
ON CONFLICT (idempotency_key) DO UPDATE
SET payload=EXCLUDED.payload, scheduled_at=EXCLUDED.scheduled_at, status='pending', retry_count=0, last_error=NULL
RETURNING outbox_id;`;

writeWorkflow(path.join(pmoDir, 'WF_PM_Reuniones.json'), workflow('wf-pm-reuniones', 'WF_PM_Reuniones', [
  trigger,
  pgNode('query-meeting', 'Query Meeting Context', [240, 0], reunionesQuery),
  node('format-meeting', 'Format Meeting Agenda', 'n8n-nodes-base.code', 2, [500, 0], { jsCode: reunionesFormatCode }),
  node('needs-meeting-write?', 'Needs Meeting Write?', 'n8n-nodes-base.if', 2.2, [720, 0], {
    conditions: { options: { caseSensitive: true, typeValidation: 'loose' }, conditions: [{ id: 'write', leftValue: '={{ $json.needs_write ? 1 : 0 }}', rightValue: 1, operator: { type: 'number', operation: 'equals' } }], combinator: 'and' },
    options: {},
  }),
  node('needs-discord-delete?', 'Needs Discord Delete?', 'n8n-nodes-base.if', 2.2, [960, -120], {
    conditions: { options: { caseSensitive: true, typeValidation: 'loose' }, conditions: [{ id: 'delete', leftValue: '={{ $json.needs_discord_delete ? 1 : 0 }}', rightValue: 1, operator: { type: 'number', operation: 'equals' } }], combinator: 'and' },
    options: {},
  }),
  node('needs-discord-upsert?', 'Needs Discord Upsert?', 'n8n-nodes-base.if', 2.2, [1180, 20], {
    conditions: { options: { caseSensitive: true, typeValidation: 'loose' }, conditions: [{ id: 'upsert', leftValue: '={{ $json.needs_discord_upsert ? 1 : 0 }}', rightValue: 1, operator: { type: 'number', operation: 'equals' } }], combinator: 'and' },
    options: {},
  }),
  node('discord-delete', 'Discord Meeting Delete', 'n8n-nodes-base.httpRequest', 4.2, [1180, -180], {
    method: 'DELETE',
    url: '={{ $json.http_url }}',
    sendHeaders: true,
    headerParameters: { parameters: [
      { name: 'Authorization', value: '={{ "Bot " + $env.DISCORD_BOT_TOKEN }}' },
    ] },
    options: {},
  }, { continueOnFail: true }),
  node('discord-upsert', 'Discord Meeting Upsert', 'n8n-nodes-base.httpRequest', 4.2, [1400, -20], {
    method: '={{ $json.http_method }}',
    url: '={{ $json.http_url }}',
    sendHeaders: true,
    headerParameters: { parameters: [
      { name: 'Authorization', value: '={{ "Bot " + $env.DISCORD_BOT_TOKEN }}' },
      { name: 'Content-Type', value: 'application/json' },
    ] },
    sendBody: true,
    specifyBody: 'json',
    jsonBody: '={{ JSON.stringify($json.discord_event_payload) }}',
    options: {},
  }, { continueOnFail: true }),
  node('build-meeting-mutation', 'Build Meeting Mutation', 'n8n-nodes-base.code', 2, [1620, 0], { jsCode: meetingMutationCode }),
  pgNode('run-meeting-mutation', 'Run Meeting Mutation', [1840, 0], '={{ $json.query }}', {
    queryReplacement: '={{ $json.query_params }}',
  }),
  node('build-meeting-response', 'Build Meeting Response', 'n8n-nodes-base.code', 2, [2060, 0], { jsCode: meetingResponseCode }),
  node('should-queue-meeting-reminder?', 'Should Queue Meeting Reminder?', 'n8n-nodes-base.if', 2.2, [2280, 0], {
    conditions: { options: { caseSensitive: true, typeValidation: 'loose' }, conditions: [{ id: 'queue', leftValue: '={{ $json.should_queue_reminder ? 1 : 0 }}', rightValue: 1, operator: { type: 'number', operation: 'equals' } }], combinator: 'and' },
    options: {},
  }),
  pgNode('queue-meeting-reminder', 'Queue Meeting Reminder', [2500, -80], meetingReminderQuery, {
    queryReplacement: '={{ [ "pm-meeting-reminder-" + $json.meeting_id + "-" + new Date($json.reminder_at).getTime(), JSON.stringify($json.reminder_payload), $json.reminder_at ] }}',
  }),
  node('return-meeting', 'Return Meeting Response', 'n8n-nodes-base.code', 2, [2720, 0], { jsCode: "try { return [{ json: $('Build Meeting Response').item.json }]; } catch (e) { return [{ json: $('Format Meeting Agenda').item.json }]; }" }),
], {
  'Execute Workflow Trigger': { main: [[{ node: 'Query Meeting Context', type: 'main', index: 0 }]] },
  'Query Meeting Context': { main: [[{ node: 'Format Meeting Agenda', type: 'main', index: 0 }]] },
  'Format Meeting Agenda': { main: [[{ node: 'Needs Meeting Write?', type: 'main', index: 0 }]] },
  'Needs Meeting Write?': { main: [[{ node: 'Needs Discord Delete?', type: 'main', index: 0 }], [{ node: 'Return Meeting Response', type: 'main', index: 0 }]] },
  'Needs Discord Delete?': { main: [[{ node: 'Discord Meeting Delete', type: 'main', index: 0 }], [{ node: 'Needs Discord Upsert?', type: 'main', index: 0 }]] },
  'Needs Discord Upsert?': { main: [[{ node: 'Discord Meeting Upsert', type: 'main', index: 0 }], [{ node: 'Build Meeting Mutation', type: 'main', index: 0 }]] },
  'Discord Meeting Delete': { main: [[{ node: 'Build Meeting Mutation', type: 'main', index: 0 }]] },
  'Discord Meeting Upsert': { main: [[{ node: 'Build Meeting Mutation', type: 'main', index: 0 }]] },
  'Build Meeting Mutation': { main: [[{ node: 'Run Meeting Mutation', type: 'main', index: 0 }]] },
  'Run Meeting Mutation': { main: [[{ node: 'Build Meeting Response', type: 'main', index: 0 }]] },
  'Build Meeting Response': { main: [[{ node: 'Should Queue Meeting Reminder?', type: 'main', index: 0 }]] },
  'Should Queue Meeting Reminder?': { main: [[{ node: 'Queue Meeting Reminder', type: 'main', index: 0 }], [{ node: 'Return Meeting Response', type: 'main', index: 0 }]] },
  'Queue Meeting Reminder': { main: [[{ node: 'Return Meeting Response', type: 'main', index: 0 }]] },
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
  (SELECT COUNT(*) FROM pm_bot_errors WHERE fecha >= NOW() - INTERVAL '24 hours' AND NOT (workflow_name = 'System - PM Schema Manager' AND error_message ILIKE '%has no node to start%')) AS errores_24h,
  (SELECT COUNT(*) FROM pm_command_log WHERE exito = false) AS comandos_fallidos,
  (SELECT COALESCE(json_agg(l), '[]'::json) FROM (SELECT id,intencion,usuario,canal,exito,fecha FROM pm_command_log ORDER BY fecha DESC LIMIT 5) l) AS ultimos_comandos,
  (SELECT COALESCE(json_agg(e), '[]'::json) FROM (SELECT id,workflow_name,node_name,error_message,fecha FROM pm_bot_errors WHERE NOT (workflow_name = 'System - PM Schema Manager' AND error_message ILIKE '%has no node to start%') ORDER BY fecha DESC LIMIT 3) e) AS ultimos_errores;`;

const adminFormatCode = code(function(){
const row = $json; const ctx = $('Execute Workflow Trigger').item.json || {};
const required = ['DISCORD_BOT_TOKEN','DISCORD_GUILD_ID','DISCORD_MEETING_VOICE_CHANNEL_ID','DISCORD_CHANNEL_TAREAS','DISCORD_CHANNEL_AVANCES','DISCORD_CHANNEL_BLOQUEOS','DISCORD_CHANNEL_REPORTES','DISCORD_CHANNEL_REUNIONES','DISCORD_CHANNEL_ENTREGABLES','DISCORD_CHANNEL_RIESGOS','DISCORD_CHANNEL_BOT_LOG','DISCORD_CHANNEL_ADMIN','TRELLO_BOARD_ID','TRELLO_DEFAULT_LIST_ID'];
const missing = required.filter(k => !process.env[k]);
const logs = typeof row.ultimos_comandos === 'string' ? JSON.parse(row.ultimos_comandos) : row.ultimos_comandos;
const errors = typeof row.ultimos_errores === 'string' ? JSON.parse(row.ultimos_errores) : row.ultimos_errores;
const respuesta = [
  'Estado administrativo del PM Bot',
  `Storage: Postgres`,
  `Tareas: ${row.tareas} | Avances: ${row.avances} | Entregables: ${row.entregables} | Decisiones: ${row.decisiones}`,
  `Bloqueos activos: ${row.bloqueos_activos} | Riesgos abiertos: ${row.riesgos_abiertos}`,
  `Outbox pendiente: ${row.outbox_pendiente} | Outbox fallido: ${row.outbox_fallido}`,
  `Errores PM 24h: ${row.errores_24h} | Comandos fallidos: ${row.comandos_fallidos}`,
  `Variables faltantes: ${missing.length ? missing.join(', ') : 'ninguna'}`,
  '',
  'Ultimos comandos:',
  ...(logs.length ? logs.map(l => `- #${l.id} ${l.intencion} por ${l.usuario} en ${l.canal}`) : ['- Sin comandos auditados.']),
  '',
  'Ultimos errores:',
  ...(errors.length ? errors.map(e => `- #${e.id} ${e.workflow_name || 'workflow'} / ${e.node_name || 'nodo'}: ${String(e.error_message || '').slice(0, 120)}`) : ['- Sin errores registrados.'])
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
  (SELECT COALESCE(json_agg(s), '[]'::json) FROM (
    SELECT t.id,t.titulo,t.responsable,t.fecha_limite
    FROM pm_tareas t
    WHERE t.estado NOT IN ('completada','cancelada')
      AND NOT EXISTS (SELECT 1 FROM pm_avances a WHERE a.tarea_id = t.id AND a.fecha >= NOW() - INTERVAL '3 days')
    ORDER BY t.fecha_limite NULLS LAST LIMIT 10
  ) s) AS tareas_sin_avance,
  (SELECT COALESCE(json_agg(m), '[]'::json) FROM (SELECT id,titulo,fecha_reunion,discord_event_url FROM pm_reuniones WHERE estado='programada' AND fecha_reunion BETWEEN NOW() AND NOW() + INTERVAL '24 hours' ORDER BY fecha_reunion LIMIT 5) m) AS reuniones_24h,
  (SELECT COUNT(*) FROM pm_bloqueos WHERE estado <> 'resuelto') AS bloqueos_activos,
  (SELECT COUNT(*) FROM pm_riesgos WHERE estado='abierto' AND prioridad_calculada IN ('alta','critica')) AS riesgos_altos;`;

const remindersFormatCode = code(function(){
const row = $json; const ctx = $('Execute Workflow Trigger').item?.json || {};
const tareas = typeof row.tareas_atrasadas === 'string' ? JSON.parse(row.tareas_atrasadas) : row.tareas_atrasadas;
const entregables = typeof row.entregables_proximos === 'string' ? JSON.parse(row.entregables_proximos) : row.entregables_proximos;
const sinAvance = typeof row.tareas_sin_avance === 'string' ? JSON.parse(row.tareas_sin_avance) : row.tareas_sin_avance;
const reuniones = typeof row.reuniones_24h === 'string' ? JSON.parse(row.reuniones_24h) : row.reuniones_24h;
const lines = ['Recordatorio PM PetSafe'];
if (tareas.length) lines.push('Tareas atrasadas:', ...tareas.map(t => `- #${t.id} ${t.titulo} - ${t.responsable || 'sin responsable'} - ${t.dias_atraso} dia(s)`));
if (entregables.length) lines.push('Entregables proximos/vencidos:', ...entregables.map(e => `- #${e.id} ${e.nombre} - ${e.responsable || 'sin responsable'} - ${e.dias_restantes} dia(s)`));
if (sinAvance.length) lines.push('Tareas sin avance registrado en 3 dias:', ...sinAvance.map(t => `- #${t.id} ${t.titulo} - ${t.responsable || 'sin responsable'}`));
if (reuniones.length) lines.push('Reuniones proximas 24h:', ...reuniones.map(m => `- #${m.id} ${m.titulo} - ${m.fecha_reunion}${m.discord_event_url ? ' - ' + m.discord_event_url : ''}`));
if (Number(row.bloqueos_activos) > 0) lines.push(`Bloqueos activos: ${row.bloqueos_activos}. Revisar #bloqueos.`);
if (Number(row.riesgos_altos) > 0) lines.push(`Riesgos altos/criticos abiertos: ${row.riesgos_altos}. Revisar #riesgos.`);
if (lines.length === 1) lines.push('Sin atrasos, entregables criticos ni silencios de avance relevantes.');
const respuesta = lines.join('\n');
return [{ json: { respuesta, canal_destino: 'DISCORD_CHANNEL_REPORTES', canal_id: process.env.DISCORD_CHANNEL_REPORTES || ctx.canal_origen, should_publish: true } }];
});

writeWorkflow(path.join(pmoDir, 'WF_PM_Recordatorios.json'), workflow('wf-pm-recordatorios', 'WF_PM_Recordatorios', [
  node('schedule', 'Daily Reminder Trigger', 'n8n-nodes-base.scheduleTrigger', 1.1, [0, -120], { rule: { interval: [{ field: 'cronExpression', expression: '0 8 * * 1-5' }] } }),
  trigger,
  pgNode('query-reminders', 'Query Reminder Data', [260, 0], remindersQuery),
  node('format-reminders', 'Format Reminder', 'n8n-nodes-base.code', 2, [520, 0], { jsCode: remindersFormatCode }),
  pgNode('queue-reminder', 'Queue Reminder To Discord', [780, 0], outboxReportQuery, {
    queryReplacement: '={{ [ "pm-reminder-" + Date.now(), JSON.stringify({ content: $json.respuesta, channel_id: $json.canal_id }) ] }}',
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
schema.active = false;
schema.settings = settings;
const createTables = schema.nodes.find((n) => n.name === 'Create PM Tables');
if (createTables) {
  if (!createTables.parameters.query.includes('fecha_inicio date,')) {
    createTables.parameters.query = createTables.parameters.query.replace(
      '  fecha_limite date,\n  entregable text,',
      '  fecha_inicio date,\n  fecha_limite date,\n  entregable text,'
    );
  }
  if (!createTables.parameters.query.includes('trello_card_id text,\n  creado_por text,')) {
    createTables.parameters.query = createTables.parameters.query.replace(
      '  tipo text DEFAULT \'tecnico\' CHECK (tipo IN (\'tecnico\',\'academico\',\'documentacion\',\'prototipo\',\'informe\')),\n  creado_por text,',
      '  tipo text DEFAULT \'tecnico\' CHECK (tipo IN (\'tecnico\',\'academico\',\'documentacion\',\'prototipo\',\'informe\')),\n  trello_card_id text,\n  creado_por text,'
    );
  }
  if (!createTables.parameters.query.includes('ALTER TABLE pm_tareas ADD COLUMN IF NOT EXISTS fecha_inicio')) {
    createTables.parameters.query = createTables.parameters.query.replace(
      "SELECT 'PM Schema Manager: All tables created/validated successfully' AS result;",
      `ALTER TABLE pm_tareas ADD COLUMN IF NOT EXISTS fecha_inicio date;
ALTER TABLE pm_entregables ADD COLUMN IF NOT EXISTS trello_card_id text;
ALTER TABLE pm_reuniones ADD COLUMN IF NOT EXISTS duracion_minutos integer NOT NULL DEFAULT 45;
ALTER TABLE pm_reuniones ADD COLUMN IF NOT EXISTS lugar text;
ALTER TABLE pm_reuniones ADD COLUMN IF NOT EXISTS discord_event_id text;
ALTER TABLE pm_reuniones ADD COLUMN IF NOT EXISTS discord_event_url text;
ALTER TABLE pm_reuniones ADD COLUMN IF NOT EXISTS discord_event_status text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_tareas_trello_card_id_unique ON pm_tareas(trello_card_id) WHERE trello_card_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_entregables_trello_card_id_unique ON pm_entregables(trello_card_id) WHERE trello_card_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pm_reuniones_discord_event ON pm_reuniones(discord_event_id);

SELECT 'PM Schema Manager: All tables created/validated successfully' AS result;`
    );
  }
  if (!createTables.parameters.query.includes('ALTER TABLE pm_reuniones ADD COLUMN IF NOT EXISTS discord_event_id')) {
    createTables.parameters.query = createTables.parameters.query.replace(
      "SELECT 'PM Schema Manager: All tables created/validated successfully' AS result;",
      `ALTER TABLE pm_reuniones ADD COLUMN IF NOT EXISTS duracion_minutos integer NOT NULL DEFAULT 45;
ALTER TABLE pm_reuniones ADD COLUMN IF NOT EXISTS lugar text;
ALTER TABLE pm_reuniones ADD COLUMN IF NOT EXISTS discord_event_id text;
ALTER TABLE pm_reuniones ADD COLUMN IF NOT EXISTS discord_event_url text;
ALTER TABLE pm_reuniones ADD COLUMN IF NOT EXISTS discord_event_status text;
CREATE INDEX IF NOT EXISTS idx_pm_reuniones_discord_event ON pm_reuniones(discord_event_id);

SELECT 'PM Schema Manager: All tables created/validated successfully' AS result;`
    );
  }
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
    queryReplacement: '={{ [ "pm-error-" + Date.now(), JSON.stringify({ content: $("Format Error").item.json.content, channel_id: $("Format Error").item.json.channel_id }) ] }}',
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
  if (router?.parameters?.jsCode) {
    router.parameters.jsCode = router.parameters.jsCode
      .replace(/pregunta\.startsWith\('!'\)/g, "/^\\//.test(pregunta)")
      .replace(/case '!/g, "case '/")
      .replace(/`!([^`]+)`/g, '`/$1`')
      .replace(/Comando \\`\$\{cmd\}\\` no reconocido\. Usa \\`!ayuda\\`/g, 'Comando `${cmd}` no reconocido. Usa `/ayuda`');
  }
  const helpNode = wf.nodes.find((n) => n.name === 'Resp Ayuda1');
  if (helpNode?.parameters?.responseBody) {
    helpNode.parameters.responseBody = helpNode.parameters.responseBody
      .replace(/`!([^`]+)`/g, '`/$1`')
      .replace(/!reunion/g, '/reunion')
      .replace(/!reporte/g, '/reporte')
      .replace(/!pto/g, '/pto');
  }
  for (const n of wf.nodes) {
    if (n.parameters?.jsCode) {
      n.parameters.jsCode = n.parameters.jsCode
        .replace(/`!([^`]+)`/g, '`/$1`')
        .replace(/usa !ayuda/ig, 'usa /ayuda');
    }
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
