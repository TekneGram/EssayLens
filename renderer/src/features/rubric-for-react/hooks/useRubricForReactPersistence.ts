import { useCallback, useEffect, useMemo, useRef } from 'react';
import { RubricForReactUpdateQueue } from '@/features/rubric-for-react/application';
import type { RubricCommand } from '@/features/rubric-for-react/domain';
import { useRubricForReactMutations } from '@/features/rubric-for-react/hooks/useRubricForReactMutations';

export function useRubricForReactPersistence(rubricId: string | null) {
  const { updateRubric, isPending, errorMessage } = useRubricForReactMutations(rubricId);
  const updateRubricRef = useRef(updateRubric);
  const queueRef = useRef<RubricForReactUpdateQueue | null>(null);

  useEffect(() => {
    updateRubricRef.current = updateRubric;
  }, [updateRubric]);

  useEffect(() => {
    if (!rubricId) {
      queueRef.current = null;
      return;
    }

    const queue = new RubricForReactUpdateQueue((operation) => updateRubricRef.current(operation));
    queueRef.current = queue;

    return () => {
      void queue.flush();
      if (queueRef.current === queue) {
        queueRef.current = null;
      }
    };
  }, [rubricId]);

  const persistImmediate = useCallback(
    async (operation: RubricCommand) => {
      if (!rubricId) {
        return;
      }
      await updateRubric(operation);
    },
    [rubricId, updateRubric]
  );

  const scheduleUpdate = useCallback(
    (operationKey: string, operation: RubricCommand) => {
      if (!rubricId) {
        return;
      }
      queueRef.current?.schedule(operationKey, operation);
    },
    [rubricId]
  );

  const flushPendingUpdates = useCallback(async () => {
    if (!queueRef.current) {
      return;
    }
    await queueRef.current.flush();
  }, []);

  return useMemo(
    () => ({
      persistImmediate,
      scheduleUpdate,
      flushPendingUpdates,
      isPending,
      errorMessage
    }),
    [errorMessage, flushPendingUpdates, isPending, persistImmediate, scheduleUpdate]
  );
}
