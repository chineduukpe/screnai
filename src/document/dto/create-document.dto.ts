import { DocumentMetaI } from '../interfaces/document.entitiy.interfaces';

export class CreateDocumentDto {
  documentName: string;
  dealId: number;
  inputFileURL: string;
  fileType?: string;
  userId: string;
  meta?: DocumentMetaI;
  status?: string;
  conversationId?: string;
}
