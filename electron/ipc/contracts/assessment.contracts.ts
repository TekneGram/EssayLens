export interface FeedbackAnchorDto {
  part: string;
  paragraphIndex: number;
  runIndex: number;
  charOffset: number;
}

interface FeedbackDtoBase {
  id: string;
  fileId: string;
  source: 'teacher' | 'llm';
  commentText: string;
  createdAt: string;
  updatedAt?: string;
  applied?: boolean;
}

export interface InlineFeedbackDto extends FeedbackDtoBase {
  kind: 'inline';
  exactQuote: string;
  prefixText: string;
  suffixText: string;
  startAnchor: FeedbackAnchorDto;
  endAnchor: FeedbackAnchorDto;
}

export interface BlockFeedbackDto extends FeedbackDtoBase {
  kind: 'block';
}

export type FeedbackDto = InlineFeedbackDto | BlockFeedbackDto;

export interface ExtractDocumentRequest {
  fileId: string;
}

export interface ExtractDocumentResponse {
  fileId: string;
  text: string;
  extractedAt?: string;
  format?: 'docx' | 'pdf' | 'other';
  fileName?: string;
  dataBase64?: string;
}

export interface ListFeedbackRequest {
  fileId: string;
}

export interface ListFeedbackResponse {
  feedback: FeedbackDto[];
}

interface AddFeedbackRequestBase {
  fileId: string;
  source: 'teacher' | 'llm';
  commentText: string;
}

export interface AddInlineFeedbackRequest extends AddFeedbackRequestBase {
  kind: 'inline';
  exactQuote: string;
  prefixText: string;
  suffixText: string;
  startAnchor: FeedbackAnchorDto;
  endAnchor: FeedbackAnchorDto;
}

export interface AddBlockFeedbackRequest extends AddFeedbackRequestBase {
  kind: 'block';
}

export type AddFeedbackRequest = AddInlineFeedbackRequest | AddBlockFeedbackRequest;

export interface AddFeedbackResponse {
  feedback: FeedbackDto;
}

export interface EditFeedbackRequest {
  feedbackId: string;
  commentText: string;
}

export interface EditFeedbackResponse {
  feedback: FeedbackDto;
}

export interface DeleteFeedbackRequest {
  feedbackId: string;
}

export interface DeleteFeedbackResponse {
  deletedFeedbackId: string;
}

export interface ApplyFeedbackRequest {
  feedbackId: string;
  applied: boolean;
}

export interface ApplyFeedbackResponse {
  feedback: FeedbackDto;
}

export interface SendFeedbackToLlmRequest {
  feedbackId: string;
  command?: string;
}

export interface SendFeedbackToLlmResponse {
  status: 'queued' | 'sent';
  messageId?: string;
}

export interface GenerateFeedbackDocumentRequest {
  fileId: string;
}

export interface GenerateFeedbackDocumentResponse {
  fileId: string;
  outputPath: string;
}

export interface RequestLlmAssessmentRequest {
  fileId: string;
  instruction?: string;
}

export interface RequestLlmAssessmentResponse {
  status: 'queued' | 'completed';
  feedback?: FeedbackDto[];
}
