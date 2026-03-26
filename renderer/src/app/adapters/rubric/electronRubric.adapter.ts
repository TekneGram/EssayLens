import type { RubricPort } from '@/app/ports';
import { invokeRequest } from '@/app/invokeRequest';

export function createElectronRubricAdapter(): RubricPort {
  return {
    listRubrics: () => invokeRequest('rubric/listRubrics'),
    createRubric: (request) => invokeRequest('rubric/createRubric', request),
    cloneRubric: (request) => invokeRequest('rubric/cloneRubric', request),
    deleteRubric: (request) => invokeRequest('rubric/deleteRubric', request),
    getFileScores: (request) => invokeRequest('rubric/getFileScores', request),
    saveFileScores: (request) => invokeRequest('rubric/saveFileScores', request),
    clearAppliedRubric: (request) => invokeRequest('rubric/clearAppliedRubric', request),
    getGradingContext: (request) => invokeRequest('rubric/getGradingContext', request),
    getMatrix: (request) => invokeRequest('rubric/getMatrix', request),
    updateMatrix: (request) => invokeRequest('rubric/updateMatrix', request),
    setLastUsed: (request) => invokeRequest('rubric/setLastUsed', request)
  };
}
