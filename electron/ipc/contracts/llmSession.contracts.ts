export interface CreateLlmSessionRequest {
  sessionId: string;
  fileEntityUuid: string;
}

export interface CreateLlmSessionResponse {
  sessionId: string;
  fileEntityUuid: string;
}

export interface ClearLlmSessionRequest {
  sessionId: string;
}

export interface ClearLlmSessionResponse {
  sessionId: string;
  cleared: boolean;
}

export interface DeleteLlmSessionRequest {
  sessionId: string;
}

export interface DeleteLlmSessionResponse {
  sessionId: string;
  deleted: boolean;
}

export interface GetLlmSessionTurnsRequest {
  sessionId: string;
  fileEntityUuid: string;
}

export interface LlmSessionTurnDto {
  role: 'teacher' | 'assistant' | 'system';
  content: string;
}

export interface GetLlmSessionTurnsResponse {
  sessionId: string;
  fileEntityUuid: string;
  turns: LlmSessionTurnDto[];
}

export interface ListLlmSessionsByFileRequest {
  fileEntityUuid: string;
}

export interface LlmSessionListItemDto {
  sessionId: string;
  fileEntityUuid: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string;
}

export interface ListLlmSessionsByFileResponse {
  fileEntityUuid: string;
  sessions: LlmSessionListItemDto[];
}
