const fs = require('fs');
const path = require('path');

const workflowPath = path.join(
  __dirname,
  '..',
  '5. 📊 PMO & Reporting (Gestion y Seguimiento)',
  'Reporte PDF Semanal.json',
);

const wf = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
const byName = (name) => {
  const found = wf.nodes.find((node) => node.name === name);
  if (!found) throw new Error(`Missing node: ${name}`);
  return found;
};

const analysisQuery = `
WITH stats AS (
  SELECT
    NOW() AS fecha_ejecucion,
    COUNT(*)::int AS total_tareas,
    COUNT(*) FILTER (WHERE estado = 'completada')::int AS tareas_completadas,
    COUNT(*) FILTER (
      WHERE fecha_limite < (NOW() AT TIME ZONE 'America/Guayaquil')::date
        AND estado NOT IN ('completada','cancelada')
    )::int AS tareas_vencidas
  FROM pm_tareas
),
risks AS (
  SELECT
    COUNT(*) FILTER (WHERE estado = 'abierto')::int AS abiertos,
    COUNT(*) FILTER (WHERE estado = 'abierto' AND prioridad_calculada IN ('alta','critica'))::int AS altos,
    COUNT(*) FILTER (WHERE estado = 'abierto' AND prioridad_calculada = 'critica')::int AS criticos
  FROM pm_riesgos
),
blockers AS (
  SELECT
    COUNT(*) FILTER (WHERE estado <> 'resuelto')::int AS activos,
    COUNT(*) FILTER (WHERE estado <> 'resuelto' AND severidad IN ('alta','critica'))::int AS altos,
    COUNT(*) FILTER (WHERE estado <> 'resuelto' AND severidad = 'critica')::int AS criticos
  FROM pm_bloqueos
)
SELECT
  fecha_ejecucion,
  (tareas_vencidas > 0 OR blockers.altos > 0 OR risks.altos > 0) AS hay_problemas,
  total_tareas,
  tareas_completadas,
  tareas_vencidas,
  CASE WHEN total_tareas = 0 THEN 0 ELSE ROUND((tareas_completadas::numeric / total_tareas) * 100)::int END AS progreso_pct,
  (tareas_vencidas + blockers.altos + risks.altos)::int AS cantidad_problemas,
  CASE
    WHEN blockers.criticos > 0 OR risks.criticos > 0 THEN 'critica'
    WHEN blockers.altos > 0 OR risks.altos > 0 THEN 'alta'
    WHEN tareas_vencidas > 0 THEN 'media'
    ELSE 'baja'
  END AS severidad_maxima,
  json_build_object(
    'velocidad_semana', (
      SELECT COUNT(*) FROM pm_tareas
      WHERE estado = 'completada'
        AND (fecha_actualizacion AT TIME ZONE 'America/Guayaquil')::date >= ((NOW() AT TIME ZONE 'America/Guayaquil')::date - INTERVAL '6 days')
    ),
    'pct_a_tiempo', CASE WHEN total_tareas = 0 THEN 100 ELSE ROUND(((total_tareas - tareas_vencidas)::numeric / total_tareas) * 100)::int END,
    'dias_hasta_fin', COALESCE((SELECT MAX(fecha_limite) - (NOW() AT TIME ZONE 'America/Guayaquil')::date FROM pm_tareas), 0),
    'proyeccion_a_tiempo', (tareas_vencidas = 0 AND blockers.activos = 0),
    'commits_por_dia_back', '-',
    'commits_por_dia_front', '-',
    'pr_open_time_back', '-',
    'pr_merge_ratio', '-'
  ) AS kpis_json
FROM stats
CROSS JOIN risks
CROSS JOIN blockers`;

byName('PG Análisis 7d').parameters.query = analysisQuery;
byName('PG Último Análisis').parameters.query = `SELECT 1 AS id, q.* FROM (${analysisQuery}) q LIMIT 1;`;
byName('PG Tareas Vencidas').parameters.query = `
SELECT
  id::text AS card_id,
  titulo AS card_nombre,
  COALESCE(sprint, 'Sin fase') AS lista_nombre,
  responsable AS miembro_nombre,
  fecha_limite::timestamp with time zone AS fecha_vencimiento
FROM pm_tareas
WHERE estado NOT IN ('completada','cancelada')
  AND fecha_limite < (NOW() AT TIME ZONE 'America/Guayaquil')::date
ORDER BY fecha_limite ASC;`;
byName('PG Hitos Próximos').parameters.query = `
SELECT
  nombre,
  COALESCE(tipo, 'entregable') AS tipo,
  fecha_creacion::date AS fecha_inicio,
  fecha_limite AS fecha_fin,
  responsable,
  estado IN ('entregado','aprobado') AS completado
FROM pm_entregables
WHERE fecha_limite >= (NOW() AT TIME ZONE 'America/Guayaquil')::date
  AND fecha_limite <= (NOW() AT TIME ZONE 'America/Guayaquil')::date + INTERVAL '30 days'
ORDER BY fecha_limite ASC;`;
byName('PG Eventos 7d').parameters.query = `
SELECT
  creado_en AS fecha,
  tipo,
  COALESCE(payload->>'descripcion', payload->>'title', payload->>'message', payload::text) AS descripcion
FROM eventos_detectados
WHERE creado_en >= NOW() - ($1 || ' days')::interval
ORDER BY creado_en DESC
LIMIT 100;`;
byName('PG Recomendaciones').parameters.query = `
SELECT fecha, tipo, descripcion, false AS aplicada
FROM (
  SELECT
    fecha_creacion AS fecha,
    'alerta_ia' AS tipo,
    'Bloqueo #' || id || ': ' || descripcion || '. Accion: ' || COALESCE(accion_recomendada, 'por definir') AS descripcion
  FROM pm_bloqueos
  WHERE estado <> 'resuelto'
  UNION ALL
  SELECT
    fecha_creacion AS fecha,
    'alerta_ia' AS tipo,
    'Riesgo #' || id || ': ' || descripcion || '. Mitigacion: ' || COALESCE(mitigacion, 'por definir') AS descripcion
  FROM pm_riesgos
  WHERE estado = 'abierto'
) x
WHERE fecha >= NOW() - ($1 || ' days')::interval
ORDER BY fecha DESC
LIMIT 20;`;
byName('PG Destinatarios').parameters.query = 'SELECT NULL::text AS email, NULL::text AS nombre WHERE false;';

const smtp = byName('SMTP Enviar Email');
smtp.disabled = true;
smtp.continueOnFail = true;

fs.writeFileSync(workflowPath, `${JSON.stringify(wf, null, 2)}\n`);
