import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
// import { ChatOpenAI } from '@langchain/openai';
import { StateGraph, StateGraphArgs } from '@langchain/langgraph';
import { MemorySaver } from '@langchain/langgraph';
import { Injectable, Logger } from '@nestjs/common';
import { AgentToolService } from './agent.tools.service';
import { v4 } from 'uuid';
import { CresaFileI } from '../interfaces/cresa.interface';
import { ConversationService } from 'src/conversation/conversation.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Conversation } from 'src/conversation/entities/conversation.entity';
import { Repository } from 'typeorm';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { Document } from 'src/document/entities/document.entity';
import { DocumentStatusENUM } from 'src/utilities/constants';
import { DocumentService } from 'src/document/services/document.service';
import { ZepService } from './zep.service';
import { UserService } from 'src/user/services/user.service';
import axios from 'axios';
import OpenAI from 'openai';
import * as fs from 'fs';

interface AgentState {
  messages: BaseMessage[];
}

const graphState: StateGraphArgs<AgentState>['channels'] = {
  messages: {
    reducer: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
  },
};

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private checkpointer: MemorySaver;

  constructor(
    private agentToolService: AgentToolService,
    private conversationService: ConversationService,
    private documentService: DocumentService,
    @InjectRepository(Conversation)
    private conversationRepo: Repository<Conversation>,
    @InjectRepository(Document)
    private documentRepo: Repository<Document>,
    private zepService: ZepService,
    private userService: UserService,
  ) {
    this.checkpointer = new MemorySaver();
  }

  getWorkFlowApp() {
    const workflow = new StateGraph<AgentState>({ channels: graphState })
      .addNode('agent', this.callModel)
      .addNode('tools', this.agentToolService.toolNode)
      .addEdge('__start__', 'agent')
      .addConditionalEdges('agent', this.shouldContinue)
      .addEdge('tools', 'agent');
    return workflow.compile({ checkpointer: this.checkpointer });
  }

  shouldContinue(state: AgentState) {
    const messages = state.messages;
    const lastMessage = messages[messages.length - 1] as AIMessage;

    // If the LLM makes a tool call, then we route to the "tools" node
    if (lastMessage.tool_calls?.length) {
      return 'tools';
    }
    // Otherwise, we stop (reply to the user)
    return '__end__';
  }

  private async callModel(
    state: AgentState,
  ): Promise<{ messages: BaseMessage[] }> {
    const messages = state.messages;
    const query = messages[messages.length - 1].content;

    const model = this.agentToolService.model;

    // Generate the main response
    const response = await model.invoke(messages);

    let scratchPad = null;

    // Regular expression to detect Markdown table syntax
    const tableRegex =
      /\|\s*(.+?)\s*\|\s*(.+?)\s*\|\n\|\s*[-:]+\s*\|\s*[-:]+\s*\|\n\|\s*(.+?)\s*\|\s*(.+?)\s*\|/s;
    const containsMarkdownTable = tableRegex.test(response.content);

    if (containsMarkdownTable) {
      const toolNode = this.agentToolService.toolNode;

      // Generate scratch pad data if needed
      const scratchPadResult = await toolNode.generateScratchPadData().call({
        query,
        summary: response.content,
      });

      try {
        scratchPad = JSON.parse(scratchPadResult);
      } catch (e) {
        console.log(e, 'Error when generating scratch pad data');
      }
    }

    const aiMessage = new AIMessage({
      content: response.content,
      additional_kwargs: scratchPad ? { scratchPad } : {},
    });

    return { messages: [aiMessage] };
  }

  generateTableData(summary: string) {
    function parseMarkdownTable(markdownTable: string): any {
      const lines = markdownTable.trim().split('\n');
      const headers = lines[0]
        .split('|')
        .map((header) => header.trim())
        .filter(Boolean);
      const rows = lines.slice(2).map((row) =>
        row
          .split('|')
          .map((cell) => cell.trim())
          .filter(Boolean),
      );

      return { headers, rows };
    }

    const tableRegex =
      /\|\s*(.+?)\s*\|\s*(.+?)\s*\|\n\|\s*[-:]+\s*\|\s*[-:]+\s*\|\n([\s\S]*?)\n\n/s;
    const match = tableRegex.exec(summary);

    if (match) {
      const markdownTable = match[0];
      const tableData = parseMarkdownTable(markdownTable);
      return JSON.stringify({ type: 'table', content: tableData });
    }

    return null;
  }

  async predictDocumentType(url: string, fileName: string) {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
      });
      const fileContent = response.data;

      let text = '';
      if (String(url).endsWith('.pdf')) {
        text = await this.agentToolService.extractTextFromPdf(fileContent);
      } else if (
        String(url).endsWith('.xlsx') ||
        String(url).endsWith('.xls') ||
        String(url).endsWith('.xlsm') ||
        String(url).endsWith('.xlsb')
      ) {
        text = this.agentToolService.extractTextFromExcel(fileContent);
      } else {
        return 'Unsupported document format.';
      }

      // Pass the extracted text to GPT for analysis
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const prompt = `Analyze the following text and determine the type of CRE document. Focus on distinguishing between Rent Roll, T12, OM, CoStar Report, and other document types:

      ${text.slice(0, 2000)}

      Document name: ${fileName}
      
      Use these guidelines to classify the document:
      1. RENT_ROLL: 'rent-roll'
         - Contains detailed tenant information (e.g., unit numbers, tenant names, lease terms)
         - Lists current rent amounts for each unit
         - May include lease start/end dates and unit sizes
      2. T12: 'trailing-12'
         - Shows monthly financial data for the past 12 months
         - Typically includes income and expense categories
         - May have totals or averages for the 12-month period
      3. OM: 'offering-memorandum'
         - Comprehensive property overview
         - Includes market analysis, financial projections, and property details
      4. COSTAR: 'costar'
         - Detailed market analysis report
         - Contains comparable properties and market trends
      5. OTHERS: 'others'
         - Acquisition models or other complex documents
         - May contain rent roll or T12 data but is not exclusively one of these
         - Includes any document that doesn't clearly fit the above categories

      Important: 
      - A document should only be classified as 'rent-roll' or 'trailing-12' if it's primarily focused on that data.
      - If the document is an acquisition model or a complex financial model that includes rent roll or T12 data along with other significant information, classify it as 'others'.

      Return the result as a single word: rent-roll, trailing-12, offering-memorandum, costar, or others.
      `;

      const aiResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      if (!aiResponse.choices || aiResponse.choices.length === 0) {
        throw new Error('No response from the AI');
      }

      const responseText = aiResponse.choices[0].message.content;

      // Format the response for CustomOutputParser
      return responseText;
    } catch (error) {
      return `Failed to identify the document type: ${error.message}`;
    }
  }

  async generateConversationIntent(
    query: string,
    conversationHistory: string[],
  ) {
    const intents = [
      'deal screening',
      'document analysis',
      'generate investment memo',
      'conduct market research',
      'document summarizer',
    ];

    const filteredHistory = conversationHistory.filter((msg) => {
      if (msg.startsWith('assistant:')) {
        const content = msg.substring('assistant:'.length).trim();
        return !(
          content
            .toLowerCase()
            .startsWith(
              "i'm sorry, but i don't recognize the current workflow",
            ) ||
          content.toLowerCase().startsWith('i understand you want to start')
        );
      }
      return true;
    });

    const prompt = `Given the following intents:
      ${intents.join(', ')},
      
      User's query: "${query}" and
      
      Conversation history:
      ${filteredHistory.join('\n')}
      
      Analyze the conversation flow and determine the intent of this conversation. 
      Consider the following guidelines:
      1. If the conversation has a clear, established intent, maintain it unless there's a direct and explicit request to change.
      2. Only change the intent if the user's query directly and unambiguously relates to a different intent.
      3. If the query is a follow-up, a question, clarification, or continuation within the current intent, do not change it.
      4. Requests for additional information or resources (like images, maps, or data) within the same topic should not be considered as intent changes.
      5. If you're unsure about changing the intent, keep the current one.
      6. If the user asks a question, always treat it as part of the current workflow and do not change the intent.
      
      Provide a brief reason for your choice.
      Return your response as a JSON object with two properties:
      1. "reason": A brief explanation for your intent choice, including why you maintained or changed it.
      2. "intent": The chosen intent (must be one of the provided intents or null if uncertain).
      
      DO NOT ASSUME A NEW INTENT UNLESS IT'S EXPLICITLY AND CLEARLY DIFFERENT FROM THE CURRENT CONVERSATION FLOW. If you are not sure, maintain the current intent. User questions should always be treated as part of the current workflow.`;

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant determining the intent of a conversation. Respond with a JSON object containing a reason and an intent. Be very conservative about changing intents. Always treat user questions as part of the current workflow.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    });

    return JSON.parse(response.choices[0].message.content);
  }

  async init2(
    userId: string,
    conversationId: string,
    query: string,
    files?: CresaFileI[],
  ) {
    const graphState: StateGraphArgs<AgentState>['channels'] = {
      messages: {
        reducer: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
      },
    };

    const user = await this.userService.findOne(userId);
    const authData = new SystemMessage(`
       #####Authentication Data
      userID: ${user?.id}
      organizationId: ${user?.organizationId}
      organizationName: ${user?.company}
      email: ${user?.email}
      fullName: ${user?.fullName}
      #####End Authentication Data
    `);

    let conversation = await this.conversationService.findOrCreateConversation(
      {
        conversationId,
      },
      userId,
    );

    let intentMessage;

    const conversationHistory = conversation?.messages || [];
    const formattedHistory = conversationHistory.map(
      (msg) => `${msg.roleType}: ${msg.content}`,
    );

    if (conversation && !conversation.intent) {
      const response = await this.generateConversationIntent(
        query,
        formattedHistory,
      );

      conversation.intent = response?.intent;
      conversation = await this.conversationRepo.save(conversation);
    } else if (files?.length) {
      // If files are uploaded and there's an existing intent, don't change it
      console.log(
        'Files uploaded for existing conversation. Continuing with current intent.',
      );
    } else {
      const newIntentResponse = await this.generateConversationIntent(
        query,
        formattedHistory,
      );
      const newIntent = newIntentResponse?.intent;

      if (newIntent && newIntent !== conversation.intent) {
        console.log(
          `Potential intent change detected from ${conversation.intent} to ${newIntent}`,
        );

        // Use the workflowGuideTool to handle the intent mismatch
        const workflowGuideResponse = await this.agentToolService
          .workflowGuideTool()
          .invoke({
            currentIntent: conversation.intent,
            requestedAction: newIntent,
          });

        intentMessage = new SystemMessage(`
          The user has attempted to change the conversation intent. Please respond with the following guidance:
          ${workflowGuideResponse}
          
          After providing this guidance, continue the conversation based on the current intent: ${conversation.intent}.
        `);
      }
    }

    let nextSteps: string;

    if (files?.length) {
      console.log('File was uploaded');
      await Promise.all(
        files.map(async (file) => {
          const predictedType = await this.predictDocumentType(
            file.fileURL,
            file?.fileName,
          );

          console.log(predictedType, 'predictedType');

          const document = this.documentRepo.create({
            documentName: file.fileName,
            conversationId,
            inputFileURL: file.fileURL,
            userId,
            status: ['rent-roll', 'trailing-12'].includes(predictedType)
              ? DocumentStatusENUM.UPLOADED
              : DocumentStatusENUM.SYNC_COMPLETED,
            fileType: predictedType,
          });

          const createdDocument = await this.documentRepo.save(document);

          this.documentService.attachMetaToDocument(createdDocument);

          // await this.documentService.convertDocumentToBlob(createdDocument);

          if (
            createdDocument &&
            String(createdDocument?.inputFileURL).endsWith('.pdf') &&
            createdDocument.fileType !== 'rent-roll' &&
            createdDocument.fileType !== 'trailing-12'
          ) {
            await this.documentService.convertDocumentToBlob(createdDocument);
          }
        }),
      );
    }

    const toolNode = this.agentToolService.getToolNode(conversation.intent);
    const model = this.agentToolService.getModel(conversation.intent);

    const that = this;

    async function callModel(state: AgentState) {
      const messages = state.messages;
      // console.log(messages, 'MESSAGESS>>>>>');
      fs.appendFile('messages.log', JSON.stringify(messages) + '\n', (err) => {
        if (err) {
          console.error('Error writing to file', err);
        }
      });
      const response = await model.invoke(messages);
      const lastMessage = messages[messages.length - 1];
      console.log(response, 'Agent response>>>>>>>');
      if (
        lastMessage instanceof AIMessage &&
        lastMessage.additional_kwargs?.tool_calls
      ) {
        for (const toolCall of lastMessage.additional_kwargs.tool_calls) {
          // Log the tool response
          that.logger.log(
            `Tool ${toolCall.function.name} response:`,
            toolCall.function.arguments,
          );
        }
      }
      const nextStepsPrompt = `Based on the current conversation, suggest 3 very brief, likely next actions or questions from the user. Each suggestion should be 5 words or less.`;
      const nextStepsResponse = await model.invoke([
        ...messages,
        new SystemMessage(nextStepsPrompt),
      ]);

      nextSteps = nextStepsResponse.content
        .split('\n')
        .map((step) => step.trim())
        .filter((step) => step)
        .map((step) => step.replace(/^\d+\.\s*/, ''))
        .slice(0, 3);

      const responseMeta = response.response_metadata;
      that.logger.log(`**Response Metadata**`, responseMeta);
      that.logger.log(`**Tools called:**`, response.tool_calls);

      // We return a list, because this will get added to the existing list
      return { messages: [response] };
    }

    // Define a new graph
    const workflow = new StateGraph<AgentState>({ channels: graphState })
      .addNode('agent', callModel)
      .addNode('tools', toolNode)
      .addEdge('__start__', 'agent')
      .addConditionalEdges('agent', this.shouldContinue)
      .addEdge('tools', 'agent');

    // Initialize memory to persist state between graph runs
    const checkpointer = new MemorySaver();

    const thread_id = conversationId;

    const uuID = v4();

    const userMsg = {
      uuid: uuID,
      role: 'User',
      roleType: 'user',
      content: query,
      metadata: {
        AuthData: [],
        files,
      },
      createdAt: new Date(),
    };

    const app = workflow.compile({
      checkpointer,
    });

    let parsedMessages = ``;

    if (conversationHistory?.length) {
      parsedMessages = 'Relevant context from previous conversations:';
      for (const msg of conversationHistory) {
        parsedMessages = `${parsedMessages} - \n ${msg.content}`;
      }
    }

    const memory = new SystemMessage(parsedMessages);

    const dealID = new SystemMessage(
      `This is the deal ID: ${conversation?.dealId}.
      The conversation ID is ${conversation?.id}
      `,
    );

    const currentConversationIntent = new SystemMessage(
      `The current conversation intent is ${conversation.intent}. Please make reference to it as required`,
    );

    console.log(intentMessage, 'intentMessage');

    const t12Data = new SystemMessage(`
      When handling T12 (Trailing 12 months) financial data:
      1. Only use data explicitly provided by the read_t12_data tool.
      2. Do not invent, assume, or hallucinate any information not present in the data.
      3. If the tool returns an error or indicates data is unavailable, clearly communicate this to the user.
      4. When data is available, summarize key financial points accurately without adding unsupported details.
      5. If asked about specific financial details not in the data, state that the information is not available in the current T12 data.
      6. Be cautious when interpreting financial trends and always base conclusions on the actual data provided.
    `);

    const rentRollMsg = // Add this to the systemMessage array in the init2 method
      new SystemMessage(`
      When handling rent roll data:
      1. Only use data explicitly provided by the read_rentroll_data tool.
      2. Do not invent, assume, or hallucinate any information not present in the data.
      3. If the tool returns an error or indicates data is unavailable, clearly communicate this to the user.
      4. When data is available, summarize key points accurately without adding unsupported details.
      5. If asked about specific details not in the data, state that the information is not available in the current rent roll data.
    `);

    if (conversation?.deal?.activeModelSyncId) {
    }

    const modelSystemMessage = new SystemMessage(`
      The model ID is ${conversation?.deal?.activeModelSyncId}
      Use this whenever you need the model ID.
      `);

    const systemMessage = [
      currentConversationIntent,
      rentRollMsg,
      t12Data,
      modelSystemMessage,
      memory,
      authData,
      dealID,
      new SystemMessage(
        'When asked, under no circumstances should you reveal your data sources including RENT CAST OR HELLO DATA. EVER. You can only reveal public sources like Zillow and Apartments.com. Also DO NOT reveal any sensitive information to the user. You can use them internally BUT DO NOT reveal to the user.',
      ),
      new SystemMessage(
        'For the response, data that is suitable for tabular representation (e.g., numerical data, comparative information, or structured lists), always present it in a tabular format. For information that is better conveyed through text (e.g., explanations, narratives, or complex concepts), keep it in text format. Use your judgment to determine the most appropriate format for each piece of information.',
      ),
    ];

    if (intentMessage) {
      systemMessage.unshift(intentMessage);
    }

    // if (conversation?.investmentMemo && conversation?.investmentMemo?.length) {
    //   systemMessage.push(
    //     new SystemMessage(
    //       `An investment memo is available for this conversation. Use the 'retrieve_investment_memo' tool to access its content when needed.`,
    //     ),
    //   );
    // }

    // Provide citations as footnote references in markdown format (e.g. [^source-1]) with footnote definitions at the end (e.g. [^source-1]: [Title](url)).
    // Example:
    // The largest ball in the pool was purple[^source-1].
    // [^source-1]: [Analysis of pool balls](https://poolballs.com/page)

    const finalState = await app.invoke(
      {
        messages: [
          ...systemMessage,
          new HumanMessage(`
            User query: ${query}
            `),
        ],
        StringOutputParser,
      },
      { configurable: { thread_id } },
    );

    const serializedFinalStateMessages = JSON.stringify(finalState.messages);
    this.logger.log(
      `Final state context length>>>>>>>>>>>>>: ${serializedFinalStateMessages.length} characters<<<<<<<<<<<`,
    );

    let msg = finalState.messages[finalState.messages.length - 1].content;

    console.log(msg, 'AI Response >>>>>>');

    let scratchpad = null;
    const uuid2 = v4();

    const tableRegex =
      /\|\s*(.+?)\s*\|.*\n\|\s*[-:]+\s*\|.*\n(\|\s*(.+?)\s*\|.*\n)+/g;

    const containsMarkdownTable = tableRegex.test(msg);

    const lastUserMessage = conversationHistory
      .slice()
      .reverse()
      .find((msg) => msg.roleType === 'user' && msg.content !== query);

    if (lastUserMessage?.content.toLowerCase().includes('market research')) {
      console.log('Previous user message contained market research');
      const conversation =
        await this.conversationService.findOrCreateConversation(
          { conversationId },
          userId,
        );
      scratchpad = conversation?.data;
    } else {
      if (containsMarkdownTable) {
        const scratchPadResults = [];

        // Split the message into lines
        const lines = msg.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();

          // Check if the line is the start of a table
          if (line.startsWith('|')) {
            // Get the heading (the non-empty line immediately before the table)
            let heading = null;
            for (let j = i - 1; j >= 0; j--) {
              const prevLine = lines[j].trim();
              if (prevLine && prevLine.startsWith('#')) {
                heading = prevLine;
                break;
              }
            }

            let tableContent = line + '\n';
            // Collect all lines of the table
            while (
              i + 1 < lines.length &&
              lines[i + 1].trim().startsWith('|')
            ) {
              i++;
              tableContent += lines[i] + '\n';
            }

            try {
              const tableData = this.parseMarkdownTable(tableContent);
              scratchPadResults.push({
                type: 'table',
                heading,
                content: tableData,
              });
              // Generate summary for the table
              const tableSummary = `User query: ${query}
              Table Headings: ${heading}
              Table Data: ${tableData}
              Analyze the data briefly:
              1. Key insights
              2. Notable trends or patterns
              3. Significant outliers
              4. Implications
              5. Suggested next steps
              
              For Rent roll and T12: Summarize key numbers only.
              Be concise.`;

              const tableSummaryResponse = await model.invoke([
                new HumanMessage(tableSummary),
              ]);

              let scratchPadSummary = tableSummaryResponse.content;

              // Remove the table from the message and add the summary
              msg = msg
                .replace(
                  tableContent,
                  '[A table was generated for this data. Check scratchpad for more details.]\n\n\n\n',
                )
                .trim();
              msg = msg
                .replace(
                  tableRegex,
                  '[A table was generated for this data. Check scratchpad for more details.]\n\n\n\n',
                )
                .trim();
              msg = msg.replace(/\|[^\n]*\|\s*\n?/g, '').trim();
              scratchPadSummary = scratchPadSummary
                .replace(tableRegex, '')
                .trim();
              scratchPadSummary = scratchPadSummary
                .replace(/\|[^\n]*\|\s*\n?/g, '')
                .trim();
              msg = `${msg}\n\n\n${scratchPadSummary}`;
            } catch (e) {
              console.log(e, 'Error when generating scratchpad data');
            }
          }
        }

        scratchpad = scratchPadResults.length > 0 ? scratchPadResults : null;
      }
    }

    const aiMessage = {
      uuid: `${uuid2}`,
      role: 'CRESA',
      roleType: 'assistant',
      content: msg,
      createdAt: new Date(),
      metadata: { scratchpad },
    };

    conversation = await this.conversationService.findOrCreateConversation(
      {
        conversationId,
      },
      userId,
    );

    const latestConversationHistory = conversation?.messages || [];

    // Simplified conversation history update
    latestConversationHistory.push(userMsg, aiMessage);
    conversation.messages = latestConversationHistory;
    await this.conversationRepo.save(conversation);

    return { content: msg, scratchpad, nextSteps };
  }

  parseMarkdownTable(markdownTable: string): any {
    const lines = markdownTable.trim().split('\n');
    const headers = lines[0]
      .split('|')
      .map((header) => header.trim())
      .filter(Boolean);
    const rows = lines.slice(2).map((row) =>
      row
        .split('|')
        .map((cell) => cell.trim())
        .filter(Boolean),
    );

    return { headers, rows };
  }

  async getConversation(id: string) {
    const conversation = await this.conversationRepo.findOne({
      where: {
        conversationId: id,
      },
      relations: ['deal'],
    });

    return conversation;
  }
}
