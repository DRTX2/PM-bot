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
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
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
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
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
    approved_at TIMESTAMP WITH TIME ZONE,
    pm_impact TEXT,
    pm_next_action TEXT,
    pm_owner TEXT,
    pm_deadline TIMESTAMP WITH TIME ZONE,
    pm_risk_reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_decisions_created ON ai_decisions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_corr ON ai_decisions (correlation_id);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_status ON ai_decisions (status, requires_human_approval);
CREATE UNIQUE INDEX IF NOT EXISTS ai_decisions_dedupe_idx ON ai_decisions (correlation_id, agent_role, decision_type) WHERE correlation_id IS NOT NULL;

-- Gestión de reuniones PMO
CREATE TABLE IF NOT EXISTS pmo_meetings (
    meeting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key TEXT UNIQUE,
    correlation_id TEXT,
    source TEXT,
    title TEXT NOT NULL,
    objective TEXT,
    context_summary TEXT,
    status TEXT NOT NULL DEFAULT 'proposed',
    priority TEXT,
    requested_for TIMESTAMP WITH TIME ZONE,
    scheduled_for TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    timezone TEXT NOT NULL DEFAULT 'America/Guayaquil',
    scheduling_status TEXT,
    scheduling_notes TEXT,
    requested_by TEXT,
    calendar_provider TEXT,
    calendar_event_id TEXT,
    calendar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pmo_meetings_status_date ON pmo_meetings (status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_pmo_meetings_corr ON pmo_meetings (correlation_id);

CREATE TABLE IF NOT EXISTS pmo_meeting_invitees (
    invitee_id BIGSERIAL PRIMARY KEY,
    meeting_id UUID REFERENCES pmo_meetings(meeting_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT,
    reason TEXT,
    email TEXT,
    discord_id TEXT,
    is_client BOOLEAN NOT NULL DEFAULT FALSE,
    attendance_status TEXT NOT NULL DEFAULT 'considered',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(meeting_id, name)
);

CREATE TABLE IF NOT EXISTS pmo_meeting_logs (
    log_id BIGSERIAL PRIMARY KEY,
    meeting_id UUID REFERENCES pmo_meetings(meeting_id) ON DELETE SET NULL,
    correlation_id TEXT,
    action TEXT NOT NULL,
    actor TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pmo_meeting_logs_created ON pmo_meeting_logs (created_at DESC);

CREATE TABLE IF NOT EXISTS pmo_calendar_members (
    member_key TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    role TEXT,
    timezone TEXT NOT NULL DEFAULT 'America/Guayaquil',
    is_client BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    working_hours JSONB NOT NULL DEFAULT '{"days":[1,2,3,4,5],"windows":[["09:00","12:00"],["14:00","17:30"]]}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pmo_meeting_reminders (
    reminder_id BIGSERIAL PRIMARY KEY,
    meeting_id UUID REFERENCES pmo_meetings(meeting_id) ON DELETE CASCADE,
    reminder_type TEXT NOT NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    queued_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(meeting_id, reminder_type)
);

CREATE INDEX IF NOT EXISTS idx_pmo_meeting_reminders_due ON pmo_meeting_reminders (status, scheduled_at);

-- Gobierno PMO: RAID, acciones, decisiones y salud ejecutiva
CREATE TABLE IF NOT EXISTS pmo_raid_items (
    raid_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correlation_id TEXT,
    item_type TEXT NOT NULL, -- risk, issue, assumption, dependency
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT NOT NULL DEFAULT 'medium',
    probability NUMERIC(4, 3),
    impact TEXT,
    owner TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    mitigation TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    source TEXT,
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pmo_raid_status_severity ON pmo_raid_items (status, severity, due_date);
CREATE INDEX IF NOT EXISTS idx_pmo_raid_corr ON pmo_raid_items (correlation_id);

CREATE TABLE IF NOT EXISTS pmo_action_items (
    action_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correlation_id TEXT,
    source TEXT,
    title TEXT NOT NULL,
    description TEXT,
    owner TEXT,
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'open',
    due_date TIMESTAMP WITH TIME ZONE,
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_pmo_action_status_due ON pmo_action_items (status, due_date, priority);
CREATE INDEX IF NOT EXISTS idx_pmo_action_corr ON pmo_action_items (correlation_id);

CREATE TABLE IF NOT EXISTS pmo_decision_register (
    decision_register_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correlation_id TEXT,
    decision_title TEXT NOT NULL,
    decision_summary TEXT,
    decided_by TEXT,
    decision_status TEXT NOT NULL DEFAULT 'proposed',
    rationale TEXT,
    impact TEXT,
    source TEXT,
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    decided_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pmo_decision_status ON pmo_decision_register (decision_status, created_at DESC);

CREATE TABLE IF NOT EXISTS pmo_change_requests (
    change_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correlation_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    requested_by TEXT,
    impact_scope TEXT,
    impact_timeline TEXT,
    impact_quality TEXT,
    status TEXT NOT NULL DEFAULT 'proposed',
    priority TEXT NOT NULL DEFAULT 'medium',
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_pmo_change_status ON pmo_change_requests (status, priority, created_at DESC);

CREATE TABLE IF NOT EXISTS pmo_health_snapshots (
    snapshot_id BIGSERIAL PRIMARY KEY,
    correlation_id TEXT,
    health_score INTEGER NOT NULL,
    health_status TEXT NOT NULL,
    summary TEXT,
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pmo_health_created ON pmo_health_snapshots (created_at DESC);

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

-- ============================================================
-- PM BOT TABLES (new PM system - created automatically)
-- ============================================================

-- 1. PM Tareas
CREATE TABLE IF NOT EXISTS pm_tareas (
  id BIGSERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  responsable TEXT,
  prioridad TEXT NOT NULL DEFAULT 'media' CHECK (prioridad IN ('baja','media','alta','critica')),
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_progreso','bloqueada','en_revision','completada','cancelada')),
  fecha_inicio DATE,
  fecha_limite DATE,
  entregable TEXT,
  sprint TEXT,
  canal_origen TEXT,
  creado_por TEXT NOT NULL DEFAULT 'system',
  trello_card_id TEXT,
  github_issue_id TEXT,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pm_tareas_estado ON pm_tareas (estado);
CREATE INDEX IF NOT EXISTS idx_pm_tareas_responsable ON pm_tareas (responsable);
CREATE INDEX IF NOT EXISTS idx_pm_tareas_prioridad ON pm_tareas (prioridad);
CREATE INDEX IF NOT EXISTS idx_pm_tareas_fecha_limite ON pm_tareas (fecha_limite, estado);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_tareas_trello_card_id_unique ON pm_tareas (trello_card_id) WHERE trello_card_id IS NOT NULL;

-- 2. PM Avances
CREATE TABLE IF NOT EXISTS pm_avances (
  id BIGSERIAL PRIMARY KEY,
  tarea_id BIGINT REFERENCES pm_tareas(id) ON DELETE SET NULL,
  responsable TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  porcentaje INTEGER DEFAULT 0 CHECK (porcentaje >= 0 AND porcentaje <= 100),
  bloqueos_reportados TEXT,
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pm_avances_fecha ON pm_avances (fecha);
CREATE INDEX IF NOT EXISTS idx_pm_avances_tarea ON pm_avances (tarea_id);

-- 3. PM Bloqueos
CREATE TABLE IF NOT EXISTS pm_bloqueos (
  id BIGSERIAL PRIMARY KEY,
  descripcion TEXT NOT NULL,
  responsable_afectado TEXT,
  tarea_id BIGINT REFERENCES pm_tareas(id) ON DELETE SET NULL,
  severidad TEXT NOT NULL DEFAULT 'media' CHECK (severidad IN ('baja','media','alta','critica')),
  estado TEXT NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto','en_proceso','resuelto')),
  accion_recomendada TEXT,
  resolucion TEXT,
  creado_por TEXT,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_resolucion TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_pm_bloqueos_estado ON pm_bloqueos (estado);

-- 4. PM Riesgos
CREATE TABLE IF NOT EXISTS pm_riesgos (
  id BIGSERIAL PRIMARY KEY,
  descripcion TEXT NOT NULL,
  probabilidad TEXT NOT NULL DEFAULT 'media' CHECK (probabilidad IN ('baja','media','alta')),
  impacto TEXT NOT NULL DEFAULT 'medio' CHECK (impacto IN ('bajo','medio','alto','critico')),
  prioridad_calculada TEXT,
  mitigacion TEXT,
  estado TEXT NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto','mitigado','cerrado')),
  responsable TEXT,
  creado_por TEXT,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pm_riesgos_estado ON pm_riesgos (estado);

-- 5. PM Decisiones
CREATE TABLE IF NOT EXISTS pm_decisiones (
  id BIGSERIAL PRIMARY KEY,
  decision TEXT NOT NULL,
  contexto TEXT,
  justificacion TEXT,
  responsable TEXT NOT NULL,
  impacto TEXT,
  creado_por TEXT,
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pm_decisiones_fecha ON pm_decisiones (fecha DESC);

-- 6. PM Entregables
CREATE TABLE IF NOT EXISTS pm_entregables (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  responsable TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_progreso','en_revision','entregado','aprobado')),
  fecha_limite DATE,
  version TEXT DEFAULT '1.0',
  enlace TEXT,
  observaciones TEXT,
  tipo TEXT DEFAULT 'tecnico' CHECK (tipo IN ('tecnico','academico','documentacion','prototipo','informe')),
  trello_card_id TEXT,
  creado_por TEXT,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pm_entregables_estado ON pm_entregables (estado);
CREATE INDEX IF NOT EXISTS idx_pm_entregables_fecha ON pm_entregables (fecha_limite, estado);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_entregables_trello_card_id_unique ON pm_entregables (trello_card_id) WHERE trello_card_id IS NOT NULL;

-- 7. PM Retrospectivas
CREATE TABLE IF NOT EXISTS pm_retrospectivas (
  id BIGSERIAL PRIMARY KEY,
  sprint TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('bien','mejorar','accion')),
  descripcion TEXT NOT NULL,
  responsable TEXT,
  estado TEXT DEFAULT 'pendiente',
  creado_por TEXT,
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pm_retrospectivas_fecha ON pm_retrospectivas (fecha DESC);

-- 8. PM Reuniones
CREATE TABLE IF NOT EXISTS pm_reuniones (
  id BIGSERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  tipo TEXT DEFAULT 'seguimiento',
  fecha_reunion TIMESTAMPTZ,
  duracion_minutos INTEGER NOT NULL DEFAULT 45,
  lugar TEXT,
  participantes TEXT[],
  agenda TEXT,
  acuerdos TEXT,
  compromisos TEXT,
  decisiones TEXT,
  acta TEXT,
  discord_event_id TEXT,
  discord_event_url TEXT,
  discord_event_status TEXT,
  estado TEXT DEFAULT 'programada' CHECK (estado IN ('programada','en_curso','completada','cancelada')),
  creado_por TEXT,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pm_reuniones_fecha ON pm_reuniones (fecha_reunion, estado);
CREATE INDEX IF NOT EXISTS idx_pm_reuniones_discord_event ON pm_reuniones (discord_event_id);

-- 9. PM Command Log (audit trail de todas las interacciones del bot)
CREATE TABLE IF NOT EXISTS pm_command_log (
  id BIGSERIAL PRIMARY KEY,
  comando TEXT,
  intencion TEXT,
  usuario TEXT,
  canal TEXT,
  datos_extraidos JSONB,
  respuesta_bot TEXT,
  exito BOOLEAN DEFAULT TRUE,
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pm_command_log_fecha ON pm_command_log (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_pm_command_log_usuario ON pm_command_log (usuario, fecha DESC);

-- 10. PM Bot Errors
CREATE TABLE IF NOT EXISTS pm_bot_errors (
  id BIGSERIAL PRIMARY KEY,
  workflow_name TEXT,
  node_name TEXT,
  error_message TEXT,
  execution_id TEXT,
  payload JSONB,
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pm_bot_errors_fecha ON pm_bot_errors (fecha DESC);

-- 11. FinOps / Capacity tables
CREATE TABLE IF NOT EXISTS finops_budget_snapshots (
  id BIGSERIAL PRIMARY KEY,
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  presupuesto_total NUMERIC(10,2),
  gastado_total NUMERIC(10,2),
  semaforo TEXT,
  detalle JSONB
);
CREATE TABLE IF NOT EXISTS finops_team_rates (
  id BIGSERIAL PRIMARY KEY,
  miembro TEXT NOT NULL UNIQUE,
  rol TEXT NOT NULL,
  tarifa_hora NUMERIC(6,2) NOT NULL,
  horas_semana NUMERIC(4,1) NOT NULL DEFAULT 8,
  activo BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS team_pto (
  id BIGSERIAL PRIMARY KEY,
  miembro TEXT NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  motivo TEXT DEFAULT 'PTO',
  registrado_por TEXT DEFAULT 'system',
  registrado_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS capacity_forecasts (
  id BIGSERIAL PRIMARY KEY,
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  velocidad_actual NUMERIC(5,2),
  capacidad_pct NUMERIC(5,2),
  tareas_pendientes INTEGER,
  dias_estimados_cierre INTEGER,
  riesgo_fecha TEXT,
  ia_diagnostico TEXT
);
CREATE TABLE IF NOT EXISTS qa_quality_snapshots (
  id BIGSERIAL PRIMARY KEY,
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bugs_abiertos INTEGER,
  semaforo TEXT,
  deuda_tecnica_score NUMERIC(5,2),
  kpis JSONB
);

-- 11. PM Project Phases
CREATE TABLE IF NOT EXISTS project_phases (
  phase_id BIGSERIAL PRIMARY KEY,
  list_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  responsible TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. PM Task States (Trello sync tracking)
CREATE TABLE IF NOT EXISTS estado_tareas (
  id BIGSERIAL PRIMARY KEY,
  analisis_id BIGINT,
  fecha TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  card_id TEXT UNIQUE,
  card_nombre TEXT,
  lista_nombre TEXT,
  miembro_id TEXT,
  miembro_nombre TEXT,
  fecha_vencimiento TIMESTAMP WITH TIME ZONE,
  completada BOOLEAN NOT NULL DEFAULT FALSE,
  tiene_adjuntos BOOLEAN NOT NULL DEFAULT FALSE,
  adjuntos_count INTEGER NOT NULL DEFAULT 0
);



-- ============================================================
-- SEED DATA: Entregables reales del proyecto PetSafe
-- Solo inserta si la tabla está vacía para no duplicar
-- ============================================================
INSERT INTO pm_entregables (nombre, responsable, estado, fecha_limite, tipo, observaciones)
SELECT nombre, responsable, estado, fecha_limite::DATE, tipo, observaciones FROM (VALUES
  ('Project Charter', 'Bonilla Joel', 'entregado', '2026-02-14', 'documentacion', 'Documento base del proyecto'),
  ('Planificación del Cronograma', 'Bonilla Joel', 'entregado', '2026-02-21', 'documentacion', 'Cronograma de 16 semanas'),
  ('Matriz de Proveedores', 'Bonilla Joel', 'entregado', '2026-02-28', 'documentacion', 'Evaluación y adjudicación de VPS'),
  ('Contrato VPS Contabo', 'Bonilla Joel', 'entregado', '2026-03-07', 'documentacion', 'Contrato de servicios cloud'),
  ('Documentación Técnica Backend', 'García Josué', 'en_progreso', '2026-05-30', 'tecnico', 'API docs, arquitectura NestJS'),
  ('Documentación Técnica Frontend', 'Barragán David', 'en_progreso', '2026-05-30', 'tecnico', 'Componentes Angular, guía UI'),
  ('Prototipo Funcional Backend', 'García Josué', 'en_revision', '2026-05-23', 'prototipo', 'API REST completa con tests'),
  ('Prototipo Funcional Frontend', 'Manjarres David', 'en_revision', '2026-05-23', 'prototipo', 'UI completa con integración API'),
  ('Pruebas de Integración', 'García Josué', 'en_progreso', '2026-06-01', 'tecnico', 'E2E tests y validación'),
  ('Manual de Usuario', 'Manjarres David', 'pendiente', '2026-06-05', 'documentacion', 'Guía para el cliente'),
  ('Informe Final del Proyecto', 'Bonilla Joel', 'pendiente', '2026-06-10', 'informe', 'Informe final académico')
) AS v(nombre, responsable, estado, fecha_limite, tipo, observaciones)
WHERE NOT EXISTS (SELECT 1 FROM pm_entregables LIMIT 1);

-- SEED DATA: Tareas activas del proyecto PetSafe (basadas en el tablero Trello)
INSERT INTO pm_tareas (titulo, responsable, prioridad, estado, fecha_limite, entregable, creado_por)
SELECT titulo, responsable, prioridad, estado, fecha_limite::DATE, entregable, 'init.sql' FROM (VALUES
  ('Pruebas de integración', 'Barragán David', 'alta', 'en_revision', '2026-05-26', 'Pruebas de integración'),
  ('Pruebas del sistema', 'García Josué', 'alta', 'en_revision', '2026-06-01', 'Pruebas del sistema'),
  ('Pruebas de aceptación de Usuario', 'Bonilla Fernando', 'alta', 'en_revision', '2026-06-02', 'Pruebas de aceptación'),
  ('Implantación', 'Manjarres David', 'critica', 'pendiente', '2026-06-04', 'Implantación'),
  ('Desarrollo y entrega de manual de usuario', 'Bonilla Fernando', 'media', 'pendiente', '2026-06-09', 'Manual de Usuario'),
  ('Capacitaciones', 'Bonilla Fernando', 'media', 'pendiente', '2026-06-11', 'Capacitaciones')
) AS v(titulo, responsable, prioridad, estado, fecha_limite, entregable)
WHERE NOT EXISTS (SELECT 1 FROM pm_tareas LIMIT 1);
