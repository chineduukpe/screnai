import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
} from '@nestjs/websockets';
import { EventsService } from './events.service';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: true })
export class EventsGateway {
  @WebSocketServer()
  server: Server;
  constructor(private readonly eventsService: EventsService) {}

  @SubscribeMessage('extractionCompleted')
  cronJob(server: any) {
    return this.eventsService.cronJob(server);
  }

  @SubscribeMessage('categorizationSheetChanged')
  categorizationSheetChanged(@MessageBody() body: any) {
    return this.eventsService.create(body);
  }

  sendEventToClients(event: string, data: any) {
    console.log(event, 'event data');
    this.server.emit(event, data);
  }

  setMaxListeners(val: number) {
    this.server.setMaxListeners(val);
  }
}
