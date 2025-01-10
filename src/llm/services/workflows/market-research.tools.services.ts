import { BadRequestException, Injectable } from '@nestjs/common';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { AgentState, ToolNode } from '@langchain/langgraph/prebuilt';
import { TavilySearchResults } from '@langchain/community/tools/tavily_search';
import { MailerService } from '@nestjs-modules/mailer';
import * as XLSX from 'xlsx';
import axios from 'axios';
import { OpenAI } from 'openai';
import { UtilitiesService } from 'src/utilities/services/utilities.service';
import { ChatOpenAI } from '@langchain/openai';
import { InjectRepository } from '@nestjs/typeorm';
import { Beachhead } from 'src/conversation/entities/beachhead.entity';
import { Repository } from 'typeorm';
import { ConversationService } from 'src/conversation/conversation.service';
import { S3Client } from '@aws-sdk/client-s3';
import markdown from 'markdown-it';
import puppeteer from 'puppeteer';
import { Upload } from '@aws-sdk/lib-storage';
import { Chart, registerables } from 'chart.js';
import { createCanvas, loadImage } from 'canvas';
import * as vega from 'vega';
import * as vegaLite from 'vega-lite';

Chart.register(...registerables);
@Injectable()
export class MarketResearchToolService {
  public tools: any;
  public toolNode: any;
  public bhTools: any;
  public bhToolNode: any;
  public model: any;
  public bhModel: any;

  constructor(
    private mailService: MailerService,
    private utilitiesService: UtilitiesService,

    @InjectRepository(Beachhead)
    private beachheadRepo: Repository<Beachhead>,
    private conversationService: ConversationService,
  ) {
    this.tools = [
      this.introductionTool(),
      this.conductMarketResearch(),
      this.createFileAttachment(),
      this.sendEmailToUsersBH(),
      new TavilySearchResults({
        apiKey: process.env.TAVILY_API_KEY,
      }),
      this.plotGraph(),
    ];

    this.toolNode = new ToolNode<AgentState>(this.tools);

    this.model = new ChatOpenAI({
      model: 'gpt-4o',
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY,
    }).bindTools(this.tools);
  }

  introductionTool() {
    return tool(
      async ({}) => {
        return `This is your personal identity.
        
          Your name is CRESA, an agent who helps Commercial Real Estate (CRE) investors screen deals. You can screen deals, analyze documents, generate investment memos, and research. You may be asked to introduce yourself and describe your capabilities, limitations, and use cases to help users. 
          
          After introducing yourself, ask the user if they want to perform any of the following workflows. 
          1. Deal Screening 
          2. Document analysis 
          3. Generate investment memo
        `;
      },
      {
        name: 'introduction',
        description:
          'This is your personal Identity. Greet the user when they say hello, hi or any salutation',
      },
    );
  }

  createFileAttachment() {
    return tool(
      async ({ data, format, filename }) => {
        const parsedData =
          typeof data !== 'string' ? JSON.stringify(data) : data;
        return `Return file attachment data ${parsedData}, format: ${format} and filename: ${filename}`;
      },
      {
        name: 'create_attachment',
        description:
          'Get attachment format and markdown content, including filename and return the result to the send_email_to_user tool.',
        schema: z.object({
          data: z
            .any()
            .describe(
              'Markdown content or array of data to be converted to a PDF/Excel attachment',
            ),
          format: z
            .enum(['excel', 'pdf'])
            .describe('The format of the attachment'),
          filename: z
            .string()
            .describe('The name of the file (without extension)'),
        }),
      },
    );
  }

  plotGraph() {
    return tool(
      async ({ data, chartType, title, xLabel, yLabel }) => {
        try {
          console.log('Plotting graph with data:', data);

          if (!Array.isArray(data) || data.length === 0) {
            throw new Error('Invalid data format. Expected non-empty array.');
          }

          let spec: any = {
            $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
            width: 400,
            height: 300,
            padding: { left: 20, top: 20, right: 20, bottom: 20 },
            title: { text: title || 'Chart', fontSize: 16, font: 'sans-serif' },
            data: { values: data },
            config: {
              axis: {
                labelFont: 'sans-serif',
                titleFont: 'sans-serif',
                labelFontSize: 12,
                titleFontSize: 14,
              },
              legend: {
                labelFont: 'sans-serif',
                titleFont: 'sans-serif',
                labelFontSize: 12,
                titleFontSize: 14,
              },
            },
          };

          switch (chartType) {
            case 'pie':
            case 'donut':
              spec = {
                ...spec,
                mark: {
                  type: 'arc',
                  innerRadius: chartType === 'donut' ? 50 : 0,
                },
                encoding: {
                  theta: { field: 'y', type: 'quantitative' },
                  color: {
                    field: 'x',
                    type: 'nominal',
                    legend: { title: null },
                  },
                },
              };
              break;
            case 'line':
              spec = {
                ...spec,
                mark: { type: 'line', strokeWidth: 2 },
                encoding: {
                  x: {
                    field: 'x',
                    type: 'nominal',
                    axis: { title: xLabel || 'X Axis', labelAngle: -45 },
                  },
                  y: {
                    field: 'y',
                    type: 'quantitative',
                    axis: { title: yLabel || 'Y Axis' },
                  },
                },
              };
              break;
            case 'area':
              spec = {
                ...spec,
                mark: { type: 'area' },
                encoding: {
                  x: {
                    field: 'x',
                    type: 'nominal',
                    axis: { title: xLabel || 'X Axis', labelAngle: -45 },
                  },
                  y: {
                    field: 'y',
                    type: 'quantitative',
                    axis: { title: yLabel || 'Y Axis' },
                  },
                },
              };
              break;
            case 'scatter':
              spec = {
                ...spec,
                mark: { type: 'point' },
                encoding: {
                  x: {
                    field: 'x',
                    type: 'quantitative',
                    axis: { title: xLabel || 'X Axis' },
                  },
                  y: {
                    field: 'y',
                    type: 'quantitative',
                    axis: { title: yLabel || 'Y Axis' },
                  },
                },
              };
              break;
            case 'heatmap':
              spec = {
                ...spec,
                mark: 'rect',
                encoding: {
                  x: {
                    field: 'x',
                    type: 'nominal',
                    axis: { title: xLabel || 'X Axis', labelAngle: -45 },
                  },
                  y: {
                    field: 'y',
                    type: 'nominal',
                    axis: { title: yLabel || 'Y Axis' },
                  },
                  color: {
                    field: 'value',
                    type: 'quantitative',
                    scale: { scheme: 'viridis' },
                    legend: { title: 'Value' },
                  },
                },
              };
              break;
            default: // bar chart as default
              spec = {
                ...spec,
                mark: { type: 'bar' },
                encoding: {
                  x: {
                    field: 'x',
                    type: 'nominal',
                    axis: { title: xLabel || 'X Axis', labelAngle: -45 },
                  },
                  y: {
                    field: 'y',
                    type: 'quantitative',
                    axis: { title: yLabel || 'Y Axis' },
                  },
                  color: {
                    field: 'x',
                    type: 'nominal',
                    legend: null,
                  },
                },
              };
          }
          const vegaSpec = vegaLite.compile(spec).spec;
          const view = new vega.View(vega.parse(vegaSpec), {
            renderer: 'none',
          });
          const svg = await view.toSVG();

          const canvasWidth = 650;
          const canvasHeight = 450;
          const canvas = createCanvas(canvasWidth, canvasHeight);
          const ctx = canvas.getContext('2d');

          // Fill the background with white
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvasWidth, canvasHeight);

          const img = await loadImage(
            `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
          );

          // Calculate scaling factor to fit the image within the canvas
          const scale = Math.min(
            canvasWidth / img.width,
            canvasHeight / img.height,
          );
          const x = (canvasWidth - img.width * scale) / 2;
          const y = (canvasHeight - img.height * scale) / 2;

          ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

          const buffer = canvas.toBuffer('image/png');
          const filename = `graph_${Date.now()}.png`;
          const fileUrl = await this.saveBufferToStorage(buffer, filename);

          console.log(fileUrl, 'fileUrl');

          return `Graph generated successfully. Here's the graph:

![${title || 'Chart'}](${fileUrl})

You can reference this graph as ${filename}.`;
        } catch (error) {
          console.error('Error generating graph:', error);
          return `Failed to generate graph: ${error.message}`;
        }
      },
      {
        name: 'plot_graph',
        description: 'Plot a graph based on the provided data and chart type.',
        schema: z.object({
          data: z
            .array(
              z.object({
                x: z.union([z.string(), z.number()]),
                y: z.number(),
              }),
            )
            .describe('Array of data points with x and y values'),
          chartType: z
            .string()
            .optional()
            .describe('Type of chart to plot (e.g., "bar", "line", "scatter")'),
          title: z.string().optional().describe('Title of the graph'),
          xLabel: z.string().optional().describe('Label for the x-axis'),
          yLabel: z.string().optional().describe('Label for the y-axis'),
        }),
      },
    );
  }

  conductMarketResearch() {
    return tool(
      async ({ address, conversationId }) => {
        console.log(address, 'address');
        console.log(conversationId, 'conversationId');
        try {
          const rentCompsData = await this.fetchRentCastData(address);

          const relevantData = {
            rentComps: rentCompsData.rentComps,
            marketData: rentCompsData.marketData,
            helloDataComps:
              rentCompsData?.helloDataProperty?.comparables || null,
          };

          await this.conversationService.updateConversation(conversationId, {
            data: rentCompsData,
          });

          const systemMessage = `You have access to the following RentCast data as reference. Use this information to inform your responses:
          ${this.truncateJsonString(
            JSON.stringify(relevantData, null, 2),
            1028576,
          )}

          
          Given the rent comps data, generate a detailed and well structed rent comps report for the following address ${address}.
      
          Also search for related properties on Zillow and Apartments.com and do a detailed comparism.
          
          Return data for:
          - Market rent for 1, 2, 3 bedrooms and also studio apartment.
          - Average, min and max rent
          - Rent trends over the last 3, 6 and 12 months for 1, 2, 3 bedrooms
          - Links to available 1,2,3 bedroom units on the market is available
          - If avaialble, return Zestimate from Zillow
          - If available, return estimates from Apartments.com


          If HelloData is available, also include but DO NOT REVEAL Hello Data as the data source, instead you could call this Apartment Comps:
          - Property details such as year built, number of units, and property type
          - Recent sales history if available
          - Comparable properties in the area with their details
          - Any additional market insights or trends from the HelloData API

          DO NOT REVEAL Hello Data OR RentCast as the data source.

          This should be a text based data and not tabular data.

          Only conduct market research, DO NOT generate investment memo.
          `;

          return systemMessage;
        } catch (error) {
          console.error('Error in conductMarketResearch:', error);
          return `An error occurred while conducting market research: ${error.message}`;
        }
      },
      {
        name: 'conduct_market_research',
        description:
          'Used to get rent comps for a given adddress. This should only call the conduct_market_research and not call the investment_memo tool. The user MUST to provide an address. DO NOT ASSUME ANY ADDRESS. ALWAYS ASK THE USER TO PROVIDE AN ADDRESS BEFORE CONTINUING',
        schema: z.object({
          address: z
            .string()
            .describe(
              'The address to get rent comps for. The user MUST to provide an address. DO NOT ASSUME ANY ADDRESS. ALWAYS ASK THE USER TO PROVIDE AN ADDRESS BEFORE CONTINUING',
            ),
          conversationId: z
            .number()
            .describe('The id of the current conversation'),
        }),
      },
    );
  }

  private containsMarkdownTable(str: string): boolean {
    const tableRegex = /\|(.+)\|\n\|(?:[-:]+\|)+\n((?:\|.+\|\n)+)/;
    return tableRegex.test(str);
  }

  private async createExcelAttachment(data: any) {
    const workbook = XLSX.utils.book_new();

    console.log('Inside create excel attachment function>>>>>>>>>>>>');
    if (typeof data === 'string') {
      const isMarkDownData = this.containsMarkdownTable(data);

      if (!isMarkDownData) {
        data = JSON.parse(data);
      }
    }

    console.log(data, 'data');
    console.log(typeof data, 'type of data');

    try {
      if (typeof data === 'string') {
        console.log('Handle string input (markdown tables)');
        // Handle string input (markdown tables)
        const tables = this.extractTablesFromMarkdown(data);

        if (tables.length > 0) {
          tables.forEach((table, index) => {
            const formattedData = this.formatData(table.headers, table.rows);
            this.addWorksheet(workbook, formattedData, `Table ${index + 1}`);
          });
        }
      } else if (
        Array.isArray(data) &&
        data.length > 0 &&
        Array.isArray(data[0])
      ) {
        // Handle 2D array input
        const headers = data[0];
        const rows = data.slice(1);
        const formattedData = this.formatData(headers, rows);
        this.addWorksheet(workbook, formattedData, 'Sheet1');
      } else if (
        Array.isArray(data) &&
        data.length > 0 &&
        typeof data[0] === 'object'
      ) {
        // Handle array of objects
        const headers = Object.keys(data[0]);
        const rows = data.map((obj) => headers.map((header) => obj[header]));
        const formattedData = this.formatData(headers, rows);
        this.addWorksheet(workbook, formattedData, 'Sheet1');
      } else if (typeof data === 'object' && data !== null) {
        // Handle TableData format
        this.addTableDataWorksheets(workbook, data);
      } else {
        console.log('Invalid data format');
        return null;
      }

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      console.log(
        'Excel file created successfully. Buffer size:',
        buffer.length,
      );

      return buffer;
    } catch (error) {
      console.error('Error creating Excel attachment:', error);
      throw error;
    }
  }

  private addTableDataWorksheets(workbook: XLSX.WorkBook, data) {
    // Add Comparables worksheet
    const comparablesData = this.prepareComparablesData(data);
    this.addWorksheet(
      workbook,
      comparablesData.content,
      comparablesData.heading,
    );

    // Add Historical Data worksheet
    const historicalData = this.prepareHistoricalData(data);
    this.addWorksheet(workbook, historicalData.content, historicalData.heading);

    // Add Rent Trends worksheet
    const rentTrendsData = this.prepareRentTrendsData(data);
    this.addWorksheet(workbook, rentTrendsData.content, rentTrendsData.heading);
  }

  private prepareComparablesData(data: any) {
    const headers = [
      'Address',
      'Property Type',
      'Price',
      'Bedrooms',
      'Bathrooms',
      'Sq Ft',
      'Year Built',
      'Distance',
    ];
    const rows =
      data.rentComps?.comparables?.map((comp) => [
        comp.formattedAddress || 'N/A',
        comp.propertyType || 'N/A',
        this.formatNumberToCurrency(comp.price || 0),
        comp.bedrooms || 'N/A',
        comp.bathrooms || 'N/A',
        comp.squareFootage || 'N/A',
        comp.yearBuilt || 'N/A',
        comp.distance || 'N/A',
      ]) || [];

    return {
      heading: 'Comparables',
      content: this.formatData(headers, rows),
    };
  }

  private prepareHistoricalData(data) {
    const headers = [
      'Date',
      'Avg Rent',
      'Min Rent',
      'Max Rent',
      'Total Listings',
    ];
    const historyEntries = Object.entries(
      data.marketData?.rentalData?.history || {},
    ).slice(-12);
    const rows = historyEntries.map(([date, info]: any) => [
      date,
      this.formatNumberToCurrency(info?.averageRent || 0),
      this.formatNumberToCurrency(info?.minRent || 0),
      this.formatNumberToCurrency(info?.maxRent || 0),
      info?.totalListings,
    ]);

    return {
      heading: 'Historical Data',
      content: this.formatData(headers, rows),
    };
  }

  private prepareRentTrendsData(data: any) {
    const headers = ['Period', 'Bedrooms', 'Avg Rent', 'Min Rent', 'Max Rent'];
    const trendPeriods = [3, 6, 9, 12];
    const bedroomCounts = [0, 1, 2, 3, 4];
    const rows: Array<Array<string | number>> = [];

    trendPeriods.forEach((period) => {
      bedroomCounts.forEach((bedrooms) => {
        const relevantMonths = Object.entries(
          data.marketData?.rentalData?.history || {},
        ).slice(-period);
        const rentData = relevantMonths.flatMap(
          ([_, monthData]: any) =>
            monthData?.dataByBedrooms?.find(
              (bed) => bed.bedrooms === bedrooms,
            ) || [],
        );

        if (rentData.length > 0) {
          const avgRent =
            rentData.reduce((sum, month) => sum + (month.averageRent || 0), 0) /
            rentData.length;
          const minRent = Math.min(
            ...rentData.map((month) => month.minRent || Infinity),
          );
          const maxRent = Math.max(
            ...rentData.map((month) => month.maxRent || -Infinity),
          );

          rows.push([
            `${period} months`,
            bedrooms === 0 ? 'Studio' : bedrooms,
            this.formatNumberToCurrency(avgRent),
            this.formatNumberToCurrency(minRent),
            this.formatNumberToCurrency(maxRent),
          ]);
        }
      });
    });

    return {
      heading: 'Rent Trends',
      content: this.formatData(headers, rows),
    };
  }

  private formatNumberToCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  }

  private addWorksheet(
    workbook: XLSX.WorkBook,
    data: string[][],
    sheetName: string,
  ) {
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Apply styles to headers
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_cell({ r: 0, c: C });
      if (!worksheet[address]) continue;
      worksheet[address].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: 'FFFF00' } },
        alignment: { horizontal: 'center' },
      };
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }

  private formatData(
    headers: string[],
    rows: Array<Array<string | number>>,
  ): string[][] {
    return [headers, ...rows.map((row) => row.map((cell) => String(cell)))];
  }

  private async createPDFAttachment(markdownContent: string): Promise<Buffer> {
    const md = new markdown();
    const htmlContent = md.render(markdownContent);

    const isAWS = process.env.NODE_ENV === 'production';

    const launchOptions = isAWS
      ? {
          executablePath: '/usr/bin/google-chrome-stable',
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        }
      : {};

    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    // Set the content and wait for network idle to ensure all resources are loaded
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
    });

    await browser.close();

    return Buffer.from(pdfBuffer);
  }

  private extractTablesFromMarkdown(
    markdown: string,
  ): Array<{ headers: string[]; rows: string[][] }> {
    const tables = [];
    const tableRegex = /\|(.+)\|\n\|(?:[-:]+\|)+\n((?:\|.+\|\n)+)/g;
    let match;

    while ((match = tableRegex.exec(markdown)) !== null) {
      const headers = match[1]
        .split('|')
        .map((header) => header.trim())
        .filter(Boolean);
      const rows = match[2]
        .trim()
        .split('\n')
        .map((row) =>
          row
            .split('|')
            .map((cell) => cell.trim())
            .filter(Boolean),
        );
      tables.push({ headers, rows });
    }

    return tables;
  }

  private cleanedFileName(filename: string) {
    const parts = filename.split('.');
    const namePart = parts.slice(0, -1).join('.');
    const extensionPart = parts[parts.length - 1];
    const cleanedName = namePart.replace(/[^a-zA-Z0-9]/g, '');

    return `${cleanedName}.${extensionPart}`;
  }

  private async saveBufferToStorage(
    buffer: Buffer,
    filename: string,
  ): Promise<string> {
    const s3Client = new S3Client({
      region: process.env.AWS_DEFAULT_REGION,
      credentials: {
        accessKeyId: process.env.AWS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET,
      },
    });

    try {
      const resp = new Upload({
        client: s3Client,
        params: {
          Body: buffer,
          Bucket: process.env.EXTRACTION_S3_BUCKET,
          Key: `deals/input/${
            1000 + Math.floor(Math.random() * 9999)
          }${this.cleanedFileName(filename)}`,
          ACL: 'public-read',
          ContentDisposition: 'inline',
          ContentType: 'image/png',
        },
      });

      // AWAIT RESPONSE FROM S3
      const data = await resp.done();

      return data?.Location;
    } catch (error) {
      console.log(error, 'Error Uploaded to S3');
    }
  }

  private async fetchRentCastData(address: string) {
    console.log(`Fetching rent comps data for ${address}`);

    const headers = {
      'x-api-key': process.env.RENT_CAST_API_KEY,
      accept: 'application/json',
    };

    const headersHelloData = {
      'x-api-key': process.env.HELLO_DATA_API_KEY,
      accept: 'application/json',
    };

    // Fetch Google Geocoding data
    const { geometry, formatted_address, postalCode } =
      await this.getGoogleGeocodingData(address);

    // Fetch property data concurrently
    const [propertyDataResponse, helloDataRes] = await Promise.all([
      this.fetchPropertyData(address, headers),
      this.fetchHelloDataProperty(
        geometry,
        formatted_address,
        postalCode,
        headersHelloData,
      ),
    ]);

    // Process HelloData if available
    const helloDataProperty =
      helloDataRes && helloDataRes?.length
        ? await this.processHelloData(
            helloDataRes,
            formatted_address,
            headersHelloData,
          )
        : null;

    // Fetch rent comps and market data
    const { rentCompsResponse, marketDataResponse } =
      await this.fetchRentCompsAndMarketData(
        propertyDataResponse,
        address,
        geometry,
        postalCode,
        headers,
      );

    return {
      rentComps: rentCompsResponse?.data,
      propertyData: propertyDataResponse ? propertyDataResponse.data : '',
      marketData: marketDataResponse?.data,
      helloDataProperty,
    };
  }

  private async getGoogleGeocodingData(address: string) {
    const encodedAddress = encodeURIComponent(address);
    const googleURL = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${process.env.GOOGLE_API_KEY}`;
    const { data } = await axios.get(googleURL);

    const geometry = data?.results[0]?.geometry?.location;
    const formatted_address = data?.results[0]?.formatted_address;
    const postalCode = data?.results[0]?.address_components?.find((component) =>
      component.types.includes('postal_code'),
    );
    return { geometry, formatted_address, postalCode };
  }

  private async fetchPropertyData(address: string, headers: any) {
    const propertyDataURL = `${process.env.RENT_CAST_BASE_URL}/properties?address=${address}`;
    try {
      return await axios.get(propertyDataURL, { headers });
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log('Property data not found, continuing with null value');
        return null;
      }
      throw error;
    }
  }

  private async fetchHelloDataProperty(
    geometry: any,
    formatted_address: string,
    postalCode: any,
    headers: any,
  ) {
    const helloDataPropertyURL = `${process.env.HELLO_DATA_API_URL}/property/search?lat=${geometry?.lat}&lon=${geometry?.lng}&q=${formatted_address}&zip_code=${postalCode.long_name}`;
    const res = await axios.get(helloDataPropertyURL, { headers });
    return res?.data;
  }

  private truncateJsonString(jsonString: string, maxLength: number): string {
    if (jsonString.length <= maxLength) {
      return jsonString;
    }

    const truncatedString = jsonString.slice(0, maxLength - 3) + '...';
    let bracketCount = 0;
    let lastValidIndex = truncatedString.length - 1;

    for (let i = truncatedString.length - 1; i >= 0; i--) {
      if (truncatedString[i] === '}' || truncatedString[i] === ']') {
        bracketCount++;
      } else if (truncatedString[i] === '{' || truncatedString[i] === '[') {
        bracketCount--;
      }

      if (bracketCount === 0) {
        lastValidIndex = i;
        break;
      }
    }

    return truncatedString.slice(0, lastValidIndex + 1);
  }

  private normalizeAddress(address: string) {
    return address
      .toLowerCase()
      .replace(/,/g, '')
      .replace(/\b(st\.?|street)\b/gi, 'street')
      .replace(/\b(ave\.?|avenue)\b/gi, 'avenue')
      .replace(/\b(blvd\.?|boulevard)\b/gi, 'boulevard')
      .replace(/\b(rd\.?|road)\b/gi, 'road')
      .replace(/\b(dr\.?|drive)\b/gi, 'drive')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isAddressSimilar(address1: string, address2: string) {
    const normalizedAddress1 = this.normalizeAddress(address1);
    const normalizedAddress2 = this.normalizeAddress(address2);

    // Check if one address contains the other (in either direction)
    return (
      normalizedAddress1.includes(normalizedAddress2) ||
      normalizedAddress2.includes(normalizedAddress1)
    );
  }

  private async processHelloData(
    helloDataRes: any,
    formatted_address: string,
    headers: any,
  ) {
    if (
      helloDataRes?.length === 1 &&
      this.isAddressSimilar(formatted_address, helloDataRes[0]?.street_address)
    ) {
      console.log('Processing started >>>>>>>');
      const propertyDetails = await this.fetchPropertyDetails(
        helloDataRes[0]?.id,
        headers,
      );
      const comparables = await this.fetchComparables(propertyDetails, headers);
      return { propertyDetails, comparables };
    }
    return null;
  }

  private async fetchPropertyDetails(id: string, headers: any) {
    const url = `${process.env.HELLO_DATA_API_URL}/property/${id}`;
    const response = await axios.get(url, { headers });
    return response?.data;
  }

  private async fetchComparables(propertyDetails: any, headers: any) {
    const url = `${process.env.HELLO_DATA_API_URL}/property/comparables`;
    const config = {
      method: 'post',
      url,
      headers,
      data: { subject: propertyDetails },
    };
    const response = await axios(config);
    return response?.data;
  }

  private async fetchRentCompsAndMarketData(
    propertyDataResponse: any,
    address: string,
    geometry: any,
    postalCode: any,
    headers: any,
  ) {
    let rentCompsURL: string, marketDataURL: string;

    if (propertyDataResponse) {
      const zipCode = propertyDataResponse.data[0].zipCode;
      rentCompsURL = `${
        process.env.RENT_CAST_BASE_URL
      }/avm/rent/long-term?address=${encodeURIComponent(address)}`;
      marketDataURL = `${process.env.RENT_CAST_BASE_URL}/markets?zipCode=${zipCode}`;
    } else {
      if (!geometry || !postalCode) {
        throw new BadRequestException(
          'Unable to find location data for the given address',
        );
      }
      rentCompsURL = `${process.env.RENT_CAST_BASE_URL}/avm/rent/long-term?latitude=${geometry.lat}&longitude=${geometry.lng}`;
      marketDataURL = `${process.env.RENT_CAST_BASE_URL}/markets?zipCode=${postalCode.long_name}`;
    }

    const [rentCompsResponse, marketDataResponse] = await Promise.all([
      axios.get(rentCompsURL, { headers }),
      axios.get(marketDataURL, { headers }),
    ]);

    return { rentCompsResponse, marketDataResponse };
  }

  sendEmailToUsersBH() {
    return tool(
      async ({
        usersEmail,
        subject,
        body,
        conversationId,
        format,
        markdownContent,
        filename,
      }) => {
        let buffer: Buffer;
        let contentType: string;

        const emailOptions: any = {
          to: usersEmail,
          subject: subject,
          html: body,
        };

        try {
          if (markdownContent) {
            const cleanedFilename =
              this.utilitiesService.cleanedFileName(filename);
            const fileExtension = format === 'excel' ? '.xlsx' : '.pdf';
            const fullFilename = `${cleanedFilename}${fileExtension}`;

            console.log(typeof markdownContent, 'markdownContent type');
            console.log(markdownContent, 'markdownContent');

            if (format === 'excel') {
              console.log('Creating Excel attachment');
              // markdownContent = JSON.parse(markdownContent);
              buffer = await this.createExcelAttachment(markdownContent);
              contentType =
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            } else if (format === 'pdf') {
              console.log('Creating PDF attachment');
              markdownContent = String(markdownContent);
              buffer = await this.createPDFAttachment(markdownContent);
              contentType = 'application/pdf';
            }

            console.log(
              `Attachment created: ${fullFilename}, size: ${buffer.length} bytes`,
            );

            emailOptions.attachments = [
              {
                filename: fullFilename,
                content: buffer,
                contentType,
              },
            ];
          }

          console.log(
            'Sending email with options:',
            JSON.stringify(
              {
                ...emailOptions,
                attachments: emailOptions.attachments
                  ? [
                      {
                        ...emailOptions.attachments[0],
                        content: 'BUFFERCONTENT',
                      },
                    ]
                  : undefined,
              },
              null,
              2,
            ),
          );

          await this.mailService.sendMail(emailOptions);

          const conversation = await this.beachheadRepo.findOne({
            where: { conversationId },
          });

          if (conversation) {
            console.log('Starting to delete record');
            await this.beachheadRepo.delete({
              conversationId: conversation.conversationId,
            });
            console.log('Deleted record');
            const newConvo = this.beachheadRepo.create({
              ...conversation,
              email: usersEmail,
            });
            await this.beachheadRepo.save(newConvo);

            console.log('Created new record');
          }

          return `Email has been sent successfully.`;
        } catch (error) {
          console.error('Error in sendEmailToUsersBH:', error);
          if (error.response) {
            console.error('Error response:', error.response.body);
          }
          throw new Error(`Failed to send email: ${error.message}`);
        }
      },
      {
        name: 'send_email_to_user',
        // description:
        //   'Sends an email using the provided parameters. Can include a PDF or Excel attachment but might be optional. The users must provide an email address to send to, if not you have to ask them to provide an email. DO NOT send any email if the user doesnt provide you an email address. Also DO NOT send more than 1 email at once even if the user asks for it. Format the email body as HTML. Always use Cresa, Your AI Analyst in the email signature.',
        description:
          'Sends an email using the provided parameters. Can include a PDF or Excel attachment (optional). IMPORTANT: 1) Always ask the user for an email address if not provided. 2) DO NOT send any email without a user-provided email address. 3) Send only one email per request, even if asked for multiple. 4) Always sign with "Cresa, Your AI Analyst". 5) Confirm content and recipient before sending. 6) Format the email body as HTML with proper styling. 7) If no attachment format is specified, use HTML formatting.',
        schema: z.object({
          usersEmail: z
            .string()
            .describe('The email of the user the email is to be sent to'),
          subject: z.string().describe('The subject of the email.'),
          body: z.string().describe('The body/content of the email'),
          conversationId: z
            .string()
            .describe('The current conversation conversationId'),
          markdownContent: z
            .any()
            .optional()
            .describe(
              'Markdown content or data array to be converted to email attachment.',
            ),
          format: z
            .string()
            .optional()
            .describe(
              'Type of the attachement to be included in the email. It could be either excl or pdf',
            ),
          filename: z
            .string()
            .optional()
            .describe('The name of the file attachement.'),
        }),
      },
    );
  }
}
