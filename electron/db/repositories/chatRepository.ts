import { getSharedDatabaseClient } from '../appDatabase';
import type { SQLiteClient } from '../sqlite';
import { ensureEntity, ensureGlobalChatEntity, GLOBAL_CHAT_ENTITY_ID } from './sqlHelpers';

export interface ChatRecord {
  id: string;
  role: 'system' | 'teacher' | 'assistant';
  content: string;
  relatedFileId?: string;
  createdAt: string;
}

interface ChatRepositoryOptions {
  now?: () => string;
  db?: SQLiteClient;
}

interface ChatRow {
  uuid: string;
  entity_uuid: string;
  chat_role: 'system' | 'teacher' | 'assistant';
  chat_content: string | null;
  created_at: string | null;
}

export class ChatRepository {
  private readonly db: SQLiteClient;
  private readonly now: () => string;

  constructor(options: ChatRepositoryOptions = {}) {
    this.db = options.db ?? getSharedDatabaseClient();
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async listMessages(fileId?: string): Promise<ChatRecord[]> {
    const rows = fileId
      ? await this.db.all<ChatRow>(
          `SELECT uuid, entity_uuid, chat_role, chat_content, created_at
           FROM chats
           WHERE entity_uuid = ?
           ORDER BY created_at ASC, rowid ASC;`,
          [fileId]
        )
      : await this.db.all<ChatRow>(
          `SELECT uuid, entity_uuid, chat_role, chat_content, created_at
           FROM chats
           ORDER BY created_at ASC, rowid ASC;`
        );

    return rows.map((row) => ({
      id: row.uuid,
      role: row.chat_role,
      content: row.chat_content ?? '',
      relatedFileId: row.entity_uuid === GLOBAL_CHAT_ENTITY_ID ? undefined : row.entity_uuid,
      createdAt: row.created_at ?? ''
    }));
  }

  async addMessage(message: ChatRecord): Promise<ChatRecord> {
    const content = message.content.trim();
    if (!message.id.trim()) {
      throw new Error('Chat message id is required.');
    }
    if (!content) {
      throw new Error('Chat message content is required.');
    }

    const createdAt = message.createdAt || this.now();
    const entityId = message.relatedFileId?.trim() || GLOBAL_CHAT_ENTITY_ID;

    if (entityId === GLOBAL_CHAT_ENTITY_ID) {
      await ensureGlobalChatEntity(this.db, createdAt);
    } else {
      await ensureEntity(this.db, entityId, 'file', createdAt);
    }

    await this.db.run(
      `INSERT INTO chats (uuid, entity_uuid, chat_role, chat_header, chat_content, created_at)
       VALUES (?, ?, ?, NULL, ?, ?);`,
      [message.id, entityId, message.role, content, createdAt]
    );

    return {
      ...message,
      content,
      createdAt,
      relatedFileId: entityId === GLOBAL_CHAT_ENTITY_ID ? undefined : entityId
    };
  }
}
