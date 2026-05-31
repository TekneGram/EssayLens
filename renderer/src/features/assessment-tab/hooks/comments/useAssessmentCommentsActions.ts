import { useCallback } from 'react';
import type { Dispatch } from 'react';
import { toast } from 'react-toastify';
import { usePorts } from '@/app/ports';
import type {
  AddBlockFeedbackRequest,
  AddInlineFeedbackRequest
} from '@/app/ports/assessment.port';
import type { FeedbackItem } from '@/features/feedback/domain';
import type { PendingSelection } from '@/layout/ChatInterface/domain';
import {
  applyAssessmentFeedback,
  deleteAssessmentFeedback,
  editAssessmentFeedback,
  sendAssessmentFeedbackToLlm
} from '@/features/comments-view';
import { useGenerateFeedbackDocumentMutation } from '@/features/comments-view';
import {
  applyCommentWorkflow,
  deleteCommentWorkflow,
  editCommentWorkflow,
  selectPendingSelectionFromComments,
  sendCommentToLlmWorkflow,
  toSendToLlmActiveCommand,
  generateFeedbackDocumentWorkflow
} from '@/features/comments-view';
import type { AssessmentTabAction } from '../../state';
import type { AssessmentTabChatBindings } from '../../types';
import { selectActiveCommentsTab } from '@/app/providers/state';
import type { AppAction } from '@/app/providers/state/actions';
import type { UseQueryResult } from '@tanstack/react-query';

type AddFeedbackDraft = Omit<AddInlineFeedbackRequest, 'fileId'> | Omit<AddBlockFeedbackRequest, 'fileId'>;

interface UseAssessmentCommentsActionsParams {
  appDispatch: Dispatch<AppAction>;
  localDispatch: Dispatch<AssessmentTabAction>;
  selectedFileId: string | null;
  feedbackListQuery: UseQueryResult<FeedbackItem[], Error>;
  comments: FeedbackItem[];
  addFeedback: (request: AddFeedbackDraft) => Promise<FeedbackItem>;
  canGenerateFeedbackDocument: boolean;
  setActiveCommandWithModeRule: (command: AssessmentTabChatBindings['activeCommand']) => void;
}

export function useAssessmentCommentsActions({
  appDispatch,
  localDispatch,
  selectedFileId,
  feedbackListQuery,
  comments,
  addFeedback,
  canGenerateFeedbackDocument,
  setActiveCommandWithModeRule
}: UseAssessmentCommentsActionsParams) {
  const { assessment } = usePorts();
  const {
    generateFeedbackDocumentForFile,
    isPending: isGenerateFeedbackPending,
    errorMessage: generateFeedbackErrorMessage
  } = useGenerateFeedbackDocumentMutation(selectedFileId);

  const onSelectionCaptured = useCallback(
    (selection: PendingSelection | null) => {
      localDispatch({ type: 'assessmentTab/setPendingSelection', payload: selection });
    },
    [localDispatch]
  );

  const onSelectComment = useCallback(
    (commentId: string) => {
      localDispatch({ type: 'assessmentTab/setActiveCommentId', payload: commentId });
      localDispatch({
        type: 'assessmentTab/setActiveCommentSelection',
        payload: selectPendingSelectionFromComments(comments, commentId)
      });
    },
    [comments, localDispatch]
  );

  const onEditComment = useCallback(
    async (commentId: string, nextText: string) => {
      try {
        await editCommentWorkflow({
          commentId,
          nextText,
          editFeedback: (request) => editAssessmentFeedback(assessment, request),
          refetchFeedback: feedbackListQuery.refetch
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to edit comment.';
        toast.error(message);
      }
    },
    [feedbackListQuery]
  );

  const onDeleteComment = useCallback(
    async (commentId: string) => {
      try {
        await deleteCommentWorkflow({
          commentId,
          deleteFeedback: (request) => deleteAssessmentFeedback(assessment, request),
          refetchFeedback: feedbackListQuery.refetch,
          onDeletedCommentId: (deletedCommentId) => {
            localDispatch({ type: 'assessmentTab/clearActiveCommentIfMatch', payload: deletedCommentId });
          }
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to delete comment.';
        toast.error(message);
      }
    },
    [feedbackListQuery, localDispatch]
  );

  const onApplyComment = useCallback(
    async (commentId: string, applied: boolean) => {
      try {
        await applyCommentWorkflow({
          commentId,
          applied,
          applyFeedback: (request) => applyAssessmentFeedback(assessment, request),
          refetchFeedback: feedbackListQuery.refetch
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to update apply state.';
        toast.error(message);
      }
    },
    [feedbackListQuery]
  );

  const onSendToLlm = useCallback(
    async (commentId: string, commandId?: string) => {
      try {
        await sendCommentToLlmWorkflow({
          commentId,
          commandId,
          sendFeedbackToLlm: (request) => sendAssessmentFeedbackToLlm(assessment, request),
          refetchFeedback: feedbackListQuery.refetch,
          onBeforeSend: ({ commentId: nextCommentId, commandId: nextCommandId }) => {
            localDispatch({ type: 'assessmentTab/setActiveCommentId', payload: nextCommentId });
            setActiveCommandWithModeRule(toSendToLlmActiveCommand(nextCommandId));
          }
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to send comment to LLM.';
        toast.error(message);
      }
    },
    [feedbackListQuery, localDispatch, setActiveCommandWithModeRule]
  );

  const onGenerateFeedbackDocument = useCallback(async () => {
    try {
      const result = await generateFeedbackDocumentWorkflow({
        canGenerateFeedbackDocument,
        generateFeedbackDocumentForFile
      });
      if (!result) {
        return;
      }
      toast.success(`Generated feedback document: ${result.outputPath}`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : generateFeedbackErrorMessage ?? 'Unable to generate feedback document.';
      toast.error(message);
    }
  }, [canGenerateFeedbackDocument, generateFeedbackDocumentForFile, generateFeedbackErrorMessage]);

  const onCommentsTabChange = useCallback(
    (tab: ReturnType<typeof selectActiveCommentsTab>) => {
      appDispatch({ type: 'ui/setCommentsTab', payload: tab });
    },
    [appDispatch]
  );

  const onCreateCommentFromChatMessage = useCallback(
    async (text: string) => {
      if (!text) {
        return;
      }

      const existingComment = comments.find((comment) => comment.commentText === text);
      if (existingComment) {
        appDispatch({ type: 'ui/setTopTab', payload: 'assessment' });
        appDispatch({ type: 'ui/setCommentsTab', payload: 'comments' });
        localDispatch({ type: 'assessmentTab/setActiveCommentId', payload: existingComment.id });
        localDispatch({
          type: 'assessmentTab/setActiveCommentSelection',
          payload: selectPendingSelectionFromComments(comments, existingComment.id)
        });
        return;
      }

      try {
        const createdComment = await addFeedback({
          kind: 'block',
          source: 'llm',
          commentText: text
        });
        appDispatch({ type: 'ui/setTopTab', payload: 'assessment' });
        appDispatch({ type: 'ui/setCommentsTab', payload: 'comments' });
        localDispatch({ type: 'assessmentTab/setActiveCommentId', payload: createdComment.id });
        localDispatch({ type: 'assessmentTab/setActiveCommentSelection', payload: null });
      } catch {
        // Mutation hook owns the user-facing error toast.
      }
    },
    [addFeedback, appDispatch, comments, localDispatch]
  );

  return {
    isGenerateFeedbackPending,
    onSelectionCaptured,
    onSelectComment,
    onEditComment,
    onDeleteComment,
    onApplyComment,
    onSendToLlm,
    onGenerateFeedbackDocument,
    onCommentsTabChange,
    onCreateCommentFromChatMessage
  };
}
