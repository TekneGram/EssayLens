PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS llm_chat_sessions (
  session_id TEXT PRIMARY KEY,
  file_entity_uuid TEXT,
  pipeline_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_used_at TEXT NOT NULL,
  FOREIGN KEY (file_entity_uuid) REFERENCES filename(entity_uuid) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_llm_chat_sessions_file
ON llm_chat_sessions(file_entity_uuid);

CREATE INDEX IF NOT EXISTS idx_llm_chat_sessions_last_used
ON llm_chat_sessions(last_used_at);

CREATE TABLE IF NOT EXISTS llm_chat_session_turns (
  uuid TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES llm_chat_sessions(session_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_llm_chat_session_turns_session_seq
ON llm_chat_session_turns(session_id, seq);

CREATE INDEX IF NOT EXISTS idx_llm_chat_session_turns_session_created
ON llm_chat_session_turns(session_id, created_at);
