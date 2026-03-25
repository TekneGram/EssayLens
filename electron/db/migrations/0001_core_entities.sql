PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS entities (
  uuid TEXT PRIMARY KEY,
  type TEXT CHECK (type IN ('file', 'rubric')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS filepath (
  uuid TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS filename (
  entity_uuid TEXT PRIMARY KEY,
  filepath_uuid TEXT NOT NULL,
  append_path TEXT,
  file_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  checked_is_generated INTEGER NOT NULL DEFAULT 0 CHECK (checked_is_generated IN (0, 1)),
  generated_at TEXT,
  FOREIGN KEY (entity_uuid) REFERENCES entities(uuid) ON DELETE CASCADE,
  FOREIGN KEY (filepath_uuid) REFERENCES filepath(uuid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS image (
  entity_uuid TEXT NOT NULL,
  to_text INTEGER NOT NULL DEFAULT 0 CHECK (to_text IN (0, 1)),
  text TEXT,
  FOREIGN KEY (entity_uuid) REFERENCES filename(entity_uuid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chats (
  uuid TEXT PRIMARY KEY,
  entity_uuid TEXT NOT NULL,
  chat_role TEXT NOT NULL,
  chat_header TEXT,
  chat_content TEXT,
  created_at TEXT,
  FOREIGN KEY (entity_uuid) REFERENCES entities(uuid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit (
  uuid TEXT PRIMARY KEY,
  entity_uuid TEXT NULL,
  user_action TEXT NOT NULL CHECK (
    user_action IN (
      'chat-doc',
      'attach-folder',
      'add-block-comment',
      'add-inline-comment',
      'generate-llm-inline-comment',
      'generate-llm-block-comment',
      'attach-rubric',
      'edit-rubric',
      'create-new-rubric',
      'score-with-rubric'
    )
  ),
  target_table TEXT NOT NULL,
  target_uuid TEXT NOT NULL,
  metadata TEXT,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (entity_uuid) REFERENCES entities(uuid)
);

CREATE INDEX IF NOT EXISTS idx_chats_entity ON chats(entity_uuid);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit(entity_uuid);
CREATE INDEX IF NOT EXISTS idx_filename_path ON filename(filepath_uuid);
