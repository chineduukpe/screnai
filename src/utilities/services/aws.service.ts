import { Injectable } from '@nestjs/common';
import { S3Client, CopyObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import axios from 'axios';
import { log } from 'console';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

@Injectable()
export class AWSService {
  S3_CONNECTION = null;
  private secretManagerClient: SecretsManagerClient;
  private s3Client: S3Client;
  private credentials;

  constructor() {
    this.secretManagerClient = new SecretsManagerClient({
      region: process.env.AWS_DEFAULT_REGION,
      credentials: {
        accessKeyId: process.env.AWS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET,
      },
    });

    this.s3Client = new S3Client({
      region: process.env.AWS_DEFAULT_REGION,
      credentials: {
        accessKeyId: process.env.AWS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET,
      },
    });
  }

  async getAppSecretStore() {
    const secret_name = 'copilotv2/staging';
    let response;
    try {
      response = await this.secretManagerClient.send(
        new GetSecretValueCommand({
          SecretId: secret_name,
          VersionStage: 'AWSCURRENT', // VersionStage defaults to AWSCURRENT if unspecified
        }),
      );
    } catch (error) {
      // For a list of exceptions thrown, see
      // https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html
      throw error;
    }

    const secret = response.SecretString;
    return secret;
  }

  async getAppSecret(key: string): Promise<string> {
    try {
      const secretStore = await this.getAppSecretStore();
      return JSON.parse(secretStore)[key];
    } catch (e) {
      console.log(e);
      return '';
    }
  }

  getS3Connection() {
    return null;
    // AWS.config.update({
    //   accessKeyId: process.env.AWS_KEY_ID,
    //   secretAccessKey: process.env.AWS_SECRET,
    //   sessionToken: process.env.AWS_SESSION_KEY,
    //   s3ForcePathStyle: true,
    //   // sslEnabled: false,
    // });

    // const BUCKET: AWS.S3 = new AWS.S3({
    //   apiVersion: '2006-03-01',
    //   params: { Bucket: process.env.EXTRACTION_S3_BUCKET },
    //   region: process.env.AWS_DEFAULT_REGION,
    //   // sslEnabled: false,
    //   accessKeyId: process.env.AWS_KEY_ID,
    //   secretAccessKey: process.env.AWS_SECRET,
    //   sessionToken: process.env.AWS_SESSION_KEY,
    // });

    // this.S3_CONNECTION = BUCKET;

    // return BUCKET;
  }

  getStoredFilePath(key: string): string | null {
    if (!this.S3_CONNECTION) return null;
    return `https://${process.env.EXTRACTION_S3_BUCKET}.${this.S3_CONNECTION.endpoint.host}/${key}`;
  }

  getOutputFilePath(key: string): string | null {
    return `https://${process.env.EXTRACTION_S3_BUCKET}.s3.us-east-1.amazonaws.com${key}`;
    if (!this.S3_CONNECTION) return null;
    return `https://${process.env.EXTRACTION_S3_BUCKET}.${this.S3_CONNECTION.endpoint.host}/${key}`;
  }

  async uploadBufferToS3(
    buffer: Buffer,
    fileKey: string = null,
    otherParams: any = {},
  ): Promise<string> {
    const fileName = fileKey ?? `${Math.floor(Math.random() * 800000000)}.xlsx`;

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    // const _this = this;
    const params = {
      Body: buffer,
      Bucket: process.env.EXTRACTION_S3_BUCKET,
      Key: fileName,
      ACL: 'public-read',
      ContentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ...otherParams,
    };

    const resp = new Upload({
      client: this.s3Client,
      params,
    });

    const data = await resp.done();
    // const command = new UploadC(params);

    // const data = await this.s3Client.send(command);

    console.log(data);
    return data.Location;
  }

  async getFileAsBuffer(key: string) {
    console.log(key, 'key');
    const connection = this.getS3Connection();
    console.log(connection, 'connection');
    const fileKey = this.getFileKeyFromURL(key);
    console.log(fileKey, 'fileKey');
    const params = {
      Bucket: process.env.EXTRACTION_S3_BUCKET,
      Key: fileKey,
    };

    const response = await connection.getObject(params).promise();
    const fileBuffer = response.Body;
    return fileBuffer;
  }

  getFileKeyFromURL(url: string): string {
    return url
      .replace(
        `https://${process.env.EXTRACTION_S3_BUCKET}.${
          this.getS3Connection()?.endpoint?.host
        }/`,
        '',
      )
      .replace(
        `https://${process.env.EXTRACTION_S3_BUCKET}.s3.${process.env.AWS_DEFAULT_REGION}.amazonaws.com/`,
        '',
      );
  }

  async uploadFileToS3FromURL(url: string, fileKey: string = null) {
    try {
      const response = await axios({
        method: 'get',
        url,
        responseType: 'stream',
      });

      const uploadURL = await this.uploadBufferToS3(response.data);
      log(uploadURL, 'UPLOAD URL');
      return uploadURL;
    } catch (error) {
      log(error, 'Could not update model');
    }
  }

  async copyFileToBucket(
    sourceBucket: string,
    destinationBucket: string,
    sourceFileKey: string,
    destinationFileKey: string,
  ): Promise<void> {
    const copyParams = {
      CopySource: `${sourceBucket}/${sourceFileKey}`,
      Bucket: destinationBucket,
      Key: destinationFileKey,
    };

    try {
      const copyCommand = new CopyObjectCommand(copyParams);
      await this.s3Client.send(copyCommand);
      console.log(
        `File copied successfully from ${sourceBucket} to ${destinationBucket}`,
      );
    } catch (error) {
      console.error('Error copying file:', error);
      throw error;
    }
  }
}
