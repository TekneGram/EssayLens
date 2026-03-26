interface GenerateFeedbackDocumentWorkflowParams {
  canGenerateFeedbackDocument: boolean;
  generateFeedbackDocumentForFile: () => Promise<{ fileId: string; outputPath: string }>;
}

export async function generateFeedbackDocumentWorkflow({
  canGenerateFeedbackDocument,
  generateFeedbackDocumentForFile
}: GenerateFeedbackDocumentWorkflowParams): Promise<{ fileId: string; outputPath: string } | null> {
  if (!canGenerateFeedbackDocument) {
    return null;
  }

  return generateFeedbackDocumentForFile();
}
