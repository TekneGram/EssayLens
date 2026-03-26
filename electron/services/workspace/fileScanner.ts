import fs from 'node:fs/promises';
import path from 'node:path';

export interface ScannedFile {
  path: string;
  name: string;
  extension: string;
}

async function scanDirectory(folderPath: string, depth: number): Promise<ScannedFile[]> {
  try {
    const entries = await fs.readdir(folderPath, { withFileTypes: true, encoding: 'utf8' });
    const files: ScannedFile[] = [];
    for (const entry of entries) {
      const entryPath = path.join(folderPath, entry.name);
      if (entry.isDirectory()) {
        if (depth > 0) {
          const nestedFiles = await scanDirectory(entryPath, depth - 1);
          files.push(...nestedFiles);
        }
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }

      const extensionWithDot = path.extname(entry.name);
      const extension = extensionWithDot.startsWith('.') ? extensionWithDot.slice(1) : extensionWithDot;
      files.push({
        path: entryPath,
        name: entry.name,
        extension
      });
    }

    return files;
  } catch {
    return [];
  }
}

export async function scanFilesInWorkspace(folderPath: string): Promise<ScannedFile[]> {
  return scanDirectory(folderPath, 2);
}
