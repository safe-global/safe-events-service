import {
  BadRequestException,
  Controller,
  Param,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { EventsService } from './events.service';
import { getAddress, isAddress } from 'viem';
import { BasicAuthGuard } from '../../common/guards/basic-auth.guard';

@Controller('events')
@ApiTags('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @UseGuards(BasicAuthGuard)
  @Sse('/sse/:safe')
  sse(@Param('safe') safe: string): Observable<MessageEvent> {
    if (isAddress(safe) && getAddress(safe) === safe)
      return this.eventsService.getEventsObservableForSafe(safe);

    throw new BadRequestException('Not valid EIP55 address', {
      description: `${safe} is not a valid EIP55 Safe address`,
    });
  }
}
