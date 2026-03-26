import type { AssessmentPort } from '@/app/ports';
import { invokeRequest } from '@/app/invokeRequest';

export function createElectronAssessmentAdapter(): AssessmentPort {
  return {
    extractDocument: (request) => invokeRequest('assessment/extractDocument', request),
    listFeedback: (request) => invokeRequest('assessment/listFeedback', request),
    addFeedback: (request) => invokeRequest('assessment/addFeedback', request),
    editFeedback: (request) => invokeRequest('assessment/editFeedback', request),
    deleteFeedback: (request) => invokeRequest('assessment/deleteFeedback', request),
    applyFeedback: (request) => invokeRequest('assessment/applyFeedback', request),
    sendFeedbackToLlm: (request) => invokeRequest('assessment/sendFeedbackToLlm', request),
    generateFeedbackDocument: (request) => invokeRequest('assessment/generateFeedbackDocument', request),
    requestLlmAssessment: (request) => invokeRequest('assessment/requestLlmAssessment', request)
  };
}
