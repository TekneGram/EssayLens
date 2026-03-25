import type { AppState, SelectedFileType } from './types';
import { selectIsChatCollapsed as selectIsChatCollapsedFromChatView } from '@/features/chat-view/state';
import { isImageFileKind } from '@/features/workspace/domain/fileKind';

export function selectActiveTopTab(state: AppState) {
  return state.ui.activeTopTab;
}

export function selectActiveCommentsTab(state: AppState) {
  return state.ui.activeCommentsTab;
}

export function selectIsChatCollapsed(state: AppState) {
  return selectIsChatCollapsedFromChatView(state);
}

export function selectAssessmentSplitRatio(state: AppState) {
  return state.ui.assessmentSplitRatio;
}

export function selectSelectedFileType(state: AppState): SelectedFileType {
  const selectedFileId = state.workspace.selectedFile.fileId;
  if (!selectedFileId) {
    return null;
  }

  const selectedFile = state.workspace.files.find((file) => file.id === selectedFileId);
  if (!selectedFile) {
    return null;
  }

  if (isImageFileKind(selectedFile.kind)) {
    return 'image';
  }
  if (selectedFile.kind === 'docx') {
    return 'docx';
  }
  if (selectedFile.kind === 'pdf') {
    return 'pdf';
  }

  return 'other';
}
