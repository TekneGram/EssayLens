CREATE UNIQUE INDEX IF NOT EXISTS idx_filepath_path_unique ON filepath(path);

CREATE UNIQUE INDEX IF NOT EXISTS idx_filename_folder_rel_unique
ON filename(filepath_uuid, IFNULL(append_path, ''), file_name);
