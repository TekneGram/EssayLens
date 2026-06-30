PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS essay_feedback_analyses (
  uuid TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  file_entity_uuid TEXT NOT NULL,
  introduction_paragraph TEXT NOT NULL,
  body_paragraphs_json TEXT NOT NULL,
  conclusion_paragraph TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES llm_chat_sessions(session_id) ON DELETE CASCADE,
  FOREIGN KEY (file_entity_uuid) REFERENCES filename(entity_uuid) ON DELETE CASCADE,
  UNIQUE (session_id, file_entity_uuid)
);

CREATE INDEX IF NOT EXISTS idx_essay_feedback_analyses_session_file
ON essay_feedback_analyses(session_id, file_entity_uuid);
