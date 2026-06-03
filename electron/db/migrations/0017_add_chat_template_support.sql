ALTER TABLE llm_selection_defaults
ADD COLUMN chat_template_asset TEXT;

ALTER TABLE llm_settings
ADD COLUMN llm_model_family TEXT NOT NULL DEFAULT 'instruct/think';

ALTER TABLE llm_settings
ADD COLUMN llm_chat_template_path TEXT;

UPDATE llm_selection_defaults
SET chat_template_asset = 'models/gemma_4_chat_template.jinja'
WHERE model_key = 'gemma4_e4b_it_q4_k_m';

UPDATE llm_settings
SET llm_model_family = COALESCE(
  (
    SELECT d.model_family
    FROM llm_selection s
    INNER JOIN llm_selection_defaults d ON d.model_key = s.model_key
    WHERE s.is_active = 1
    LIMIT 1
  ),
  'instruct/think'
)
WHERE id = 'default';
