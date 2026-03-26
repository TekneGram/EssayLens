import type { NormalizedRubric, RubricClassNames, RubricDisplayMode, RubricSourceData } from '@/features/rubric-for-react/domain/rubricModel';

export interface RubricForReactProps {
  rubricId?: string | null;
  sourceData?: RubricSourceData | NormalizedRubric;
  isGrading?: boolean;
  canEdit?: boolean;
  className?: string;
  classes?: Partial<RubricClassNames>;
  mode?: 'editing' | 'viewing';
  displayMode?: RubricDisplayMode;
  onModeChange?: (mode: 'editing' | 'viewing') => void;
  onSelectedCellKeysChange?: (selectedCellKeys: string[]) => void;
  initialSelectedCellKeys?: string[];
  onSetRubricName?: (name: string) => void | Promise<void>;
  onAddCategory?: (name: string) => void | Promise<void>;
  onAddScore?: (value: number) => void | Promise<void>;
  onRenameCategory?: (from: string, to: string) => void | Promise<void>;
  onRemoveCategory?: (categoryName: string) => void | Promise<void>;
  onSetScoreValue?: (from: number, to: number) => void | Promise<void>;
  onRemoveScore?: (scoreValue: number) => void | Promise<void>;
  onSetCellDescription?: (detailId: string, description: string) => void | Promise<void>;
  onChange?: (next: NormalizedRubric) => void;
}
