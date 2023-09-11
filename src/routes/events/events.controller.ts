import { BadRequestException, Controller, Param, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { EventsService } from './events.service';
import { getAddress, isAddress } from 'ethers';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Sse('/sse/:safe')
  sse(@Param('safe') safe: string): Observable<MessageEvent> {
    if (isAddress(safe) && getAddress(safe) === safe)
      return this.eventsService.getEventsObservableForSafe(safe);

    throw new BadRequestException('Not valid EIP55 address', {
      description: `${safe} is not a valid EIP55 Safe address`,
    });
  }
}
