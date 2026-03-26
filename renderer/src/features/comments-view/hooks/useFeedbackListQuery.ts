import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { usePorts } from '@/app/ports';
import { listAssessmentFeedback } from '../application/assessmentApi.service';
import { assessmentQueryKeys } from './queryKeys';

export function useFeedbackListQuery(fileId: string | null) {
  const { assessment } = usePorts();
  const lastErrorAt = useRef<number | null>(null);

  const query = useQuery({
    queryKey: assessmentQueryKeys.feedbackList(fileId ?? 'none'),
    enabled: Boolean(fileId),
    queryFn: async () => {
      if (!fileId) {
        return [];
      }
      return listAssessmentFeedback(assessment, fileId);
    }
  });

  useEffect(() => {
    if (!query.isError) {
      return;
    }

    const nextErrorAt = query.errorUpdatedAt;
    if (lastErrorAt.current === nextErrorAt) {
      return;
    }
    lastErrorAt.current = nextErrorAt;

    const message = query.error instanceof Error ? query.error.message : 'Unable to load comments.';
    toast.error(message);
  }, [query.error, query.errorUpdatedAt, query.isError]);

  return query;
}
