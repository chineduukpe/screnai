import { Injectable } from '@nestjs/common';
import { EventsGateway } from './events.gateway';

@Injectable()
export class EventsService {
  // constructor(private events: EventsGateway) {}
  cronJob(client?: any) {
    return client.emit('cronJobCompleted');
  }
  create(createEventDto: any) {
    return 'This action adds a new event';
  }
}
