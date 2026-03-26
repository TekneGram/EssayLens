import type {
  AddFeedbackRequest,
  AddFeedbackResponse,
  ApplyFeedbackRequest,
  DeleteFeedbackRequest,
  EditFeedbackRequest,
  ExtractDocumentResponse,
  GenerateFeedbackDocumentResponse,
  ListFeedbackResponse,
  SendFeedbackToLlmRequest
} from '@/app/ports/assessment.port';
import type { AssessmentPort } from '@/app/ports';

function toError(message: string, fallback: string): Error {
  return new Error(message || fallback);
}

export async function listAssessmentFeedback(
  assessmentPort: AssessmentPort,
  fileId: string
): Promise<ListFeedbackResponse['feedback']> {
  const result = await assessmentPort.listFeedback({ fileId });
  if (!result.ok) {
    throw toError(result.error.message, 'Unable to load comments.');
  }

  return result.data.feedback;
}

export async function addAssessmentFeedback(
  assessmentPort: AssessmentPort,
  request: AddFeedbackRequest
): Promise<AddFeedbackResponse['feedback']> {
  const result = await assessmentPort.addFeedback(request);
  if (!result.ok) {
    throw toError(result.error.message, 'Unable to add feedback.');
  }

  return result.data.feedback;
}

export async function editAssessmentFeedback(assessmentPort: AssessmentPort, request: EditFeedbackRequest): Promise<void> {
  const result = await assessmentPort.editFeedback(request);
  if (!result.ok) {
    throw toError(result.error.message, 'Unable to edit comment.');
  }
}

export async function deleteAssessmentFeedback(
  assessmentPort: AssessmentPort,
  request: DeleteFeedbackRequest
): Promise<void> {
  const result = await assessmentPort.deleteFeedback(request);
  if (!result.ok) {
    throw toError(result.error.message, 'Unable to delete comment.');
  }
}

export async function applyAssessmentFeedback(
  assessmentPort: AssessmentPort,
  request: ApplyFeedbackRequest
): Promise<void> {
  const result = await assessmentPort.applyFeedback(request);
  if (!result.ok) {
    throw toError(result.error.message, 'Unable to update apply state.');
  }
}

export async function sendAssessmentFeedbackToLlm(
  assessmentPort: AssessmentPort,
  request: SendFeedbackToLlmRequest
): Promise<void> {
  const result = await assessmentPort.sendFeedbackToLlm(request);
  if (!result.ok) {
    throw toError(result.error.message, 'Unable to send comment to LLM.');
  }
}

export async function generateAssessmentFeedbackDocument(
  assessmentPort: AssessmentPort,
  fileId: string
): Promise<GenerateFeedbackDocumentResponse> {
  const result = await assessmentPort.generateFeedbackDocument({ fileId });
  if (!result.ok) {
    throw toError(result.error.message, 'Unable to generate feedback document.');
  }

  return result.data;
}

export async function extractAssessmentDocument(
  assessmentPort: AssessmentPort,
  fileId: string
): Promise<ExtractDocumentResponse> {
  const result = await assessmentPort.extractDocument({ fileId });
  if (!result.ok) {
    throw toError(result.error.message, 'Unable to load document.');
  }

  return result.data;
}
