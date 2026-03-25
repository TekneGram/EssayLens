PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS rubrics (
  entity_uuid TEXT PRIMARY KEY,
  name TEXT,
  type TEXT CHECK (type IN ('flat', 'detailed')),
  FOREIGN KEY (entity_uuid) REFERENCES entities(uuid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rubric_details (
  uuid TEXT PRIMARY KEY,
  entity_uuid TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  FOREIGN KEY (entity_uuid) REFERENCES rubrics(entity_uuid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rubric_scores (
  uuid TEXT PRIMARY KEY,
  details_uuid TEXT NOT NULL,
  score_values INTEGER NOT NULL,
  FOREIGN KEY (details_uuid) REFERENCES rubric_details(uuid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS file_rubric_instances (
  uuid TEXT PRIMARY KEY,
  file_entity_uuid TEXT NOT NULL,
  rubric_entity_uuid TEXT NOT NULL,
  created_at TEXT NOT NULL,
  edited_at TEXT,
  FOREIGN KEY (file_entity_uuid) REFERENCES filename(entity_uuid) ON DELETE CASCADE,
  FOREIGN KEY (rubric_entity_uuid) REFERENCES rubrics(entity_uuid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS file_rubric_scores (
  uuid TEXT PRIMARY KEY,
  rubric_instance_uuid TEXT NOT NULL,
  rubric_detail_uuid TEXT NOT NULL,
  assigned_score TEXT NOT NULL,
  created_at TEXT NOT NULL,
  edited_at TEXT,
  FOREIGN KEY (rubric_instance_uuid) REFERENCES file_rubric_instances(uuid) ON DELETE CASCADE,
  FOREIGN KEY (rubric_detail_uuid) REFERENCES rubric_details(uuid) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rubric_instances_file ON file_rubric_instances(file_entity_uuid);
CREATE INDEX IF NOT EXISTS idx_rubric_instances_rubric ON file_rubric_instances(rubric_entity_uuid);
CREATE INDEX IF NOT EXISTS idx_rubric_scores_instance ON file_rubric_scores(rubric_instance_uuid);
CREATE INDEX IF NOT EXISTS idx_rubric_scores_detail ON file_rubric_scores(rubric_detail_uuid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_instance_detail ON file_rubric_scores(rubric_instance_uuid, rubric_detail_uuid);
