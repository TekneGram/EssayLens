import { RubricForReactPanel, RubricSelection } from '@/features/rubric-tab/components';
import { useRubricTabController } from '@/features/rubric-tab/hooks';
import { RubricTabStateProvider } from '@/features/rubric-tab/state';

function RubricTabContent() {
  const controller = useRubricTabController();
  const canDeleteSelectedRubric = Boolean(controller.selectedRubricId && controller.selectedRubric && !controller.selectedRubric.isActive);

  return (
    <div className="rubric-tab workspace rubric" data-testid="rubric-tab">
      <RubricSelection
        rubrics={controller.rubricList}
        selectedRubricId={controller.selectedRubricId}
        canDeleteSelectedRubric={canDeleteSelectedRubric}
        isPending={controller.listQuery.isPending}
        isError={controller.listQuery.isError}
        onSelect={controller.selectRubric}
        onCreate={controller.createRubric}
        onClone={controller.cloneRubric}
        onDelete={controller.deleteRubric}
      />
      <RubricForReactPanel
        selectedRubricId={controller.selectedRubricId}
        interactionMode={controller.interactionMode}
        canEditSelectedRubric={controller.canEditSelectedRubric}
        onModeChange={controller.setInteractionMode}
      />
    </div>
  );
}

export function RubricTab() {
  return (
    <RubricTabStateProvider>
      <RubricTabContent />
    </RubricTabStateProvider>
  );
}
