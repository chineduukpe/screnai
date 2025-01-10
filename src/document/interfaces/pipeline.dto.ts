export interface T12PipelineResponseI {
  data: ResponseDataItemI;
  output_path: string;
  msg: string;
}

export interface ResponseDataItemI {
  columns: string[];
  index: number[];
  data: string[][];
}

export interface RRPipelineResponseI {
  download_url: string;
  msg: string;
}

export interface RRPostProcessingResponseI {
  awsUrl: string;
  response: RRPostProcessingAPIResponseI;
}

export interface RRPostProcessingAPIResponseI {
  data: ResponseDataItemI;
  output_path: string;
  msg: string;
}
