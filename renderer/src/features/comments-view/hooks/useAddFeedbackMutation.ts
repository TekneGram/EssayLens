import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import type {
  AddBlockFeedbackRequest,
  AddFeedbackRequest,
  AddInlineFeedbackRequest
} from '@/app/ports/assessment.port';
import type { FeedbackItem } from '@/features/feedback/domain';
import { usePorts } from '@/app/ports';
import { addAssessmentFeedback } from '../application/assessmentApi.service';
import { assessmentQueryKeys } from './queryKeys';

type AddInlineFeedbackDraft = Omit<AddInlineFeedbackRequest, 'fileId'>;
type AddBlockFeedbackDraft = Omit<AddBlockFeedbackRequest, 'fileId'>;
type AddFeedbackDraft = AddInlineFeedbackDraft | AddBlockFeedbackDraft;

interface UseAddFeedbackMutationResult {
  addFeedback: (request: AddFeedbackDraft) => Promise<FeedbackItem>;
  errorMessage?: string;
  isPending: boolean;
}

export function useAddFeedbackMutation(selectedFileId: string | null): UseAddFeedbackMutationResult {
  const { assessment } = usePorts();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (request: AddFeedbackDraft) => {
      if (!selectedFileId) {
        throw new Error('Select a file before adding feedback.');
      }
      if (request.kind === 'inline') {
        return addAssessmentFeedback(assessment, {
          ...request,
          fileId: selectedFileId
        });
      }
      return addAssessmentFeedback(assessment, {
        ...request,
        fileId: selectedFileId
      });
    },
    onSuccess: async () => {
      if (selectedFileId) {
        await queryClient.invalidateQueries({
          queryKey: assessmentQueryKeys.feedbackList(selectedFileId)
        });
      }
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Unable to add feedback.';
      toast.error(message);
    }
  });

  return {
    addFeedback: mutation.mutateAsync,
    errorMessage: mutation.error instanceof Error ? mutation.error.message : undefined,
    isPending: mutation.isPending
  };
}
