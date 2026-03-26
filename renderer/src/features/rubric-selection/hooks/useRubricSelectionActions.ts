import { useCallback } from 'react';

interface UseRubricSelectionActionsArgs {
  onDelete: () => void | Promise<void>;
}

export function useRubricSelectionActions(args: UseRubricSelectionActionsArgs) {
  const { onDelete } = args;

  const onDeleteWithConfirm = useCallback(async () => {
    const shouldDelete = window.confirm('Delete this rubric permanently?');
    if (!shouldDelete) {
      return;
    }
    await onDelete();
  }, [onDelete]);

  return { onDeleteWithConfirm };
}
