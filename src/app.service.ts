import { Injectable } from '@nestjs/common/decorators/core';
import { LlmService } from './llm/services/llm.service';
import { TavilySearchResults } from '@langchain/community/tools/tavily_search';

import { ChatOpenAI } from '@langchain/openai';
import { WorkbookUtility } from './utilities/services/workbook.utility.service';
import {
  END,
  MemorySaver,
  START,
  StateGraph,
  StateGraphArgs,
} from '@langchain/langgraph';
import { AIMessage, BaseMessage } from '@langchain/core/messages';
import { RunnableConfig } from '@langchain/core/runnables';
import { ToolNode } from '@langchain/langgraph/prebuilt';

interface IState {
  messages: BaseMessage[];
}

@Injectable()
export class AppService {
  private model;
  private boundModel;
  constructor(
    private llmService: LlmService,
    private worksheetUtil: WorkbookUtility,
  ) {
    this.model = new ChatOpenAI({
      model: 'gpt-4o-mini',
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.boundModel = this.model.bindTools([
      new TavilySearchResults({ apiKey: process.env.TAVILY_API_KEY }),
    ]);
  }

  async callAgent(query: string) {
    const graphState: StateGraphArgs<IState>['channels'] = {
      messages: {
        value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
        default: () => [],
      },
    };
    const toolNode = new ToolNode<{ messages: BaseMessage[] }>([
      new TavilySearchResults({ apiKey: process.env.TAVILY_API_KEY }),
    ]);

    const routeMessage = (state: IState) => {
      const { messages } = state;
      const lastMessage = messages[messages.length - 1] as AIMessage;
      // If no tools are called, we can finish (respond to the user)
      if (!lastMessage.tool_calls?.length) {
        return END;
      }
      // Otherwise if there is, we continue and call the tools
      return 'tools';
    };

    const callModel = async (state: IState, config?: RunnableConfig) => {
      const { messages } = state;
      const response = await this.boundModel.invoke(messages, config);
      return { messages: [response] };
    };

    const memory = new MemorySaver();

    const workflow = new StateGraph<IState>({
      channels: graphState,
    })
      .addNode('agent', callModel)
      .addNode('tools', toolNode)
      .addEdge(START, 'agent')
      .addConditionalEdges('agent', routeMessage)
      .addEdge('tools', 'agent');

    const graph = workflow.compile({ checkpointer: memory });

    const config = { configurable: { thread_id: 'conversation-num-1' } };

    const inputs = { messages: [['user', query]] };
    for await (const { messages } of await graph.stream(inputs, {
      ...config,
      streamMode: 'values',
    })) {
      const msg = messages[messages?.length - 1];
      if (msg?.content) {
        console.log(msg.content);
      } else if (msg?.tool_calls?.length > 0) {
        console.log(msg.tool_calls);
      } else {
        console.log(msg);
      }
      console.log('-----\n');
    }
  }

  async getWordLength(input: string) {
    return input.length.toString();
  }
}
