-- Adds optional JSON metadata to chat session turns so structured feedback
-- (e.g. vocabulary suggestions) survives a session reload from the database.
ALTER TABLE llm_chat_session_turns ADD COLUMN metadata TEXT;
