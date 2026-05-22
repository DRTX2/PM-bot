const gem = $json;
const data = $node['Build Report Data'].json;
const LOGO_B64 = '__LOGO_B64__';

// Parse Gemini response
let rawText = gem?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
rawText = rawText.replace(/^```json?\s*/i, '').replace(/```$/, '').trim();
let gemAnalysis = {};
try { gemAnalysis = JSON.parse(rawText); } catch(e) { gemAnalysis = { resumen_html: rawText }; }

const summaryHtml = gemAnalysis.resumen_html || '<p>Resumen no disponible.</p>';
const analisisCommits = gemAnalysis.analisis_commits || [];
const deudaTecnica = gemAnalysis.deuda_tecnica || { score: 0, señales: [] };
const sugerenciasMejora = gemAnalysis.sugerencias_mejora || [];

const fmt = (d) => d ? new Date(d).toLocaleDateString('es-EC',{timeZone:'America/Guayaquil',year:'numeric',month:'short',day:'numeric'}) : '-';
const esc = (s) => String(s??'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const k = data.kpis || {};
const fechaLocal = data.fecha_reporte_local || new Date().toLocaleString('es-EC');

// --- KPI rows ---
const rowsKpis = [
  ['Progreso general', `${data.ultimo_analisis.progreso_pct||0}%`],
  ['Velocidad (tareas/sem)', k.velocidad_semana??'-'],
  ['% Tareas a tiempo', k.pct_a_tiempo!=null?k.pct_a_tiempo+'%':'-'],
  ['Commits/día (back)', k.commits_por_dia_back??'-'],
  ['Commits/día (front)', k.commits_por_dia_front??'-'],
  ['PR open time (h) back', k.pr_open_time_back??'-'],
  ['PR merge ratio', k.pr_merge_ratio??'-'],
  ['Días restantes', k.dias_hasta_fin??'-'],
  ['Proyección', k.proyeccion_a_tiempo?'A tiempo':'En riesgo']
];
const trHtml=(arr)=>arr.map(r=>`<tr><td class="kl">${esc(r[0])}</td><td class="kv">${esc(r[1])}</td></tr>`).join('');

// --- Tendencia ---
const tendHtml = data.tendencia
  ? `<div class="trend"><div class="ts"><span class="tl">Anterior</span><span class="tv">${data.tendencia.progreso_inicial}%</span></div><div class="ta">→</div><div class="ts"><span class="tl">Actual</span><span class="tv">${data.tendencia.progreso_final}%</span></div><div class="ts hl"><span class="tl">Δ</span><span class="tv ${data.tendencia.delta>=0?'ok':'bad'}">${data.tendencia.delta>=0?'+':''}${data.tendencia.delta}pts</span></div></div>`
  : '<p class="muted">Datos insuficientes para tendencia.</p>';

// --- Tareas Vencidas ---
const vencHtml = data.tareas_vencidas.length
  ? `<table class="dt"><thead><tr><th>Tarea</th><th>Lista</th><th>Responsable</th><th>Vencida</th></tr></thead><tbody>${data.tareas_vencidas.map(v=>`<tr><td><strong>${esc(v.card_nombre)}</strong></td><td>${esc(v.lista_nombre)}</td><td>${esc(v.miembro_nombre||'Sin asignar')}</td><td class="bad">${fmt(v.fecha_vencimiento)}</td></tr>`).join('')}</tbody></table>`
  : '<div class="ok-box">✓ No hay tareas vencidas.</div>';

// --- Hitos ---
const hitosHtml = data.hitos_proximos.length
  ? `<table class="dt"><thead><tr><th>Hito</th><th>Tipo</th><th>Fecha Límite</th><th>Responsable</th></tr></thead><tbody>${data.hitos_proximos.map(h=>`<tr><td><strong>${esc(h.nombre)}</strong></td><td><span class="badge">${esc(h.tipo)}</span></td><td>${fmt(h.fecha_fin)}</td><td>${esc(h.responsable||'Equipo')}</td></tr>`).join('')}</tbody></table>`
  : '<p class="muted">Sin hitos próximos.</p>';

// --- Análisis Técnico de Actividad (from Gemini) ---
let actividadHtml = '';
if (analisisCommits.length > 0) {
  actividadHtml = analisisCommits.map(ac => `
    <div class="act-card">
      <div class="act-head">
        <span class="badge ${ac.fuente==='backend'?'bg-back':'bg-front'}">${esc(ac.fuente)}</span>
        <span class="act-id">${esc(ac.tipo==='pr'?'PR #'+ac.id:ac.id)}</span>
        <span class="act-author">${esc(ac.autor)}</span>
        <span class="act-date">${fmt(ac.fecha)}</span>
      </div>
      <div class="act-title">${esc(ac.titulo)}</div>
      <div class="act-body">
        <div class="act-row"><strong>Contexto:</strong> ${esc(ac.contexto_tecnico||'-')}</div>
        <div class="act-row"><strong>Módulos:</strong> ${(ac.modulos_impactados||[]).map(m=>'<span class="tag">'+esc(m)+'</span>').join(' ')||'-'}</div>
        <div class="act-row"><strong>Revisión:</strong> ${(ac.aspectos_revision||[]).map(a=>'<span class="tag warn">'+esc(a)+'</span>').join(' ')||'Ninguno'}</div>
        <div class="act-row"><strong>Testing:</strong> ${esc(ac.testing||'Sin evidencia')}</div>
        <div class="act-row"><strong>Calidad:</strong> ${esc(ac.calidad||'-')}</div>
      </div>
    </div>`).join('');
} else {
  // Fallback: simple commit list
  const mkRow=(c)=>`<tr><td><span class="badge ${c.repo==='backend'?'bg-back':'bg-front'}">${c.repo}</span></td><td><code>${esc(c.sha)}</code></td><td>${esc(c.autor)}</td><td>${esc(c.mensaje)}</td><td>${fmt(c.fecha)}</td></tr>`;
  actividadHtml = `<table class="dt"><thead><tr><th>Fuente</th><th>ID</th><th>Autor</th><th>Mensaje</th><th>Fecha</th></tr></thead><tbody>${[...data.commits_back,...data.commits_front].slice(0,15).map(mkRow).join('')}</tbody></table>`;
}

// --- Ranking Participantes ---
const rankHtml = (data.ranking||[]).length > 0
  ? `<table class="dt"><thead><tr><th>#</th><th>Participante</th><th>Commits</th><th>PRs Merged</th><th>Score</th><th>Observación</th></tr></thead><tbody>${data.ranking.slice(0,3).map((r,i)=>{
      let obs = [];
      if(r.commits_back>0&&r.commits_front>0) obs.push('Full-stack');
      if(r.rework_commits>0) obs.push(r.rework_commits+' correctivos');
      if(r.prs_open>0) obs.push(r.prs_open+' PRs abiertos');
      return `<tr><td><strong>${i+1}</strong></td><td><strong>${esc(r.nombre)}</strong></td><td>${r.total_commits}</td><td>${r.prs_merged}</td><td>${r.score}</td><td>${obs.join(', ')||'Buen desempeño'}</td></tr>`;
    }).join('')}</tbody></table>`
  : '<p class="muted">Sin datos de participantes.</p>';

// --- Cambios sin integrar ---
const sinIntegrarHtml = (data.cambios_sin_integrar||[]).length > 0
  ? `<div class="warn-box">⚠️ Los siguientes participantes tienen cambios sin integrar a develop por más de 7 días:</div><table class="dt"><thead><tr><th>PR</th><th>Autor</th><th>Branch</th><th>Repo</th><th>Días abierto</th></tr></thead><tbody>${data.cambios_sin_integrar.map(c=>`<tr><td><strong>#${c.numero}</strong> ${esc(c.titulo)}</td><td>${esc(c.autor)}</td><td><code>${esc(c.branch)}</code></td><td>${esc(c.repo)}</td><td class="bad">${c.dias_abierto}d</td></tr>`).join('')}</tbody></table>`
  : '<div class="ok-box">✓ Todos los cambios están integrados.</div>';

// --- Retrabajo ---
const retrabajoHtml = (data.retrabajo||[]).length > 0
  ? `<table class="dt"><thead><tr><th>Módulo/Área</th><th>Commits Totales</th><th>Correctivos</th><th>Autores</th></tr></thead><tbody>${data.retrabajo.map(r=>`<tr><td><strong>${esc(r.modulo)}</strong></td><td>${r.total_commits}</td><td class="bad">${r.commits_correctivos}</td><td>${r.autores.map(a=>esc(a)).join(', ')}</td></tr>`).join('')}</tbody></table>`
  : '<div class="ok-box">✓ No se detectó retrabajo significativo.</div>';

// --- Deuda Técnica ---
const debtScore = deudaTecnica.score || 0;
const debtColor = debtScore >= 0.6 ? '#DC2626' : debtScore >= 0.3 ? '#D97706' : '#059669';
const debtLabel = debtScore >= 0.6 ? 'ALTA' : debtScore >= 0.3 ? 'MEDIA' : 'BAJA';
const debtHtml = `
  <div class="debt-meter"><div class="debt-bar" style="width:${Math.round(debtScore*100)}%;background:${debtColor}"></div></div>
  <p>Nivel: <strong style="color:${debtColor}">${debtLabel} (${Math.round(debtScore*100)}%)</strong></p>
  ${(deudaTecnica.señales||[]).length?'<ul>'+deudaTecnica.señales.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul>':'<p class="muted">Sin señales de deuda técnica.</p>'}`;

// --- Sugerencias ---
const sugHtml = sugerenciasMejora.length
  ? '<ul>'+sugerenciasMejora.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul>'
  : '<p class="muted">Sin sugerencias adicionales.</p>';

// --- Recomendaciones pendientes ---
const recosHtml = data.recomendaciones_pendientes.length
  ? `<div class="act-items">${data.recomendaciones_pendientes.slice(0,8).map(r=>`<div class="act-item"><div class="act-icon">⚠️</div><div class="act-text">${esc((r.descripcion||'').substring(0,300))} <span class="muted">(${fmt(r.fecha)})</span></div></div>`).join('')}</div>`
  : '';

// ===================== BUILD HTML =====================
const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>Reporte de Avance - PetSafe</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:22mm 15mm 20mm 15mm;
  @bottom-center{content:"CONFIDENCIAL — STRATIUM · PetSafe PMO — Pág " counter(page) " / " counter(pages);font-family:'Inter',sans-serif;font-size:7pt;color:#64748B;}
}
:root{--gold:#C8A951;--dark:#0F172A;--sec:#1E293B;--accent:#2563EB;--bg:#F8FAFC;--border:#E2E8F0;--muted:#64748B;--ok:#059669;--bad:#DC2626;--warn:#D97706;}
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Inter',sans-serif;color:#334155;font-size:9.5pt;line-height:1.5;}

/* Header STRATIUM */
.hdr{border:2px solid var(--dark);margin-bottom:8mm;page-break-after:avoid;}
.hdr table{width:100%;border-collapse:collapse;}
.hdr td,.hdr th{border:1px solid var(--dark);padding:2mm 3mm;font-size:8pt;vertical-align:middle;}
.hdr .logo-cell{width:22%;text-align:center;background:var(--dark);}
.hdr .logo-cell img{height:18mm;width:auto;}
.hdr .company-cell{text-align:center;background:linear-gradient(135deg,var(--dark),#1a2744);color:white;font-weight:700;font-size:11pt;letter-spacing:0.5px;}
.hdr .meta-cell{font-size:7.5pt;color:var(--sec);padding:1.5mm 3mm;}
.hdr .meta-cell strong{color:var(--dark);}
.hdr .title-cell{background:var(--bg);font-weight:600;font-size:10pt;color:var(--dark);}

/* Sections */
.sec{font-size:13pt;color:var(--sec);border-bottom:3px solid var(--gold);padding-bottom:2mm;margin:10mm 0 5mm 0;page-break-after:avoid;font-weight:700;}
.sec span{color:var(--gold);margin-right:2mm;}
.subsec{font-size:11pt;color:var(--sec);margin:6mm 0 3mm 0;font-weight:600;border-left:3px solid var(--gold);padding-left:3mm;}

/* KPI */
.kpi-grid{display:grid;grid-template-columns:1fr 1fr;gap:4mm;margin-bottom:8mm;}
.kpi-table{width:100%;border-collapse:collapse;}
.kpi-table td{padding:2mm 0;border-bottom:1px dashed var(--border);}
.kl{color:var(--muted);font-size:8.5pt;}
.kv{text-align:right;font-weight:600;color:var(--dark);}

/* Data Tables */
.dt{width:100%;border-collapse:collapse;margin-bottom:6mm;font-size:8.5pt;}
.dt th{background:var(--dark);color:white;font-weight:600;text-transform:uppercase;font-size:7pt;letter-spacing:0.5px;text-align:left;padding:2.5mm 3mm;}
.dt td{padding:2.5mm 3mm;border-bottom:1px solid var(--border);vertical-align:top;}
.dt tbody tr:nth-child(even){background:#FAFAFA;}

/* Badges */
.badge{display:inline-block;padding:0.8mm 2.5mm;border-radius:3px;font-size:6.5pt;font-weight:600;text-transform:uppercase;background:#E0F2FE;color:#0284C7;}
.bg-back{background:#DBEAFE;color:#1E40AF;}
.bg-front{background:#FEF3C7;color:#92400E;}
.tag{display:inline-block;padding:0.5mm 2mm;border-radius:3px;font-size:6.5pt;background:#F1F5F9;color:#475569;margin:0.5mm;}
.tag.warn{background:#FEF3C7;color:#92400E;}

/* Activity cards */
.act-card{border:1px solid var(--border);border-radius:6px;padding:3mm;margin-bottom:3mm;page-break-inside:avoid;}
.act-head{display:flex;align-items:center;gap:2mm;margin-bottom:1.5mm;font-size:8pt;}
.act-id{font-family:monospace;color:var(--accent);font-weight:600;}
.act-author{font-weight:600;color:var(--sec);}
.act-date{color:var(--muted);font-size:7pt;margin-left:auto;}
.act-title{font-weight:600;font-size:9pt;margin-bottom:2mm;color:var(--dark);}
.act-body{font-size:8pt;}
.act-row{margin-bottom:1mm;}
.act-row strong{color:var(--sec);}

/* Trend */
.trend{display:flex;align-items:center;justify-content:space-around;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:4mm;margin-bottom:8mm;}
.ts{text-align:center;}.tl{display:block;font-size:7pt;text-transform:uppercase;color:var(--muted);}.tv{font-size:16pt;font-weight:700;color:var(--dark);}
.ta{font-size:18pt;color:var(--border);}.hl{background:white;padding:2mm 4mm;border-radius:5px;box-shadow:0 1px 3px rgba(0,0,0,0.05);}
.ok{color:var(--ok);}.bad{color:var(--bad);}

/* Debt meter */
.debt-meter{width:100%;height:8px;background:#E2E8F0;border-radius:4px;margin:3mm 0;overflow:hidden;}
.debt-bar{height:100%;border-radius:4px;transition:width 0.3s;}

/* Utility */
.muted{color:var(--muted);font-style:italic;font-size:8.5pt;}
.ok-box{background:#ECFDF5;color:#065F46;padding:3mm;border-radius:5px;border:1px solid #A7F3D0;font-weight:500;margin-bottom:5mm;font-size:8.5pt;}
.warn-box{background:#FFFBEB;color:#92400E;padding:3mm;border-radius:5px;border:1px solid #FEF3C7;font-weight:500;margin-bottom:3mm;font-size:8.5pt;}
.exec-summary{background:linear-gradient(135deg,#EFF6FF,#F0F9FF);border:1px solid #BFDBFE;border-radius:8px;padding:5mm 6mm;margin-bottom:8mm;}
.exec-summary h3{color:var(--accent);font-size:10pt;margin:3mm 0 2mm 0;}
.exec-summary p{margin-bottom:2mm;font-size:9pt;}
.exec-summary ul{margin:1mm 0 2mm 4mm;font-size:8.5pt;}
.exec-summary li{margin-bottom:1mm;}

/* Alerts */
.act-items{display:flex;flex-direction:column;gap:2mm;margin-bottom:6mm;}
.act-item{display:flex;gap:2mm;background:#FFFBEB;border:1px solid #FEF3C7;padding:2mm 3mm;border-radius:5px;font-size:8.5pt;}
.act-icon{flex-shrink:0;}.act-text{color:#92400E;}

/* Signatures */
.sig-table{width:100%;border-collapse:collapse;margin-top:8mm;}
.sig-table td{border:1px solid var(--border);padding:3mm;text-align:center;font-size:8pt;height:15mm;vertical-align:bottom;}
.sig-table .sig-label{font-weight:600;color:var(--sec);font-size:7pt;text-transform:uppercase;background:var(--bg);}
code{font-family:monospace;font-size:8pt;background:#F1F5F9;padding:0.5mm 1.5mm;border-radius:2px;}
</style>
</head>
<body>

<!-- HEADER STRATIUM -->
<div class="hdr">
<table>
<tr>
  <td class="logo-cell" rowspan="4"><img src="data:image/png;base64,${LOGO_B64}" alt="STRATIUM"/></td>
  <td class="company-cell" colspan="1" rowspan="2">STRATIUM — DESARROLLO DE SOFTWARE</td>
  <td class="meta-cell"><strong>CÓDIGO:</strong> MON-SEG-RGI-001</td>
</tr>
<tr><td class="meta-cell"><strong>VERSIÓN:</strong> 2.0</td></tr>
<tr><td class="title-cell" rowspan="2">Reporte de Avance y Gestión — PetSafe</td><td class="meta-cell"><strong>ELABORACIÓN:</strong> ${esc(fechaLocal)}</td></tr>
<tr><td class="meta-cell"><strong>PROCESO:</strong> Monitoreo y Control</td></tr>
</table>
</div>

<!-- 1. RESUMEN EJECUTIVO -->
<h2 class="sec"><span>1.</span> Resumen Ejecutivo</h2>
<div class="exec-summary">${summaryHtml}</div>

<!-- 2. KPIs -->
<h2 class="sec"><span>2.</span> Indicadores de Rendimiento (KPIs)</h2>
<div class="kpi-grid">
  <table class="kpi-table"><tbody>${trHtml(rowsKpis.slice(0,5))}</tbody></table>
  <table class="kpi-table"><tbody>${trHtml(rowsKpis.slice(5))}</tbody></table>
</div>

<!-- 3. EVOLUCIÓN -->
<h2 class="sec"><span>3.</span> Evolución del Progreso</h2>
${tendHtml}

<!-- 4. REGISTRO DE ACTIVIDAD TÉCNICA -->
<h2 class="sec"><span>4.</span> Registro de Actividad Técnica</h2>
${actividadHtml}

<!-- 4.1 Cambios sin integrar -->
<h3 class="subsec">4.1 Cambios Pendientes de Integración</h3>
${sinIntegrarHtml}

<!-- 5. ANÁLISIS DEL PERIODO -->
<h2 class="sec"><span>5.</span> Análisis del Periodo</h2>

<h3 class="subsec">5.1 Participantes Destacados</h3>
${rankHtml}

<h3 class="subsec">5.2 Detección de Retrabajo</h3>
${retrabajoHtml}

<h3 class="subsec">5.3 Deuda Técnica</h3>
${debtHtml}

<h3 class="subsec">5.4 Sugerencias de Mejora Continua</h3>
${sugHtml}

<!-- 6. TAREAS VENCIDAS -->
<h2 class="sec"><span>6.</span> Atención Requerida: Tareas Vencidas</h2>
${vencHtml}

<!-- 7. HITOS -->
${data.hitos_proximos.length?'<h2 class="sec"><span>7.</span> Roadmap: Hitos a 30 Días</h2>':''}
${hitosHtml}

<!-- 8. ACCIONES -->
${data.recomendaciones_pendientes.length?'<h2 class="sec"><span>8.</span> Acciones Estratégicas Sugeridas</h2>':''}
${recosHtml}

<!-- 9. CONTROL DE CAMBIOS -->
<h2 class="sec"><span>9.</span> Control de Cambios</h2>
<table class="dt">
<thead><tr><th>Versión</th><th>Descripción</th><th>Responsable</th><th>Fecha</th></tr></thead>
<tbody>
<tr><td>1.0</td><td>Creación inicial del reporte automatizado</td><td>Bot PM</td><td>12/05/2026</td></tr>
<tr><td>2.0</td><td>Análisis técnico enriquecido, detección de retrabajo, ranking de participantes, formato STRATIUM</td><td>Bot PM</td><td>${fmt(data.fecha_reporte)}</td></tr>
</tbody>
</table>

<!-- FIRMAS -->
<table class="sig-table">
<tr><td class="sig-label">Generado por</td><td class="sig-label">Revisado por</td><td class="sig-label">Aprobado por</td></tr>
<tr><td>Bot PM — Sistema Automatizado<br/>${esc(fechaLocal)}</td><td>David Manjarres — Dev Backend</td><td>Joel Bonilla — Gestor del Proyecto</td></tr>
</table>

</body></html>`;

// Output
const summaryText = 'Reporte PetSafe v2: progreso '+(data.ultimo_analisis.progreso_pct||0)+'%, '+data.tareas_vencidas.length+' vencidas, '+(data.total_commits_back+data.total_commits_front)+' commits, '+(data.total_prs_back+data.total_prs_front)+' PRs, deuda: '+debtLabel;

return [{
  json: {
    summaryText,
    destinatarios: data.destinatarios,
    destinatarios_info: data.destinatarios_info,
    rango_dias: data.rango_dias,
    fecha_reporte_local: data.fecha_reporte_local,
    debt_detected: debtScore >= 0.6,
    debt_details: deudaTecnica,
    ranking: data.ranking
  },
  binary: {
    data: {
      data: Buffer.from(html).toString('base64'),
      mimeType: 'text/html',
      fileName: 'index.html'
    }
  }
}];
