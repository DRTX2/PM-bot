const items = $input.all().map(i => i.json);
const config = $node['Configuración'].json;
const rangoDias = config.rango_dias || 7;
const now = new Date();
const MS_DAY = 86400000;

// --- Arrays ---
let analisis7d = [], vencidas = [], hitos = [], eventos = [], recos = [],
    destinatarios = [], backCommits = [], frontCommits = [],
    backPRs = [], frontPRs = [];

// --- Detection ---
const isCommit = (o) => o && o.sha && o.commit;
const isPR = (o) => o && o.number !== undefined && o.state && o.title && !o.commit;
const isBackend = (o) => {
  const url = o.html_url || o.url || '';
  return url.includes('PetSafe-Back') || url.includes(config.GITHUB_REPO_BACKEND || 'PetSafe-Back');
};
const detectType = (o) => {
  if (!o || typeof o !== 'object') return 'unknown';
  if (isCommit(o)) return 'commit';
  if (isPR(o)) return 'pr';
  if (o.progreso_pct !== undefined) return 'analisis';
  if (o.card_id && o.card_nombre) return 'tarea';
  if (o.email && o.nombre) return 'destinatario';
  if (o.fecha_fin && o.tipo && !o.card_id) return 'hito';
  if (o.descripcion && o.tipo) return o.aplicada !== undefined ? 'recomendacion' : 'evento';
  return 'unknown';
};

// --- Segregate ---
for (const obj of items) {
  const t = detectType(obj);
  if (t === 'commit') { (isBackend(obj) ? backCommits : frontCommits).push(obj); }
  else if (t === 'pr') { (isBackend(obj) ? backPRs : frontPRs).push(obj); }
  else if (t === 'analisis') analisis7d.push(obj);
  else if (t === 'tarea') vencidas.push(obj);
  else if (t === 'destinatario') destinatarios.push(obj);
  else if (t === 'hito') hitos.push(obj);
  else if (t === 'recomendacion') recos.push(obj);
  else if (t === 'evento') eventos.push(obj);
}

analisis7d.sort((a, b) => new Date(b.fecha_ejecucion) - new Date(a.fecha_ejecucion));
const ultimo = analisis7d[0] || {};
const k = ultimo.kpis_json || {};
const kpis = typeof k === 'string' ? JSON.parse(k) : k;

const tendencia = analisis7d.length > 1 ? {
  progreso_inicial: analisis7d[analisis7d.length - 1]?.progreso_pct || 0,
  progreso_final: analisis7d[0]?.progreso_pct || 0,
  delta: (analisis7d[0]?.progreso_pct || 0) - (analisis7d[analisis7d.length - 1]?.progreso_pct || 0),
  ejecuciones: analisis7d.length
} : null;

// ===================== RETRABAJO DETECTION =====================
const REWORK_PATTERNS = /\b(fix|hotfix|bugfix|revert|corr(ige|ect)|arregl|parche|patch|workaround)\b/i;
const allCommits = [...backCommits.map(c => ({...c, repo: 'backend'})), ...frontCommits.map(c => ({...c, repo: 'frontend'}))];

// Track files touched per commit message (proxy for actual files)
const moduleHits = {};  // module -> [{sha, msg, author, date, repo}]
const reworkCommits = [];

for (const c of allCommits) {
  const msg = (c.commit?.message || '').split('\n')[0];
  const author = c.commit?.author?.name || 'Unknown';
  const date = c.commit?.author?.date;
  // Extract module hints from commit message (convention: "feat(auth): ..." or "fix: module X")
  const moduleMatch = msg.match(/^[a-z]+\(([^)]+)\)/i) || msg.match(/(?:modulo?|module|service|controller|component)\s+(\w+)/i);
  const module = moduleMatch ? moduleMatch[1].toLowerCase() : msg.split(':')[0].trim().toLowerCase().slice(0, 30);

  if (!moduleHits[module]) moduleHits[module] = [];
  moduleHits[module].push({ sha: (c.sha||'').slice(0,7), msg, author, date, repo: c.repo });

  if (REWORK_PATTERNS.test(msg)) {
    reworkCommits.push({ sha: (c.sha||'').slice(0,7), msg, author, date, repo: c.repo, module });
  }
}

// Modules with >=3 commits OR >=2 rework-pattern commits → retrabajo
const retrabajo = [];
for (const [mod, hits] of Object.entries(moduleHits)) {
  const reworkHits = hits.filter(h => REWORK_PATTERNS.test(h.msg));
  if (hits.length >= 3 && reworkHits.length >= 2) {
    retrabajo.push({ modulo: mod, total_commits: hits.length, commits_correctivos: reworkHits.length, autores: [...new Set(hits.map(h=>h.author))], commits: hits.slice(0, 5) });
  } else if (reworkHits.length >= 3) {
    retrabajo.push({ modulo: mod, total_commits: hits.length, commits_correctivos: reworkHits.length, autores: [...new Set(hits.map(h=>h.author))], commits: reworkHits.slice(0, 5) });
  }
}

// ===================== PARTICIPANT RANKING =====================
const authorStats = {};
const addStat = (author, field, val = 1) => {
  if (!authorStats[author]) authorStats[author] = { commits_back: 0, commits_front: 0, prs_merged: 0, prs_open: 0, prs_reviewed: 0, rework_commits: 0 };
  authorStats[author][field] = (authorStats[author][field] || 0) + val;
};

for (const c of backCommits) addStat(c.commit?.author?.name || '?', 'commits_back');
for (const c of frontCommits) addStat(c.commit?.author?.name || '?', 'commits_front');
for (const pr of [...backPRs, ...frontPRs]) {
  const author = pr.user?.login || pr.user?.name || '?';
  if (pr.merged_at) addStat(author, 'prs_merged');
  if (pr.state === 'open') addStat(author, 'prs_open');
}
for (const rc of reworkCommits) addStat(rc.author, 'rework_commits');

const ranking = Object.entries(authorStats).map(([name, s]) => {
  const totalCommits = s.commits_back + s.commits_front;
  const score = totalCommits * 1 + s.prs_merged * 3 + s.prs_reviewed * 2
    + ((s.commits_back > 0 && s.commits_front > 0) ? 2 : 0)
    - s.rework_commits * 0.5;
  return { nombre: name, ...s, total_commits: totalCommits, score: Math.round(score * 10) / 10 };
}).sort((a, b) => b.score - a.score).slice(0, 5);

// ===================== UNMERGED CHANGES (PRs open > 7 days) =====================
const cambiosSinIntegrar = [...backPRs, ...frontPRs]
  .filter(pr => pr.state === 'open')
  .filter(pr => {
    const created = new Date(pr.created_at);
    return (now - created) / MS_DAY > 7;
  })
  .map(pr => ({
    numero: pr.number,
    titulo: pr.title,
    autor: pr.user?.login || '?',
    repo: isBackend(pr) ? 'backend' : 'frontend',
    dias_abierto: Math.floor((now - new Date(pr.created_at)) / MS_DAY),
    url: pr.html_url,
    branch: pr.head?.ref || '?'
  }));

// ===================== COMMIT/PR SUMMARIES FOR GEMINI =====================
const simplifyCommit = (c, repo) => ({
  sha: (c.sha||'').slice(0,7), repo,
  autor: c.commit?.author?.name || '?',
  fecha: c.commit?.author?.date,
  mensaje: (c.commit?.message || '').split('\n')[0].slice(0, 120)
});
const simplifyPR = (pr, repo) => ({
  numero: pr.number, repo,
  titulo: (pr.title || '').slice(0, 120),
  autor: pr.user?.login || '?',
  estado: pr.merged_at ? 'merged' : pr.state,
  fecha_creacion: pr.created_at,
  fecha_merge: pr.merged_at,
  branch: pr.head?.ref || '?',
  base: pr.base?.ref || '?',
  body: (pr.body || '').slice(0, 200)
});

const commitsSummary = [
  ...backCommits.slice(0, 15).map(c => simplifyCommit(c, 'backend')),
  ...frontCommits.slice(0, 15).map(c => simplifyCommit(c, 'frontend'))
];
const prsSummary = [
  ...backPRs.slice(0, 10).map(pr => simplifyPR(pr, 'backend')),
  ...frontPRs.slice(0, 10).map(pr => simplifyPR(pr, 'frontend'))
];

// ===================== GEMINI PROMPT =====================
const prompt = `Eres un analista técnico senior. Analiza la actividad de código del proyecto PetSafe (sistema veterinario) y devuelve un JSON con esta estructura exacta:

{
  "resumen_html": "<h3>Estado General</h3><p>...</p><h3>Logros</h3><ul><li>...</li></ul><h3>Riesgos</h3><ul><li>...</li></ul><h3>Próximos Pasos</h3><ul><li>...</li></ul>",
  "analisis_commits": [
    {
      "id": "sha o PR#",
      "tipo": "commit|pr",
      "fuente": "backend|frontend",
      "autor": "nombre",
      "titulo": "mensaje o título del PR",
      "fecha": "ISO date",
      "contexto_tecnico": "descripción clara de qué se hizo en el código y por qué es relevante",
      "modulos_impactados": ["modulo1", "modulo2"],
      "aspectos_revision": ["seguridad|integridad_datos|autenticacion|permisos|rendimiento|mantenibilidad|regresiones"],
      "testing": "evidencia de testing si existe",
      "calidad": "observaciones sobre calidad del código"
    }
  ],
  "deuda_tecnica": {
    "score": 0.0 a 1.0,
    "señales": ["descripción de señal 1"],
    "descripcion_problema": "resumen del problema principal",
    "impacto": "análisis de impacto",
    "recomendacion": "recomendación técnica concreta"
  },
  "sugerencias_mejora": ["sugerencia 1", "sugerencia 2"]
}

REGLAS:
- resumen_html: Resumen ejecutivo en HTML válido (h3, p, ul, li, strong). Tono profesional español. Max 600 palabras.
- analisis_commits: Analiza los commits y PRs más relevantes (max 12). Agrupa commits menores.
- deuda_tecnica.score: 0=sin deuda, 1=deuda crítica. Basarse en: commits correctivos repetidos, falta de testing, código repetido, cambios en la misma área.
- sugerencias_mejora: 3-5 sugerencias accionables para el equipo.
- NO uses markdown, solo JSON válido.

DATOS DEL PERIODO (últimos ${rangoDias} días):

COMMITS (${commitsSummary.length}):
${JSON.stringify(commitsSummary, null, 1)}

PULL REQUESTS (${prsSummary.length}):
${JSON.stringify(prsSummary, null, 1)}

RETRABAJO DETECTADO (${retrabajo.length} módulos):
${JSON.stringify(retrabajo, null, 1)}

KPIs ACTUALES:
${JSON.stringify({ progreso: ultimo.progreso_pct, total_tareas: ultimo.total_tareas, completadas: ultimo.tareas_completadas, vencidas: ultimo.tareas_vencidas, ...kpis }, null, 1)}

CAMBIOS SIN INTEGRAR (PRs abiertos > 7 días): ${cambiosSinIntegrar.length}
${JSON.stringify(cambiosSinIntegrar, null, 1)}

Responde SOLO con el JSON, sin backticks ni texto adicional.`;

// ===================== OUTPUT =====================
const data = {
  fecha_reporte: now.toISOString(),
  fecha_reporte_local: now.toLocaleString('es-EC', { timeZone: 'America/Guayaquil' }),
  rango_dias: rangoDias,
  ultimo_analisis: ultimo,
  kpis, tendencia, analisis_historia: analisis7d,
  tareas_vencidas: vencidas,
  hitos_proximos: hitos,
  eventos_recientes: eventos,
  recomendaciones_pendientes: recos,
  destinatarios: destinatarios.map(d => d.email),
  destinatarios_info: destinatarios,
  // Enriched commit data
  commits_back: backCommits.slice(0, 20).map(c => simplifyCommit(c, 'backend')),
  commits_front: frontCommits.slice(0, 20).map(c => simplifyCommit(c, 'frontend')),
  total_commits_back: backCommits.length,
  total_commits_front: frontCommits.length,
  // NEW: PR data
  prs_back: backPRs.slice(0, 10).map(pr => simplifyPR(pr, 'backend')),
  prs_front: frontPRs.slice(0, 10).map(pr => simplifyPR(pr, 'frontend')),
  total_prs_back: backPRs.length,
  total_prs_front: frontPRs.length,
  // NEW: Analysis
  retrabajo, ranking, cambios_sin_integrar: cambiosSinIntegrar,
  // Gemini
  gemini_key: $env.GEMINI_API_KEY,
  prompt
};

return [{ json: data }];
