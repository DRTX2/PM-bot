WITH tag_seed(id, name) AS (
  VALUES
    ('tag-petsafe', 'PetSafe'),
    ('tag-pm-bot', 'PM Bot'),
    ('tag-01-ai', '01 AI'),
    ('tag-02-core', '02 Core'),
    ('tag-03-events', '03 Events'),
    ('tag-04-monitor', '04 Monitor'),
    ('tag-05-pmo', '05 PMO')
),
upsert_tags AS (
  INSERT INTO n8n.tag_entity (id, name, "createdAt", "updatedAt")
  SELECT id, name, NOW(), NOW()
  FROM tag_seed
  ON CONFLICT (name) DO UPDATE SET
    "updatedAt" = NOW()
  RETURNING id, name
),
workflow_tag_seed AS (
  SELECT id AS workflow_id, 'tag-petsafe' AS tag_id
  FROM n8n.workflow_entity
  WHERE name LIKE '01 AI | %'
     OR name LIKE '02 Core | %'
     OR name LIKE '03 Events | %'
     OR name LIKE '04 Monitor | %'
     OR name LIKE '05 PMO | %'

  UNION ALL
  SELECT id, 'tag-pm-bot'
  FROM n8n.workflow_entity
  WHERE name LIKE '%WF_PM_%'
     OR name LIKE '05 PMO | PMO - %'
     OR name LIKE '05 PMO | Dashboard - PM%'
     OR name LIKE '02 Core | System - PM%'

  UNION ALL
  SELECT id, 'tag-01-ai' FROM n8n.workflow_entity WHERE name LIKE '01 AI | %'
  UNION ALL
  SELECT id, 'tag-02-core' FROM n8n.workflow_entity WHERE name LIKE '02 Core | %'
  UNION ALL
  SELECT id, 'tag-03-events' FROM n8n.workflow_entity WHERE name LIKE '03 Events | %'
  UNION ALL
  SELECT id, 'tag-04-monitor' FROM n8n.workflow_entity WHERE name LIKE '04 Monitor | %'
  UNION ALL
  SELECT id, 'tag-05-pmo' FROM n8n.workflow_entity WHERE name LIKE '05 PMO | %'
)
INSERT INTO n8n.workflows_tags ("workflowId", "tagId")
SELECT workflow_id, tag_id
FROM workflow_tag_seed
ON CONFLICT ("workflowId", "tagId") DO NOTHING;
