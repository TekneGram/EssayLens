import type { AssessmentPort } from '@/app/ports';

function getElectronAssessmentApi(): AssessmentPort {
  const appWindow = window as Window & { api?: { assessment?: AssessmentPort } };
  if (!appWindow.api?.assessment) {
    throw new Error('window.api.assessment is not available.');
  }

  return appWindow.api.assessment;
}

export function createElectronAssessmentAdapter(): AssessmentPort {
  return {
    extractDocument: (request) => getElectronAssessmentApi().extractDocument(request),
    listFeedback: (request) => getElectronAssessmentApi().listFeedback(request),
    addFeedback: (request) => getElectronAssessmentApi().addFeedback(request),
    editFeedback: (request) => getElectronAssessmentApi().editFeedback(request),
    deleteFeedback: (request) => getElectronAssessmentApi().deleteFeedback(request),
    applyFeedback: (request) => getElectronAssessmentApi().applyFeedback(request),
    sendFeedbackToLlm: (request) => getElectronAssessmentApi().sendFeedbackToLlm(request),
    generateFeedbackDocument: (request) => getElectronAssessmentApi().generateFeedbackDocument(request),
    requestLlmAssessment: (request) => getElectronAssessmentApi().requestLlmAssessment(request)
  };
}
