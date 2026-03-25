PRAGMA foreign_keys = ON;

UPDATE rubrics
SET is_active = 0
WHERE is_active <> 0;
