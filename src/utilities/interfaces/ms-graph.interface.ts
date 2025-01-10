export interface MSGraphUploadResponseI {
  embedURL: string;
  uploadResponse: MSGraphAPIResponseI;
}

export interface MSGraphAPIResponseI {
  id: string;
  '@odata.context': string;
  '@odata.etag': string;
  '@microsoft.graph.downloadUrl': string;
  createdDateTime: Date;
  eTag: string;
  lastModifiedDateTime: Date;
  name: string;
  size: number;
  webUrl: string;
  cTag: string;
  parentReference: {
    driveId: string;
    driveType: string;
    id: string;
    path: string;
  };
}

export interface MSRangeQueryResponseI {
  values: Array<Array<number | string>>;
  formulasR1C1: Array<Array<number | string>>;
  formulasLocal: Array<Array<number | string>>;
  formulas: Array<Array<number | string>>;
  text: Array<Array<number | string>>;
  numberFormat: Array<Array<number | string>>;
  address: string;
  addressLocal: string;
  columnHidden: boolean;
  rowHidden: boolean;
  columnCount: number;
  cellCount: number;
}

export interface MSGraphWorksheetNameI {
  '@odata.id': string;
  id: string;
  name: string;
  position: number;
  visibility: string;
}

export interface MicrosoftMetaI {
  id?: string;
  eTag?: string;
  embedURL?: string;
  downloadURL?: string;
  webURL?: string;
}
