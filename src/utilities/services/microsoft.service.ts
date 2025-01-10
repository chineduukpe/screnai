import { Injectable } from '@nestjs/common';
import {
  // AuthenticationProviderOptions,
  Client,
  ResponseType,
} from '@microsoft/microsoft-graph-client';
import axios from 'axios';
// import * as xl from 'excel4node';
import { ClientSecretCredential } from '@azure/identity';
import {
  MSGraphUploadResponseI,
  MSGraphWorksheetNameI,
  MSRangeQueryResponseI,
} from '../interfaces/ms-graph.interface';
import { log } from 'console';
import { MICROSOFT_HEADERS } from '../constants';
require('isomorphic-fetch');

@Injectable()
export class MicrosoftService {
  async authenticateClient() {
    const token: string = await this.generateToken();
    const client = Client.initWithMiddleware({
      authProvider: {
        getAccessToken: async () => {
          return token;
        },
      },
    });
    return client;
  }

  private async generateToken(): Promise<string> {
    const tenantId = process.env.AZURE_TENANT_ID;
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_APP_SECRET;
    const clientCredentials = new ClientSecretCredential(
      tenantId,
      clientId,
      clientSecret,
    );

    return (
      await clientCredentials.getToken('https://graph.microsoft.com/.default')
    ).token;
  }

  async getUserDetail() {
    const ls = await axios.post(
      `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token HTTP/1.1`,
      {
        client_id: process.env.AZURE_CLIENT_ID,
        scope: 'https://graph.microsoft.com/.default',
        client_secret: process.env.AZURE_APP_SECRET,
        grant_type: 'client_credentials',
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );
    const token = await this.generateToken();
    const client = await this.authenticateClient();
    return await client.api(`/me`).get();
  }

  async getAFileUsedRange(fileTag: string, sheetName: string) {
    const azureClient = await this.authenticateClient();

    return await new Promise<MSRangeQueryResponseI>((resolve, reject) => {
      azureClient
        .api(
          `/drive/items/${fileTag}/workbook/worksheets('${sheetName}')/usedRange`,
        )
        .get()
        .then((data) => {
          resolve(data);
        })
        .catch((error) => {
          log(error, 'RANGE FETCH ERROR');
          reject(error);
        });
    });
  }

  async deleteSheetFromWorkbook(workbookId: string, sheetName: string) {
    const url = `/drive/items/${workbookId}/workbook/worksheets/${sheetName}`;
    const azureClient = await this.authenticateClient();

    return await new Promise((resolve, reject) => {
      azureClient
        .api(url)
        .delete()
        .then((data) => {
          resolve(data);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  async createNewWorkbook(workbookName: string, file = {}) {
    const azureClient = await this.authenticateClient();
    return new Promise((resolve, reject) => {
      azureClient
        .api(`/drive/root/children`)
        .post({
          name: workbookName,
          file,
          '@microsoft.graph.conflictBehavior': 'rename',
        })
        .then((response) => {
          resolve(response);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  async addSheetToWorkbook(workbookId: string, sheetName: string) {
    const url = `/drive/items/${workbookId}/workbook/worksheets/add`;
    const payload = {
      name: sheetName,
    };
    const azureClient = await this.authenticateClient();

    return await new Promise((resolve, reject) => {
      azureClient
        .api(url)
        .post(payload)
        .then((data) => {
          resolve(data);
        })
        .catch((error) => {
          log(error);
          reject(error);
        });
    });
  }

  async getSheetRangeData(
    workbookId: string,
    worksheetName: string,
    range: string,
  ) {
    const getDataUrl = `/drive/items/${workbookId}/workbook/worksheets('${worksheetName}')/range(address='${range}')?$select=values,format,formulas`;

    const azureClient = await this.authenticateClient();

    return new Promise<{
      values: Array<any>;
      format: Array<any>;
      formulas: Array<any>;
    }>((resolve, reject) => {
      azureClient
        .api(getDataUrl)
        .get()
        .then((response) => {
          resolve({
            values: response.values,
            format: response.format,
            formulas: response.formulas,
          });
        })
        .catch((err) => {
          reject(err);
          console.error(
            'Error retrieving data, styles, and formulas for the column:',
            err,
          );
        });
    });
  }

  async replaceColumnData(
    workbookId: string,
    worksheetName: string,
    updateDataRange: string,
    newData: Array<Array<string | number>>,
  ) {
    const azureClient = await this.authenticateClient();
    await this.unprotectWorkbook(workbookId, worksheetName);
    const updateDataUrl = `/drive/items/${workbookId}/workbook/worksheets('${worksheetName}')/range(address='${updateDataRange}')`;

    const updateDataRequestBody = {
      values: newData,
    };

    return new Promise((resolve, reject) => {
      azureClient
        .api(updateDataUrl)
        .patch(updateDataRequestBody)
        .then((data) => {
          resolve(data);
        })
        .catch((err) => {
          console.error('Error inserting data into column:', err);
          reject(err);
        });
    });
  }

  async replaceColumnFormulaData(
    workbookId: string,
    worksheetName: string,
    updateDataRange: string,
    payload: string[][] | number[][],
  ) {
    const url = `/drive/items/${workbookId}/workbook/worksheets('${worksheetName}')/range(address='${updateDataRange}')`;
    return await this.sendUpdateRequestToMSGraph(url, { formulas: payload });
  }

  async sendUpdateRequestToMSGraph(
    url: string,
    payload: {
      values?: any[];
      formulas?: any[];
    },
  ) {
    const azureClient = await this.authenticateClient();
    return new Promise((resolve, reject) => {
      azureClient
        .api(url)
        .patch(payload)
        .then((data) => {
          resolve(data);
        })
        .catch((err) => {
          console.error('Error inserting data into column:', err);
          reject(err);
        });
    });
  }

  async unprotectWorkbook(workbookId: string, sheetName: string) {
    const azureClient = await this.authenticateClient();

    return new Promise((resolve, reject) => {
      azureClient
        .api(
          `/drive/items/${workbookId}/workbook/worksheets('${sheetName}')/protection/unprotect`,
        )
        .post({})
        .then((data) => {
          resolve(data);
        })
        .catch((err) => {
          log(err);
          reject(err);
        });
    });
  }

  // async fileUpload(filePath: string, fileName: string, wb: any) {
  //   const ws = wb.addWorksheet('Demo upload');
  //   ws.cell(1, 1, 1, 5, true)
  //     .string('Hello world!')
  //     .style({ background: '#eaaa12' });
  //
  //   const filePathUpload = `function-${Math.floor(
  //     Math.random() * 1000000,
  //   )}.xlsx`;
  //
  //   const res = await this.uploadToOneDrive(wb, filePathUpload);
  // }

  async createSharableLink(id: string) {
    const azureClient = await this.authenticateClient();

    return new Promise((resolve, reject) => {
      azureClient
        .api(`/drive/items/${id}/createLink`)
        .post({
          type: 'edit',
          scope: 'anonymous',
        })
        .then((data) => {
          resolve(data);
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }

  // async uploadToOneDrive(
  //   wb: xl.Workbook,
  //   filePath = '',
  // ): Promise<{
  //   uploadResponse: any;
  //   embedURL: string;
  // }> {
  //   const filePathUpload: string =
  //     filePath ?? `upload-${10000000 + Math.floor(Math.random())}.xlsx`;
  //   // eslint-disable-next-line @typescript-eslint/no-this-alias
  //   const _this = this;
  //   const azureClient = await this.authenticateClient();
  //   return new Promise((resolve, reject) => {
  //     try {
  //       wb.write(filePathUpload, async function () {
  //         fs.readFile(filePathUpload, (err, data) => {
  //           if (err) {
  //             console.error('Error reading file:', err);
  //             return;
  //           }
  //           azureClient
  //             .api(`/drive/root/children`)
  //             .post({
  //               name: filePathUpload,
  //               file: data,
  //               '@microsoft.graph.conflictBehavior': 'rename', // Specify the behavior in case of naming conflicts
  //             })
  //             .then((uploadResponse) => {
  //               azureClient
  //                 .api(`/drive/items/${uploadResponse.id}/content`)
  //                 .put(data)
  //                 .then(() => {
  //                   console.log('File uploaded successfully.');
  //                 })
  //                 .catch((uploadError) => {
  //                   console.error('Error uploading file:', uploadError);
  //                 });
  //               resolve({
  //                 uploadResponse,
  //                 embedURL: _this.formatEmbedURL(uploadResponse?.eTag),
  //               });
  //             })
  //             .catch((createError) => {
  //               console.error('Error creating file:', createError);
  //             });
  //         });
  //       });
  //     } catch (e) {
  //       return reject(e);
  //     }
  //   });
  // }

  async uploadBufferToMSGraph(filePathUpload: string, data: any) {
    const azureClient = await this.authenticateClient();
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const _this = this;
    return new Promise<MSGraphUploadResponseI>((resolve, reject) => {
      azureClient
        .api(`/drive/root/children`)
        .post({
          name: filePathUpload,
          file: data,
          '@microsoft.graph.conflictBehavior': 'rename', // Specify the behavior in case of naming conflicts
        })
        .then((uploadResponse) => {
          azureClient
            .api(`/drive/items/${uploadResponse.id}/content`)
            .put(data)
            .then(() => {
              console.log('File uploaded successfully.');
            })
            .catch((uploadError) => {
              console.error('Error uploading file:', uploadError);
            });
          resolve({
            uploadResponse,
            embedURL: _this.formatEmbedURL(uploadResponse?.eTag),
          });
        })
        .catch((createError) => {
          console.error('Error creating file:', createError);
        });
    });
  }

  async getWorkbookContent(workbookId: string) {
    const azureClient = await this.authenticateClient();
    return new Promise<Buffer>((resolve, reject) => {
      azureClient
        .api(`/drive/items/${workbookId}/content`)
        .responseType(ResponseType.ARRAYBUFFER)
        .get()
        .then((data) => {
          resolve(data);
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  }

  async putNewWorkbookContent(workbookId: string, content: any) {
    const azureClient = await this.authenticateClient();
    return new Promise((resolve, reject) => {
      azureClient
        .api(`/drive/items/${workbookId}/content`)
        .put(content)
        .then((response) => {
          resolve(response);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  formatEmbedURL(eTag = ''): string {
    const pattern = /{([0-9A-Fa-f-]+)}/;
    const match = eTag.match(pattern);

    if (match) {
      const extractedString = match[1]; // Extracting the desired string
      return this.getEmbedURL(extractedString);
    } else {
      console.log('Pattern not found in the input string.', eTag);
      return '';
    }
  }

  getEmbedURL(eTag: string): string {
    return `https://nophin.sharepoint.com/_layouts/15/Doc.aspx?sourcedoc={${eTag}}&action=embedview&wdAllowInteractivity=False&wdHideGridlines=True&wdHideHeaders=True&wdDownloadButton=True&wdInConfigurator=True&wdInConfigurator=True`;
  }

  getViewURL(eTag: string): string {
    return `https://nophin.sharepoint.com/:x:/g/${eTag}?e=B6h4X7&amp;action=embedview&amp;wdAr=1.7777777777777777&amp;wdAllowInteractivity=True&amp;wdHideHeaders=False&amp;wdDownloadButton=False&amp;AllowTyping=True`;
  }

  getETag(eTag: string) {
    const pattern = /{([0-9A-Fa-f-]+)}/;
    const match = eTag.match(pattern);

    if (match) {
      return match[1];
    }
    return '';
  }

  extractWorkbookMeta(uploadResponse: any) {
    const eTag = this.getETag(uploadResponse.eTag);
    return {
      downloadURL: uploadResponse['@microsoft.graph.downloadUrl'],
      eTag,
      id: uploadResponse.id,
      webURL: uploadResponse.webUrl,
      embedURL: this.getEmbedURL(eTag),
      viewURL: this.getViewURL(eTag),
    };
  }

  async combineSheetToMasterSheet(
    workbookId: string,
    masterWorkbookId: string,
  ) {
    const azureClient = await this.authenticateClient();

    try {
      const newWorkbook = await new Promise<{ value: Array<any> }>(
        (resolve, reject) => {
          azureClient
            .api(`/drive/items/${workbookId}/workbook/worksheets`)
            .headers(MICROSOFT_HEADERS)
            .get()
            .then(async (workbookSheetsResponse) => {
              resolve(workbookSheetsResponse);
            })
            .catch((error) => {
              reject(error);
              console.log(error);
            });
        },
      );

      for (const item of newWorkbook.value) {
        //Do not add raw sheets
        if (String(item.name).toLowerCase().includes('(raw)')) continue;
        try {
          await this.deleteSheetFromWorkbook(masterWorkbookId, item.name);
        } catch (error) {
          log(error);
        }
        const worksheetData = await new Promise<{ address: string }>(
          (resolve, reject) => {
            azureClient
              .api(
                `/drive/items/${workbookId}/workbook/worksheets('${item.name}')/usedRange`,
              )
              .headers(MICROSOFT_HEADERS)
              .get()
              .then(async (worksheetData) => {
                resolve(worksheetData);
              })
              .catch((error) => {
                console.log(error);
                reject(error);
              });
          },
        );

        const addWorksheetToMasterResponse = await new Promise(
          (resolve, reject) => {
            azureClient
              .api(`/drive/items/${masterWorkbookId}/workbook/worksheets/add`)
              .headers(MICROSOFT_HEADERS)
              .post({ name: item.name })
              .then(async (newSheetResponse) => {
                resolve(newSheetResponse);
              })
              .catch((error) => {
                console.log(error);
                reject(error);
              });
          },
        );
        await new Promise((resolve, reject) => {
          const sheetName: string = String(worksheetData?.address).split(
            '!',
          )[0];
          const sheetRange: string = String(worksheetData?.address).split(
            '!',
          )[1];
          azureClient
            .api(
              // newSheetResponse['@odata.id'],
              `/drive/items/${masterWorkbookId}/workbook/worksheets/${item.name}/range(address='${sheetRange}')`,
            )
            .headers(MICROSOFT_HEADERS)
            .patch(worksheetData)
            .then((res) => {
              resolve(res);
            })
            .catch((error) => {
              console.log(error);
              reject(error);
            });
        });
      }
    } catch (error) {
      console.log(error);
    }
  }

  async computeWorkbook() {
    const azureClient = await this.authenticateClient();
    // 01G72BT4F6Y2GOVW7725BZO354PWSELRRZ
    const res = await azureClient
      .api(
        `/drive/items/01G72BT4HPXRDPQGA7IJGZULXKMLTPRGZ5/workbook/application`,
      )
      .get()
      .then((res) => {
        console.log(res, 'RESPONSE');
      })
      .catch((error) => {
        console.log(error, 'ERROR2>>>>>');
      });
  }

  async createSharableLink1() {
    const azureClient = await this.authenticateClient();
    const res = await azureClient
      .api(`/drive/items/01G72BT4HPX0RDPQGA7IJGZ00ULXKMLTPRGZ5000/createLink`)
      .post({
        type: 'view',
        scope: 'anonymous',
      })
      .then((res) => {
        console.log(res, 'RESPONSE');
      })
      .catch((error) => {
        console.log(error, 'ERROR2>>>>>');
      });
  }

  async uploadRegular(url: string) {
    const token = await this.generateToken();

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
    });

    const url1 = `https://graph.microsoft.com/v1.0/drive/root:/basicdemofile.xlsm:/content`;
    const headers = new Headers();
    headers.append('Authorization', `Bearer ${token}`);
    headers.append(
      'Content-Type',
      `application/vnd.ms-excel.sheet.macroEnabled.12`,
    );

    const uploadResponse = await axios.put(url1, response.data, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/vnd.ms-excel.sheet.macroEnabled.12',
      },
    });

    console.log(uploadResponse.data);
  }

  async playground(fileId: string) {
    const azureClient = await this.authenticateClient();
    const token = await this.generateToken();

    const fileDataRes = await axios.get(fileId, {
      responseType: 'arraybuffer',
    });

    const upload = await this.uploadBufferToMSGraph(
      'somefilenamefordemo.xls',
      fileDataRes?.data,
    );

    return await this.getAFileUsedRange(
      upload?.uploadResponse?.id,
      'IRR Sheet Static',
    );

    const filePathUpload = 'somedemoFile9999921.xlsm';

    let res1;

    try {
      res1 = await axios.post(
        `https://graph.microsoft.com/v1.0/drive/root/children`,
        {
          name: filePathUpload,
          file: fileDataRes?.data,
          '@microsoft.graph.conflictBehavior': 'rename', // Specify the behavior in case of naming conflicts
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      // console.log(res1?.data, 'RESSSS1');
    } catch (error) {
      console.log(error?.response?.data, 'ERRRRRRRRR');
    }

    try {
      const res2 = await axios.put(
        `https://graph.microsoft.com/v1.0/drive/items/${res1?.data?.id}/content`,
        fileDataRes?.data,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/vnd.ms-excel.sheet.macroEnabled.12',
            // 'Content-Type':
            //   'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
        },
      );

      console.log(res2?.data, 'RES 222222222');
    } catch (error) {
      console.log(error?.response?.data, 'ERRORRRRR 2');
    }
    console.log('Before second tic');
    await new Promise((resolve, reject) => {
      setTimeout(() => resolve('Done'), 5000);
    });
    console.log('After second tic');
    try {
      const res3 = await axios.get(
        `https://graph.microsoft.com/v1.0/drive/items/${res1?.data?.id}/workbook/worksheets('Input')/usedRange`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );
      // console.log(res3?.data, 'RES 33333');
      return res3?.data;
    } catch (error) {
      console.log(error?.response?.data, 'ERROR333333');
    }

    return 'Hello';

    azureClient
      .api(`/drive/root/children`)
      .post({
        name: filePathUpload,
        file: fileDataRes?.data,
        '@microsoft.graph.conflictBehavior': 'rename', // Specify the behavior in case of naming conflicts
      })
      .then((uploadResponse) => {
        // console.log(uploadResponse, 'UPLOAD RESSSSS');
        azureClient
          .api(`/drive/items/${uploadResponse.id}/content`)
          .put(fileDataRes?.data)
          .then((data) => {
            console.log(data, 'DATASSSSS???????');
            console.log('File uploaded successfully.');
          })
          .catch((uploadError) => {
            console.error('Error uploading file:', uploadError);
          });
      })
      .catch((createError) => {
        console.error('Error creating file:', createError);
      });
    // };

    // const createSession = await axios.post(
    //   `https://graph.microsoft.com/v1.0/drive/items/${fileId}/workbook/createSession`,
    //   {
    //     persistChanges: false,
    //   },
    //   {
    //     headers: {
    //       Authorization: `Bearer ${token}`,
    //       'Content-Type': 'application/json',
    //     },
    //   },
    // );

    // const newToken = await this.generateToken();

    // console.log(createSession.data);

    // console.log(await this.getAFileUsedRange(fileId, 'Inputs'));

    // const newRes = await axios.get(
    //   `https://graph.microsoft.com/v1.0/drive/items/${fileId}/workbook/worksheets('Input')/usedRange`,
    //   {
    //     headers: {
    //       Authorization: `Bearer ${newToken}`,
    //       'Content-Type': 'application/json',
    //       // "workbook-session-id": "cluster=CH3&session=15.ZR1PEPF000007AE1.A70.1.V24.4817pvfRm4dx7v7GeJv%2bdNNt14.5.en-US5.en-US14.app%40sharepoint1.S1.N16.16.0.17720.4231514.5.en-US5.en-US1.V1.N0.1.S&usid=c249c899-2848-410e-82dd-b419e18b1df9'"
    //     },
    //   },
    // );
    // console.log(newRes.data);
    // const res = await azureClient
    //   .api(
    //     `drive/items/01G72BT4GM3Q7T4OZGQZH37BVZW5AYK5IM/workbook/createSession`,
    //   )
    //   .post({ persistChanges: false })
    //   .then((data) => {
    //     console.log(data, 'DATA');
    //   })
    //   .catch((error) => {
    //     console.log(error, 'ERROR');
    //   });
  }

  async getWorkbookSheets(id: string): Promise<MSGraphWorksheetNameI[]> {
    const azureClient = await this.authenticateClient();

    return await new Promise((resolve, reject) => {
      azureClient
        .api(`/drive/items/${id}/workbook/worksheets`)
        .get()
        .then((data) => {
          resolve(data?.value);
        })
        .catch((error) => {
          console.log(error);
          reject(error);
        });
    });
  }

  async getWorksheetStyles(id: string, sheetName: string, range: string) {
    const azureClient = await this.authenticateClient();

    return await new Promise((resolve, reject) => {
      azureClient
        .api(
          `/drive/items/${id}/workbook/worksheets/${sheetName}/range(address='${range}')/format`,
        )
        .get()
        .then((data) => {
          console.log(data);
          resolve(data);
        })
        .catch((error) => {
          console.log(error);
          reject(error);
        });
    });
  }

  async getWorksheetFont(id: string, sheetName: string, range: string) {
    const azureClient = await this.authenticateClient();

    return await new Promise((resolve, reject) => {
      azureClient
        .api(
          `/drive/items/${id}/workbook/worksheets/${sheetName}/range(address='${range}')/format/font`,
        )
        .get()
        .then((data) => {
          console.log(data);
          resolve(data);
        })
        .catch((error) => {
          console.log(error);
          reject(error);
        });
    });
  }

  async getWorksheetColor(id: string, sheetName: string, range: string) {
    const azureClient = await this.authenticateClient();

    return await new Promise((resolve, reject) => {
      azureClient
        .api(
          `/drive/items/${id}/workbook/worksheets/${sheetName}/range(address='${range}')/format?expand=fill,font`,
        )
        .get()
        .then((data) => {
          console.log(data);
          resolve(data);
        })
        .catch((error) => {
          console.log(error);
          reject(error);
        });
    });
  }

  async getWorksheetFormat(id: string, sheetName: string) {
    const azureClient = await this.authenticateClient();

    return await new Promise((resolve, reject) => {
      azureClient.api(`/drive/items/${id}/workbook/worksheets/${sheetName}/`);
    });
  }
  getSkippedRowsColumns(range: string) {
    const firstCell: string = range.split(':')[0];

    const match = firstCell.match(/([A-Z]+)(\d+)/);

    if (match) {
      const columnLetters = match[1];
      const rowNumber = parseInt(match[2], 10);

      let skippedColumns = 0;
      for (let i = 0; i < columnLetters.length; i++) {
        skippedColumns *= 26;
        skippedColumns += columnLetters.charCodeAt(i) - 'A'.charCodeAt(0) + 1;
      }
      skippedColumns--;

      const skippedRows = rowNumber - 1;

      return { skippedRows, skippedColumns };
    }

    return { skippedRows: 0, skippedColumns: 0 };
  }

  async getWorkbookComputedData(id: string) {
    // const azureClient = await this.authenticateClient();
    /**
     * THE WAIT HERE IS TO ENSURE THAT THAT THE UPLOADED EXCEL HAS
     * FINISHED PROCESING ON MICROSOFT GRAPH BEFORE READING THE DATA
     */
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const worksheets = await this.getWorkbookSheets(id);

    const data = [];

    for (const worksheet of worksheets) {
      const usedRange = await this.getAFileUsedRange(id, worksheet.name);
      const range = usedRange.address.split('!')[1];
      // const styles = await this.getWorksheetColor(id, worksheet.name, range);
      data.push({
        data: usedRange.values,
        sheetName: worksheet.name,
        range,
        skipped: this.getSkippedRowsColumns(range),
      });
    }
    return data;
  }

  async duplicateFile(
    id: string,
    data: {
      parentReference?: {
        id: string; // Optional
      };
      name: string;
    },
  ) {
    const azureClient = await this.authenticateClient();
    return await new Promise((resolve, reject) => {
      azureClient
        .api(`/drive/items/${id}/copy`)
        .post(data)
        .then((data) => {
          console.log(data, 'Duplicate reapon');
          resolve(data);
        })
        .catch((error) => {
          console.log(error);
          reject(error);
        });
    });
  }

  async uploadFromS3ToMSGraph(
    url: string,
    fileName: string,
  ): Promise<MSGraphUploadResponseI> {
    const fileBufferResponse = await axios.get(url, {
      responseType: 'arraybuffer',
    });

    const uploadResponse = await this.uploadBufferToMSGraph(
      fileName,
      fileBufferResponse?.data,
    );

    return uploadResponse;
  }
}
