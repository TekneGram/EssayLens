import type { RubricPort } from '@/app/ports';

function getElectronRubricApi(): RubricPort {
  const appWindow = window as Window & { api?: { rubric?: RubricPort } };
  if (!appWindow.api?.rubric) {
    throw new Error('window.api.rubric is not available.');
  }

  return appWindow.api.rubric;
}

export function createElectronRubricAdapter(): RubricPort {
  return {
    listRubrics: () => getElectronRubricApi().listRubrics(),
    createRubric: (request) => getElectronRubricApi().createRubric(request),
    cloneRubric: (request) => getElectronRubricApi().cloneRubric(request),
    deleteRubric: (request) => getElectronRubricApi().deleteRubric(request),
    getFileScores: (request) => getElectronRubricApi().getFileScores(request),
    saveFileScores: (request) => getElectronRubricApi().saveFileScores(request),
    clearAppliedRubric: (request) => getElectronRubricApi().clearAppliedRubric(request),
    getGradingContext: (request) => getElectronRubricApi().getGradingContext(request),
    getMatrix: (request) => getElectronRubricApi().getMatrix(request),
    updateMatrix: (request) => getElectronRubricApi().updateMatrix(request),
    setLastUsed: (request) => getElectronRubricApi().setLastUsed(request)
  };
}
