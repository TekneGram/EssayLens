const CHANGE_RUBRIC_MESSAGE =
  'Are you sure you want to change the rubric? ALL scores on ALL documents will be removed and you will need to rescore all the documents';

export function confirmRubricChange(): boolean {
  return window.confirm(CHANGE_RUBRIC_MESSAGE);
}
