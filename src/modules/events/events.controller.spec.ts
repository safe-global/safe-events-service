import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { QueueProvider } from '../../datasources/queue/queue.provider';
import { WebhookService } from '../webhook/webhook.service';
import { firstValueFrom } from 'rxjs';
import { TxServiceEvent, TxServiceEventType } from './event.dto';

describe('EventsController', () => {
  let controller: EventsController;
  let service: EventsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      controllers: [EventsController],
      providers: [EventsService, QueueProvider, WebhookService],
    })
      .overrideProvider(QueueProvider)
      .useValue({})
      .overrideProvider(WebhookService)
      .useValue({})
      .compile();

    controller = module.get<EventsController>(EventsController);
    service = module.get<EventsService>(EventsService);
  });

  describe('SSE events', () => {
    it('should require an EIP55 address', async () => {
      const notValidAddress = '0x8618CE407F169ABB1388348A19632AaFA857CCB9';
      const expectedError = new BadRequestException('Not valid EIP55 address', {
        description: `${notValidAddress} is not a valid EIP55 Safe address`,
      });
      expect(() => {
        controller.sse(notValidAddress);
      }).toThrow(expectedError);
    });
    it('should receive for a Safe', async () => {
      const relevantSafeAddress = '0x8618ce407F169ABB1388348A19632AaFA857CCB9';
      const notRelevantSafeAddress =
        '0x3F6E283068Ded118459B56fC669A27C3a65e587D';
      const txServiceEvents: Array<TxServiceEvent> = [
        {
          chainId: '1',
          type: 'SAFE_CREATED' as TxServiceEventType,
          hero: 'Saitama',
          address: notRelevantSafeAddress,
        },
        {
          chainId: '100',
          type: 'MESSAGE_CREATED' as TxServiceEventType,
          hero: 'Atomic Samurai',
          address: relevantSafeAddress,
        },
      ];
      const observable = controller.sse(relevantSafeAddress);
      const firstValue = firstValueFrom(observable);
      txServiceEvents.map((txServiceEvent) =>
        service.pushEventToEventsObservable(txServiceEvent),
      );

      // Not relevant event must be ignored by Safe filter
      const event = await firstValue;
      expect(event.data).toEqual(txServiceEvents[1]);
      expect(event.type).toEqual('message');
    });
  });
});
