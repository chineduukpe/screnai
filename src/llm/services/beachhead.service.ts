import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
// import { ChatOpenAI } from '@langchain/openai';
import { StateGraph, StateGraphArgs } from '@langchain/langgraph';
import { MemorySaver } from '@langchain/langgraph';
import { BadRequestException, Injectable } from '@nestjs/common';
import { AgentToolService } from './agent.tools.service';
import { v4 } from 'uuid';
import { ConversationService } from 'src/conversation/conversation.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { CallBeachhead } from '../interfaces/cresa.interface';
import { Beachhead } from 'src/conversation/entities/beachhead.entity';
import { CreateConversationDto } from 'src/conversation/dto/create-conversation.dto';
import axios from 'axios';
import { logErrorDecorator } from 'src/utilities/logDecorator.service';
import { Logger } from '@nestjs/common';

interface AgentState {
  messages: BaseMessage[];
}

@Injectable()
export class BeachheadService {
  private readonly logger: Logger = new Logger(BeachheadService.name);
  private model: any;
  private checkpointer: MemorySaver;
  constructor(
    private agentToolService: AgentToolService,
    private conversationService: ConversationService,
    @InjectRepository(Beachhead)
    private beachheadRepo: Repository<Beachhead>,
  ) {
    this.checkpointer = new MemorySaver();
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

  async beachhead(body: CallBeachhead) {
    const { conversationId, query, address, placeId } = body;

    let rentCompsData: any;
    let finalQuery: string;

    if (address && address.trim() !== '') {
      rentCompsData = await this.fetchRentCastData(address, placeId);
      finalQuery = `Given the rent comps data, generate a detailed and well structed rent comps report for the following address ${address}.
      
      Also search for related properties on Zillow and Apartments.com and do a detailed comparism.
      
      Return data for:
      - Market rent for 1, 2, 3 bedrooms and also studio apartment.
      - Average, min and max rent
      - Rent trends over the last 3, 6 and 12 months for 1, 2, 3 bedrooms
      - Links to available 1,2,3 bedroom units on the market
      - If avaialble, Zestimate from Zillow
      - If available, estimates from Apartments.com
      
      `;
    } else {
      finalQuery = query;
    }

    const graphState: StateGraphArgs<AgentState>['channels'] = {
      messages: {
        reducer: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
      },
    };

    const toolNode = this.agentToolService.bhToolNode;
    const model = this.agentToolService.bhModel;

    async function callModel(state: AgentState) {
      const messages = state.messages;
      const response = await model.invoke(messages);

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
      content: address && address.trim() !== '' ? address : query,
      metadata: {},
      createdAt: new Date(),
    };

    let conversation = await this.findOrCreateConversation(
      {
        conversationId,
      },
      rentCompsData,
    );

    const conversationHistory = conversation?.messages || [];
    const rentCastData = conversation.rentCastData;

    const systemMessages = [
      new SystemMessage(
        'When asked, under no circumstances should you reveal your data sources including RENT CAST. EVER. You can only reveal public sources like Zillow and Apartments.com. Also DO NOT reveal any sensitive information to the user. You can use them internally BUT DO NOT reveal to the user.',
      ),
      new SystemMessage(
        `This is the conversation ID: ${conversationId}. You can reference it when a user wants to send an email`,
      ),
      new SystemMessage(`You have access to the following RentCast data as reference. Use this information to inform your responses:
      ${JSON.stringify(rentCastData, null, 2)}
      Please refer to this data when answering questions or providing analysis.`),
    ];

    const app = workflow.compile({
      checkpointer,
    });

    const parsedMessages = conversationHistory.map((msg) =>
      msg.roleType === 'user'
        ? new HumanMessage(msg.content)
        : new AIMessage(msg.content),
    );

    const finalState = await app.invoke(
      {
        messages: [
          ...systemMessages,
          ...parsedMessages,
          new HumanMessage(`User query: ${finalQuery}`),
        ],
        StringOutputParser,
      },
      { configurable: { thread_id } },
    );

    const msg = finalState.messages[finalState.messages.length - 1].content;
    const uuid2 = v4();

    const aiMessage = {
      uuid: `${uuid2}`,
      role: 'CRESA',
      roleType: 'assistant',
      content: msg,
      createdAt: new Date(),
    };

    console.log('Trying to save to database');
    conversation = await this.findOrCreateConversation({
      conversationId,
    });
    // Simplified conversation history update
    conversationHistory.push(userMsg, aiMessage);
    conversation.messages = conversationHistory;
    await this.beachheadRepo.save(conversation);

    console.log('Saved to database');
    return msg;
  }

  async getConversation(id: string) {
    const conversation = await this.beachheadRepo.findOne({
      where: {
        conversationId: id,
      },
    });

    return conversation;
  }

  async findOrCreateConversation(
    data: CreateConversationDto,
    rentCastData?: any,
  ) {
    const conversation = await this.beachheadRepo.findOne({
      where: {
        conversationId: data?.conversationId,
      },
    });

    if (!conversation) {
      return await this.beachheadRepo.save({
        ...data,
        rentCastData,
      });
    }

    return conversation;
  }

  @logErrorDecorator()
  async fetchRentCastData(address: string, placeId: string) {
    console.log(
      `Fetching rent comps data for ${address} and placeId ${placeId}`,
    );

    const headers = {
      'x-api-key': process.env.RENT_CAST_API_KEY,
      accept: 'application/json',
    };

    const propertyDataURL = `${process.env.RENT_CAST_BASE_URL}/properties?address=${address}`;

    let propertyDataResponse = null;

    try {
      propertyDataResponse = await axios.get(propertyDataURL, {
        headers,
      });
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log('Property data not found, continuing with null value');
      } else {
        throw error; // Re-throw other errors
      }
    }

    try {
      let rentCompsURL: string, marketDataURL: string;

      if (propertyDataResponse) {
        // If property data is found, use address for rent comps and zipCode for market data
        const zipCode = propertyDataResponse.data[0].zipCode;
        rentCompsURL = `${
          process.env.RENT_CAST_BASE_URL
        }/avm/rent/long-term?address=${encodeURIComponent(address)}`;
        marketDataURL = `${process.env.RENT_CAST_BASE_URL}/markets?zipCode=${zipCode}`;
      } else {
        console.log('Calling Google API >>>>>>>>>>>');
        // If property data is not found, use Google Places API and lat/lng
        const googleURL = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${process.env.GOOGLE_API_KEY}`;
        const { data } = await axios.get(googleURL);
        const geometry = data?.result?.geometry?.location;
        const postalCode = data?.result?.address_components?.find((component) =>
          component.types.includes('postal_code'),
        );

        if (!geometry || !postalCode) {
          throw new BadRequestException(
            'Unable to find location data for the given address',
          );
        }

        rentCompsURL = `${process.env.RENT_CAST_BASE_URL}/avm/rent/long-term?latitude=${geometry.lat}&longitude=${geometry.lng}`;
        marketDataURL = `${process.env.RENT_CAST_BASE_URL}/markets?zipCode=${postalCode.long_name}`;
      }

      // Fetch rent comps and market data concurrently
      const [rentCompsResponse, marketDataResponse] = await Promise.all([
        axios.get(rentCompsURL, { headers }),
        axios.get(marketDataURL, { headers }),
      ]);

      return {
        rentComps: rentCompsResponse?.data,
        propertyData: propertyDataResponse ? propertyDataResponse.data : '',
        marketData: marketDataResponse?.data,
      };
    } catch (error) {
      console.error(
        'Error fetching rent cast data:',
        error.response?.data?.message || error.message,
      );
      throw new BadRequestException(
        error.response?.data?.message ||
          'An error occurred while fetching data',
      );
    }
  }
}
