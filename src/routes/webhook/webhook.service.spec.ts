import { Test } from '@nestjs/testing';
import { WebhookService } from './webhook.service';
import { Webhook } from './entities/webhook.entity';
import { WebhookModule } from './webhook.module';
import { DatabaseModule } from '../../datasources/db/database.module';
import { ConfigModule } from '@nestjs/config';
import { TxServiceEventType } from '../events/event.dto';
import { HttpService } from '@nestjs/axios';
import { Observable } from 'rxjs';
import { AxiosResponse } from 'axios';

describe('Webhook service', () => {
  let httpService: HttpService;
  let webhookService: WebhookService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot(), WebhookModule, DatabaseModule],
    }).compile();

    httpService = moduleRef.get<HttpService>(HttpService);
    webhookService = moduleRef.get<WebhookService>(WebhookService);
  });

  describe('getCachedActiveWebhooks', () => {
    it('should return an array of webhooks', async () => {
      const expected: Webhook[] = [new Webhook()];
      const findAllActiveSpy = jest
        .spyOn(webhookService, 'findAllActive')
        .mockImplementation(async () => expected);

      let results = await webhookService.getCachedActiveWebhooks();
      expect(results).toEqual(expected);
      expect(findAllActiveSpy).toBeCalledTimes(1);

      // As it's cached, it shouldn't be called again
      results = await webhookService.getCachedActiveWebhooks();
      expect(results).toEqual(expected);
      expect(findAllActiveSpy).toBeCalledTimes(1);
    });
  });

  describe('postEveryWebhook', () => {
    it('should not post if webhooks are not defined', async () => {
      const webhooks: Webhook[] = [];
      const findAllActiveSpy = jest
        .spyOn(webhookService, 'findAllActive')
        .mockImplementation(async () => webhooks);

      const postWebhookResponse: any = {
        data: {},
        status: 200,
        statusText: 'OK',
      };
      const postWebhookSpy = jest
        .spyOn(webhookService, 'postWebhook')
        .mockImplementation(async () => postWebhookResponse);

      const msg = {
        chainId: '1',
        type: 'SAFE_CREATED' as TxServiceEventType,
        text: 'hello',
        address: '0x0275FC2adfF11270F3EcC4D2F7Aa0a9784601Ca6',
      };
      const results = await webhookService.postEveryWebhook(msg);
      expect(results).toEqual([]);
      expect(findAllActiveSpy).toBeCalledTimes(1);
      expect(postWebhookSpy).toBeCalledTimes(0);
    });
    it('should post if webhooks are defined', async () => {
      const webhooks: Webhook[] = [new Webhook(), new Webhook(), new Webhook()];
      webhooks[0].url = 'http://localhost:4815';
      webhooks[0].authorization = 'Basic 1234';
      webhooks[1].url = 'http://localhost:1623';
      webhooks[2].url = 'http://localhost:42108';
      webhooks[2].authorization = '';
      webhooks[0].sendSafeCreations = true;
      webhooks[1].sendSafeCreations = false;
      webhooks[2].sendSafeCreations = true;
      webhooks.forEach((webhook: Webhook) => (webhook.chains = []));
      const findAllActiveSpy = jest
        .spyOn(webhookService, 'findAllActive')
        .mockImplementation(async () => webhooks);
      const postWebhookResponse: any = {
        data: {},
        status: 200,
        statusText: 'OK',
      };
      const postWebhookSpy = jest
        .spyOn(webhookService, 'postWebhook')
        .mockImplementation(async () => postWebhookResponse);

      const msg = {
        chainId: '1',
        type: 'SAFE_CREATED' as TxServiceEventType,
        text: 'hello',
        address: '0x0275FC2adfF11270F3EcC4D2F7Aa0a9784601Ca6',
      };
      const results = await webhookService.postEveryWebhook(msg);
      expect(results).toEqual([postWebhookResponse, postWebhookResponse]);
      expect(findAllActiveSpy).toBeCalledTimes(1);
      // Only 2 webhooks will be called, as one of them has `sendSafeCreations=false`
      expect(postWebhookSpy).toBeCalledTimes(2);
      expect(postWebhookSpy).toHaveBeenNthCalledWith(
        1,
        msg,
        webhooks[0].url,
        webhooks[0].authorization,
      );
      expect(postWebhookSpy).toHaveBeenNthCalledWith(
        2,
        msg,
        webhooks[2].url,
        webhooks[2].authorization,
      );
    });
  });

  describe('postWebhook', () => {
    it('should post without authentication', async () => {
      const url = 'http://localhost:4815';
      const msg = {
        chainId: '1',
        type: 'SAFE_CREATED' as TxServiceEventType,
        text: 'hello',
        address: '0x0275FC2adfF11270F3EcC4D2F7Aa0a9784601Ca6',
      };

      const axiosResponseMocked = <AxiosResponse>{ status: 200 };
      const httpServicePostSpy = jest
        .spyOn(httpService, 'post')
        .mockImplementation(() => {
          const observableResponse: Observable<AxiosResponse<unknown, any>> =
            new Observable((subscriber) => {
              subscriber.next(axiosResponseMocked);
            });
          return observableResponse;
        });
      const results = await webhookService.postWebhook(msg, url, '');
      expect(results).toBe(axiosResponseMocked);
      expect(httpServicePostSpy).toHaveBeenCalledTimes(1);
      expect(httpServicePostSpy).toHaveBeenCalledWith(url, msg, {
        headers: {},
      });
    });

    it('shoud post with authentication', async () => {
      const url = 'http://localhost:4815';
      const msg = {
        chainId: '1',
        type: 'SAFE_CREATED' as TxServiceEventType,
        text: 'hello',
        address: '0x0275FC2adfF11270F3EcC4D2F7Aa0a9784601Ca6',
      };
      const authorization = 'Basic 1234';

      const axiosResponseMocked = <AxiosResponse>{ status: 200 };
      const httpServicePostSpy = jest
        .spyOn(httpService, 'post')
        .mockImplementation(() => {
          const observableResponse: Observable<AxiosResponse<unknown, any>> =
            new Observable((subscriber) => {
              subscriber.next(axiosResponseMocked);
            });
          return observableResponse;
        });
      const results = await webhookService.postWebhook(msg, url, authorization);
      expect(results).toBe(axiosResponseMocked);
      expect(httpServicePostSpy).toHaveBeenCalledTimes(1);
      expect(httpServicePostSpy).toHaveBeenCalledWith(url, msg, {
        headers: { Authorization: authorization },
      });
    });
  });
});
