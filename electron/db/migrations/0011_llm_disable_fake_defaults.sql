PRAGMA foreign_keys = ON;

UPDATE llm_settings
SET use_fake_reply = 0,
    fake_reply_text = NULL
WHERE id = 'default';

UPDATE llm_selection_defaults
SET use_fake_reply = 0,
    fake_reply_text = NULL;
