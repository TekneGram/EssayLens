import type { AppAction } from '@/app/providers/state';
import type { ChatState } from '../domain';
import { initialChatState } from './chatInterface.initialState';

export function chatReducer(state: ChatState = initialChatState, action: AppAction): ChatState {
  switch (action.type) {
    case 'chat/setMessages':
      return {
        ...state,
        messages: action.payload
      };
    case 'chat/addMessage':
      return {
        ...state,
        messages: [...state.messages, action.payload]
      };
    case 'chat/removeMessage':
      return {
        ...state,
        messages: state.messages.filter((message) => message.id !== action.payload.messageId)
      };
    case 'chat/setSessionTranscript': {
      const existingForSession = state.messages.filter((message) => message.sessionId === action.payload.sessionId);
      if (action.payload.preserveExistingWhenEmpty && action.payload.messages.length === 0 && existingForSession.length > 0) {
        return state;
      }
      const retained = state.messages.filter((message) => message.sessionId !== action.payload.sessionId);
      return {
        ...state,
        messages: [...retained, ...action.payload.messages]
      };
    }
    case 'chat/updateMessageContent':
      return {
        ...state,
        messages: state.messages.map((message) => {
          if (message.id !== action.payload.messageId) {
            return message;
          }
          return {
            ...message,
            content:
              action.payload.mode === 'append'
                ? `${message.content}${action.payload.content}`
                : action.payload.content
          };
        })
      };
    case 'chat/setMessageCommentable':
      return {
        ...state,
        messages: state.messages.map((message) => {
          if (message.id !== action.payload.messageId) {
            return message;
          }
          return {
            ...message,
            canCreateComment: action.payload.canCreateComment,
            commentActionType: action.payload.commentActionType ?? message.commentActionType,
            vocabularyItem: action.payload.vocabularyItem ?? message.vocabularyItem
          };
        })
      };
    case 'chat/setStatus':
      return {
        ...state,
        status: action.payload
      };
    case 'chat/setError':
      return {
        ...state,
        error: action.payload
      };
    case 'chat/setActiveSessionForFile': {
      const next = { ...state.activeSessionIdByFileId };
      if (!action.payload.sessionId) {
        delete next[action.payload.fileId];
      } else {
        next[action.payload.fileId] = action.payload.sessionId;
      }
      return {
        ...state,
        activeSessionIdByFileId: next
      };
    }
    case 'chat/setSessionsForFile':
      return {
        ...state,
        sessionsByFileId: {
          ...state.sessionsByFileId,
          [action.payload.fileId]: action.payload.sessions
        }
      };
    case 'chat/setSessionListStatusForFile':
      return {
        ...state,
        sessionsStatusByFileId: {
          ...state.sessionsStatusByFileId,
          [action.payload.fileId]: action.payload.status
        }
      };
    case 'chat/setSessionListErrorForFile': {
      const next = { ...state.sessionsErrorByFileId };
      if (!action.payload.error) {
        delete next[action.payload.fileId];
      } else {
        next[action.payload.fileId] = action.payload.error;
      }
      return {
        ...state,
        sessionsErrorByFileId: next
      };
    }
    case 'chat/bumpSessionSyncForFile': {
      const current = state.sessionSyncNonceByFileId[action.payload.fileId] ?? 0;
      return {
        ...state,
        sessionSyncNonceByFileId: {
          ...state.sessionSyncNonceByFileId,
          [action.payload.fileId]: current + 1
        }
      };
    }
    case 'chat/setSessionSendPhase': {
      const next = { ...state.sessionSendPhaseBySessionId };
      if (!action.payload.phase) {
        delete next[action.payload.sessionId];
      } else {
        next[action.payload.sessionId] = action.payload.phase;
      }
      return {
        ...state,
        sessionSendPhaseBySessionId: next
      };
    }
    case 'chat/clearTransientSessionDrafts':
      return {
        ...state,
        messages: state.messages.filter(
          (message) =>
            !(message.sessionId === action.payload.sessionId && message.role === 'assistant' && message.content.trim().length === 0)
        )
      };
    case 'chat/startBulkParagraphRun':
      return {
        ...state,
        bulkParagraphRun: {
          isActive: true,
          originFileId: action.payload.originFileId,
          currentFileId: action.payload.originFileId,
          currentSessionId: action.payload.originFileId
            ? state.activeSessionIdByFileId[action.payload.originFileId]
            : undefined
        }
      };
    case 'chat/updateBulkParagraphRunTarget':
      return {
        ...state,
        bulkParagraphRun: {
          ...state.bulkParagraphRun,
          isActive: true,
          currentFileId: action.payload.fileId,
          currentSessionId: action.payload.sessionId
        }
      };
    case 'chat/finishBulkParagraphRun':
      return {
        ...state,
        bulkParagraphRun: {
          ...state.bulkParagraphRun,
          isActive: false,
          originFileId: null
        }
      };
    default:
      return state;
  }
}
