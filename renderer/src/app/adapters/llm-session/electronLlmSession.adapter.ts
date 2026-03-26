import type {
  LlmSessionPort,
  CreateLlmSessionRequest,
  CreateLlmSessionResponse,
  ClearLlmSessionRequest,
  ClearLlmSessionResponse,
  DeleteLlmSessionRequest,
  DeleteLlmSessionResponse,
  GetLlmSessionTurnsRequest,
  GetLlmSessionTurnsResponse,
  ListLlmSessionsByFileRequest,
  ListLlmSessionsByFileResponse
} from '@/app/ports/llmSession.port';
import { invokeRequest } from '@/app/invokeRequest';

const CHANNELS = {
  create: 'llmSession/create',
  clear: 'llmSession/clear',
  delete: 'llmSession/delete',
  getTurns: 'llmSession/getTurns',
  listByFile: 'llmSession/listByFile'
} as const;

export function createElectronLlmSessionAdapter(): LlmSessionPort {
  return {
    create: (request: CreateLlmSessionRequest) => invokeRequest<CreateLlmSessionResponse>(CHANNELS.create, request),
    clear: (request: ClearLlmSessionRequest) => invokeRequest<ClearLlmSessionResponse>(CHANNELS.clear, request),
    delete: (request: DeleteLlmSessionRequest) => invokeRequest<DeleteLlmSessionResponse>(CHANNELS.delete, request),
    getTurns: (request: GetLlmSessionTurnsRequest) => invokeRequest<GetLlmSessionTurnsResponse>(CHANNELS.getTurns, request),
    listByFile: (request: ListLlmSessionsByFileRequest) => invokeRequest<ListLlmSessionsByFileResponse>(CHANNELS.listByFile, request)
  };
}
