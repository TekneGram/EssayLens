import type { AssessmentTabLocalState } from './assessmentTab.types';

export function selectIsModeLockedToChat(state: AssessmentTabLocalState): boolean {
  return state.activeCommand !== null;
}
