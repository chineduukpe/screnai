export interface ExtractionFailedNotificationI {
  extractionId: number;
  fileId?: number;
  message: string;
  inputFileURL?: string;
  extractedFileURL?: string;
  postProcessedFileURL?: string;
  fileType?: string;
}
