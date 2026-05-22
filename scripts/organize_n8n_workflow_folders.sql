WITH target_project AS (
  SELECT id AS project_id
  FROM n8n.project
  ORDER BY "createdAt" ASC
  LIMIT 1
),
folder_seed(id, name) AS (
  VALUES
    ('folder-01-ai', '01 AI Intelligence'),
    ('folder-02-core', '02 Core System'),
    ('folder-03-events', '03 Communication & Events'),
    ('folder-04-monitor', '04 Monitoring & Reliability'),
    ('folder-05-pmo', '05 PMO & Reporting')
),
upserted AS (
  INSERT INTO n8n.folder (id, name, "parentFolderId", "projectId", "createdAt", "updatedAt")
  SELECT folder_seed.id, folder_seed.name, NULL, target_project.project_id, NOW(), NOW()
  FROM folder_seed
  CROSS JOIN target_project
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    "projectId" = EXCLUDED."projectId",
    "updatedAt" = NOW()
  RETURNING id
)
UPDATE n8n.workflow_entity
SET "parentFolderId" = CASE
  WHEN name LIKE '01 AI | %' THEN 'folder-01-ai'
  WHEN name LIKE '02 Core | %' THEN 'folder-02-core'
  WHEN name LIKE '03 Events | %' THEN 'folder-03-events'
  WHEN name LIKE '04 Monitor | %' THEN 'folder-04-monitor'
  WHEN name LIKE '05 PMO | %' THEN 'folder-05-pmo'
  ELSE "parentFolderId"
END
WHERE name LIKE '01 AI | %'
   OR name LIKE '02 Core | %'
   OR name LIKE '03 Events | %'
   OR name LIKE '04 Monitor | %'
   OR name LIKE '05 PMO | %';
