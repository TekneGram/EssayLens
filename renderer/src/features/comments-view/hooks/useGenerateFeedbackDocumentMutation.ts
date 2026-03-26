import { useMutation } from '@tanstack/react-query';
import { usePorts } from '@/app/ports';
import { generateAssessmentFeedbackDocument } from '../application/assessmentApi.service';

interface UseGenerateFeedbackDocumentMutationResult {
  generateFeedbackDocumentForFile: () => Promise<{ fileId: string; outputPath: string }>;
  isPending: boolean;
  errorMessage?: string;
}

export function useGenerateFeedbackDocumentMutation(
  selectedFileId: string | null
): UseGenerateFeedbackDocumentMutationResult {
  const { assessment } = usePorts();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedFileId) {
        throw new Error('No file selected.');
      }
      return generateAssessmentFeedbackDocument(assessment, selectedFileId);
    }
  });

  return {
    generateFeedbackDocumentForFile: () => mutation.mutateAsync(),
    isPending: mutation.isPending,
    errorMessage: mutation.error instanceof Error ? mutation.error.message : undefined
  };
}
