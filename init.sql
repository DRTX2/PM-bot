CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE SCHEMA IF NOT EXISTS n8n;

CREATE TABLE IF NOT EXISTS estado_conocido (
    id INTEGER PRIMARY KEY,
    nombre_estado TEXT UNIQUE,
    snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    actualizado TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO estado_conocido (id, nombre_estado, snapshot)
VALUES (1, 'inicializacion_sistema', '{"version":"1.0.0","source":"init.sql"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS analisis_proyecto (
    id BIGSERIAL PRIMARY KEY,
    fecha_ejecucion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    hay_problemas BOOLEAN NOT NULL DEFAULT FALSE,
    total_tareas INTEGER NOT NULL DEFAULT 0,
    tareas_completadas INTEGER NOT NULL DEFAULT 0,
    tareas_vencidas INTEGER NOT NULL DEFAULT 0,
    progreso_pct INTEGER NOT NULL DEFAULT 0,
    commits_backend INTEGER NOT NULL DEFAULT 0,
    commits_frontend INTEGER NOT NULL DEFAULT 0,
    prs_abiertos_backend INTEGER NOT NULL DEFAULT 0,
    prs_abiertos_frontend INTEGER NOT NULL DEFAULT 0,
    problemas_detectados JSONB NOT NULL DEFAULT '[]'::jsonb,
    cantidad_problemas INTEGER NOT NULL DEFAULT 0,
    severidad_maxima TEXT,
    kpis_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    recomendaciones_ia TEXT
);

CREATE INDEX IF NOT EXISTS idx_analisis_fecha ON analisis_proyecto (fecha_ejecucion DESC);
CREATE INDEX IF NOT EXISTS idx_analisis_problemas ON analisis_proyecto (hay_problemas, severidad_maxima);

CREATE TABLE IF NOT EXISTS estado_tareas (
    id BIGSERIAL PRIMARY KEY,
    analisis_id BIGINT REFERENCES analisis_proyecto(id) ON DELETE SET NULL,
    fecha TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    card_id TEXT NOT NULL,
    card_nombre TEXT,
    lista_nombre TEXT,
    miembro_id TEXT,
    miembro_nombre TEXT,
    fecha_vencimiento TIMESTAMP WITH TIME ZONE,
    completada BOOLEAN NOT NULL DEFAULT FALSE,
    tiene_adjuntos BOOLEAN NOT NULL DEFAULT FALSE,
    adjuntos_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_estado_tareas_card_fecha ON estado_tareas (card_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_estado_tareas_vencimiento ON estado_tareas (completada, fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_estado_tareas_miembro ON estado_tareas (miembro_nombre);

CREATE TABLE IF NOT EXISTS hitos_proyecto (
    id BIGSERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL,
    fecha_inicio DATE,
    fecha_fin DATE NOT NULL,
    responsable TEXT,
    completado BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    actualizado TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hitos_fecha_fin ON hitos_proyecto (fecha_fin, completado);

CREATE TABLE IF NOT EXISTS recomendaciones (
    id BIGSERIAL PRIMARY KEY,
    fecha TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    tipo TEXT NOT NULL DEFAULT 'general',
    descripcion TEXT,
    pregunta TEXT,
    respuesta TEXT,
    usuario TEXT,
    aplicada BOOLEAN NOT NULL DEFAULT FALSE,
    detalle JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_recomendaciones_fecha ON recomendaciones (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_recomendaciones_tipo_aplicada ON recomendaciones (tipo, aplicada);

CREATE TABLE IF NOT EXISTS eventos_detectados (
    id BIGSERIAL PRIMARY KEY,
    fecha TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    origen TEXT NOT NULL DEFAULT 'system',
    tipo TEXT NOT NULL,
    descripcion TEXT,
    detalle JSONB NOT NULL DEFAULT '{}'::jsonb,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    notificado BOOLEAN NOT NULL DEFAULT FALSE,
    procesado BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eventos_fecha ON eventos_detectados (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_tipo ON eventos_detectados (tipo);

CREATE TABLE IF NOT EXISTS destinatarios_reporte (
    id BIGSERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    nombre TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reportes_generados (
    id BIGSERIAL PRIMARY KEY,
    fecha TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    tipo TEXT NOT NULL,
    rango_dias INTEGER NOT NULL,
    enviado_discord BOOLEAN NOT NULL DEFAULT FALSE,
    enviado_email BOOLEAN NOT NULL DEFAULT FALSE,
    destinatarios TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    resumen TEXT
);

CREATE INDEX IF NOT EXISTS idx_reportes_fecha ON reportes_generados (fecha DESC);

CREATE TABLE IF NOT EXISTS events_inbox (
    event_id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    event_type TEXT NOT NULL,
    external_id TEXT NOT NULL,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    correlation_id TEXT,
    actor TEXT,
    entity_type TEXT,
    entity_id TEXT,
    repo TEXT,
    trello_card_id TEXT,
    pull_request_number INTEGER,
    commit_sha TEXT,
    payload JSONB NOT NULL,
    normalized JSONB,
    processing_status TEXT NOT NULL DEFAULT 'pending',
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_inbox_status ON events_inbox (processing_status, received_at);
CREATE INDEX IF NOT EXISTS idx_events_inbox_source_type ON events_inbox (source, event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_inbox_correlation ON events_inbox (correlation_id);
CREATE INDEX IF NOT EXISTS idx_events_inbox_trello ON events_inbox (trello_card_id);
CREATE INDEX IF NOT EXISTS idx_events_inbox_pr ON events_inbox (repo, pull_request_number);

CREATE TABLE IF NOT EXISTS events_outbox (
    outbox_id BIGSERIAL PRIMARY KEY,
    event_id TEXT REFERENCES events_inbox(event_id) ON DELETE SET NULL,
    target TEXT NOT NULL,
    action TEXT NOT NULL,
    idempotency_key TEXT UNIQUE,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    retry_count INTEGER NOT NULL DEFAULT 0,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_outbox_status ON events_outbox (status, scheduled_at);

CREATE TABLE IF NOT EXISTS workflow_runs_audit (
    run_id BIGSERIAL PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    workflow_name TEXT,
    status TEXT,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    correlation_id TEXT,
    error_details JSONB,
    metrics JSONB
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_audit_started ON workflow_runs_audit (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_audit_corr ON workflow_runs_audit (correlation_id);

CREATE TABLE IF NOT EXISTS ai_decisions (
    decision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correlation_id TEXT,
    agent_role TEXT NOT NULL,
    decision_type TEXT,
    input_summary TEXT,
    context_used JSONB,
    evidence JSONB,
    decision JSONB NOT NULL,
    recommendation TEXT,
    confidence NUMERIC(4, 3),
    risk_level TEXT,
    requires_human_approval BOOLEAN NOT NULL DEFAULT FALSE,
    approved_by TEXT,
    action_taken TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_decisions_created ON ai_decisions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_corr ON ai_decisions (correlation_id);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_status ON ai_decisions (status, requires_human_approval);

-- Tabla de gestión de fases del proyecto (sincronizada con listas Trello)
CREATE TABLE IF NOT EXISTS project_phases (
    phase_id BIGSERIAL PRIMARY KEY,
    list_id TEXT UNIQUE NOT NULL,           -- ID de lista en Trello
    name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    start_date DATE,
    end_date DATE,
    status TEXT NOT NULL DEFAULT 'active',  -- active | completed | on_hold
    responsible TEXT,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_phases_status ON project_phases (status);
CREATE INDEX IF NOT EXISTS idx_project_phases_dates ON project_phases (start_date, end_date);

-- Tabla de adjuntos con metadatos (evita procesar PDFs innecesariamente)
CREATE TABLE IF NOT EXISTS card_attachments (
    attachment_id TEXT PRIMARY KEY,         -- ID del attachment en Trello
    card_id TEXT NOT NULL,
    card_name TEXT,
    list_id TEXT,
    filename TEXT NOT NULL,
    url TEXT NOT NULL,
    mime_type TEXT,
    file_size_bytes BIGINT,
    added_by TEXT,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    summary_extracted TEXT,                 -- Resumen IA extraído on-demand
    summary_extracted_at TIMESTAMPTZ,
    tokens_used INTEGER
);

CREATE INDEX IF NOT EXISTS idx_card_attachments_card ON card_attachments (card_id);
CREATE INDEX IF NOT EXISTS idx_card_attachments_list ON card_attachments (list_id);
