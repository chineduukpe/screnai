export interface CallCresaI {
  query: string;
  files?: CresaFileI[];
  conversationId: string;
}

export interface CresaFileI {
  fileName: string;
  fileURL: string;
  loading?: boolean;
}

export interface CallBeachhead {
  query: string;
  address?: string;
  conversationId: string;
  placeId?: string;
}
