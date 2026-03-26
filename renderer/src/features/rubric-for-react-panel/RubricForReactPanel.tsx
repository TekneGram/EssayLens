import { RubricForReact } from '@/features/rubric-for-react';

interface RubricForReactPanelProps {
  selectedRubricId: string | null;
  interactionMode: 'editing' | 'viewing';
  canEditSelectedRubric: boolean;
  onModeChange: (mode: 'editing' | 'viewing') => void | Promise<void>;
}

export function RubricForReactPanel(props: RubricForReactPanelProps) {
  const { selectedRubricId, interactionMode, canEditSelectedRubric, onModeChange } = props;

  return (
    <section className="rubric-view subpane" aria-label="Rubric view">
      <h4>Rubric</h4>
      <div className="content-block">
        {!selectedRubricId ? <div>Select a rubric to begin.</div> : null}
        {selectedRubricId ? (
          <RubricForReact
            rubricId={selectedRubricId}
            mode={interactionMode}
            canEdit={canEditSelectedRubric}
            onModeChange={(mode) => {
              void onModeChange(mode);
            }}
          />
        ) : null}
      </div>
    </section>
  );
}
