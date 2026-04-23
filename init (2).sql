-- =========================================================
-- Schema n8n (workflows internos de n8n)
-- =========================================================
CREATE SCHEMA IF NOT EXISTS n8n;

-- =========================================================
-- Análisis generados por el monitor
-- =========================================================
CREATE TABLE IF NOT EXISTS analisis_proyecto (
  id SERIAL PRIMARY KEY,
  fecha_ejecucion TIMESTAMPTZ DEFAULT NOW(),
  hay_problemas BOOLEAN DEFAULT FALSE,
  total_tareas INT,
  tareas_completadas INT,
  tareas_vencidas INT,
  progreso_pct INT,
  commits_backend INT,
  commits_frontend INT,
  prs_abiertos_backend INT,
  prs_abiertos_frontend INT,
  problemas_detectados JSONB,
  cantidad_problemas INT,
  severidad_maxima VARCHAR(10),
  metricas_json JSONB,
  kpis_json JSONB,
  recomendaciones_ia TEXT,
  alerta_enviada BOOLEAN DEFAULT FALSE
);

-- =========================================================
-- Snapshot de tarjetas por ejecución (tendencias + delta)
-- =========================================================
CREATE TABLE IF NOT EXISTS estado_tareas (
  id SERIAL PRIMARY KEY,
  analisis_id INT REFERENCES analisis_proyecto(id) ON DELETE CASCADE,
  fecha TIMESTAMPTZ DEFAULT NOW(),
  card_id VARCHAR(100),
  card_nombre TEXT,
  lista_nombre VARCHAR(100),
  miembro_id VARCHAR(100),
  miembro_nombre VARCHAR(200),
  fecha_vencimiento TIMESTAMPTZ,
  completada BOOLEAN,
  tiene_adjuntos BOOLEAN,
  adjuntos_count INT DEFAULT 0,
  contenido_pdf TEXT
);

CREATE INDEX IF NOT EXISTS idx_estado_tareas_card ON estado_tareas(card_id, fecha DESC);

-- =========================================================
-- Recomendaciones + Q&A del chat
-- =========================================================
CREATE TABLE IF NOT EXISTS recomendaciones (
  id SERIAL PRIMARY KEY,
  analisis_id INT REFERENCES analisis_proyecto(id) ON DELETE SET NULL,
  fecha TIMESTAMPTZ DEFAULT NOW(),
  tipo VARCHAR(50),
  descripcion TEXT,
  pregunta TEXT,
  respuesta TEXT,
  usuario VARCHAR(200),
  aplicada BOOLEAN DEFAULT FALSE,
  fecha_aplicada TIMESTAMPTZ
);

-- =========================================================
-- Hitos del proyecto (extraídos del Gantt)
-- =========================================================
CREATE TABLE IF NOT EXISTS hitos_proyecto (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  fecha_inicio DATE,
  fecha_fin DATE NOT NULL,
  descripcion TEXT,
  responsable VARCHAR(200),
  completado BOOLEAN DEFAULT FALSE
);

INSERT INTO hitos_proyecto (nombre, tipo, fecha_inicio, fecha_fin, responsable) VALUES
  ('Planificación', 'fase', '2026-03-02', '2026-03-03', 'Joel Bonilla'),
  ('Análisis de requerimientos', 'fase', '2026-03-04', '2026-03-10', 'Equipo'),
  ('Diseño', 'fase', '2026-03-11', '2026-03-24', 'Equipo'),
  ('Desarrollo', 'fase', '2026-03-25', '2026-05-18', 'Equipo'),
  ('Seguimiento y Control', 'fase', '2026-05-19', '2026-06-02', 'Equipo'),
  ('Cierre', 'fase', '2026-06-03', '2026-06-10', 'Joel Bonilla'),
  ('Entrega de documentación', 'entrega', '2026-06-04', '2026-06-08', 'Joel Bonilla'),
  ('Capacitaciones', 'demo', '2026-06-09', '2026-06-10', 'Joel Bonilla'),
  ('FIN del proyecto', 'entrega_final', '2026-06-10', '2026-06-10', 'Joel Bonilla')
ON CONFLICT DO NOTHING;

-- =========================================================
-- Estado conocido (singleton) — base para delta detector
-- =========================================================
CREATE TABLE IF NOT EXISTS estado_conocido (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  snapshot JSONB DEFAULT '{}'::jsonb,
  actualizado TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO estado_conocido (id, snapshot)
VALUES (1, '{"main_commit_back_sha": null, "main_commit_front_sha": null, "card_states": {}}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- =========================================================
-- Reportes PDF generados
-- =========================================================
CREATE TABLE IF NOT EXISTS reportes_generados (
  id SERIAL PRIMARY KEY,
  fecha TIMESTAMPTZ DEFAULT NOW(),
  tipo VARCHAR(30),
  rango_dias INT,
  enviado_discord BOOLEAN DEFAULT FALSE,
  enviado_email BOOLEAN DEFAULT FALSE,
  destinatarios TEXT[],
  resumen TEXT
);

-- =========================================================
-- Destinatarios de reportes (editables)
-- =========================================================
CREATE TABLE IF NOT EXISTS destinatarios_reporte (
  id SERIAL PRIMARY KEY,
  email VARCHAR(200) UNIQUE NOT NULL,
  nombre VARCHAR(200),
  activo BOOLEAN DEFAULT TRUE
);

INSERT INTO destinatarios_reporte (email, nombre) VALUES
  ('bjeferssonvinicio2005@gmail.com', 'Joel (Gestor)')
ON CONFLICT DO NOTHING;

-- =========================================================
-- Eventos detectados por el delta detector
-- =========================================================
CREATE TABLE IF NOT EXISTS eventos_detectados (
  id SERIAL PRIMARY KEY,
  fecha TIMESTAMPTZ DEFAULT NOW(),
  tipo VARCHAR(50),
  descripcion TEXT,
  detalle JSONB,
  notificado BOOLEAN DEFAULT FALSE
);

-- =========================================================
-- Vista de tendencias (fix: fecha_ejecucion)
-- =========================================================
CREATE OR REPLACE VIEW tendencias_proyecto AS
SELECT
  DATE_TRUNC('week', fecha_ejecucion) AS semana,
  AVG(progreso_pct)::INT AS progreso_promedio,
  SUM(tareas_vencidas) AS total_vencidas,
  AVG(cantidad_problemas)::NUMERIC(4,1) AS promedio_problemas,
  COUNT(*) AS ejecuciones
FROM analisis_proyecto
GROUP BY DATE_TRUNC('week', fecha_ejecucion)
ORDER BY semana DESC;
