PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS llm_feedback_completions (
  uuid TEXT PRIMARY KEY,
  file_entity_uuid TEXT NOT NULL,
  workflow_key TEXT NOT NULL CHECK (workflow_key IN ('paragraph_feedback')),
  model_key TEXT NOT NULL,
  model_display_name TEXT NOT NULL,
  session_id TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  FOREIGN KEY (file_entity_uuid) REFERENCES filename(entity_uuid) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES llm_chat_sessions(session_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_llm_feedback_completions_lookup
ON llm_feedback_completions(file_entity_uuid, workflow_key, model_key);

CREATE INDEX IF NOT EXISTS idx_llm_feedback_completions_completed
ON llm_feedback_completions(completed_at);
