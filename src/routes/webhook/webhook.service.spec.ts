import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { WebhookService } from './webhook.service';
import { Webhook } from './repositories/webhook.entity';
import { WebhookModule } from './webhook.module';
import { DatabaseModule } from '../../datasources/db/database.module';
import { ConfigModule } from '@nestjs/config';
import { TxServiceEventType } from '../events/event.dto';
import { HttpService } from '@nestjs/axios';
import { Observable } from 'rxjs';
import { AxiosError, AxiosHeaders, AxiosResponse } from 'axios';
import { throwError, of } from 'rxjs';
import { WebhookPublicDto } from './dtos/webhook.dto';
import { DataSource } from 'typeorm';

describe('Webhook service', () => {
  let httpService: HttpService;
  let webhookService: WebhookService;
  let dataSource: DataSource;
  const public_webhook: WebhookPublicDto = {
    public_id: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Awesome webhook',
    url: 'https://example.com/webhook',
    authorization: 'Bearer abc123secret',
    chains: [1, 137],
    events: [
      'SEND_CONFIRMATIONS',
      'SEND_TOKEN_TRANSFERS',
      'SEND_ETHER_TRANSFERS',
    ],
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot(), WebhookModule, DatabaseModule],
    }).compile();

    httpService = moduleRef.get<HttpService>(HttpService);
    webhookService = moduleRef.get<WebhookService>(WebhookService);
    dataSource = moduleRef.get<DataSource>(DataSource);
    const webhookRepository = dataSource.getRepository(Webhook);
    await webhookRepository.clear();
  });

  describe('getCachedActiveWebhooks', () => {
    it('should return an array of webhooks', async () => {
      const expected: Webhook[] = [new Webhook()];
      const findAllActiveSpy = jest
        .spyOn(webhookService, 'findAllActive')
        .mockImplementation(async () => expected);

      let results = await webhookService.getCachedActiveWebhooks();
      expect(results).toEqual(expected);
      expect(findAllActiveSpy).toHaveBeenCalledTimes(1);

      // As it's cached, it shouldn't be called again
      results = await webhookService.getCachedActiveWebhooks();
      expect(results).toEqual(expected);
      expect(findAllActiveSpy).toHaveBeenCalledTimes(1);
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
      expect(findAllActiveSpy).toHaveBeenCalledTimes(1);
      expect(postWebhookSpy).toHaveBeenCalledTimes(0);
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
      expect(findAllActiveSpy).toHaveBeenCalledTimes(1);
      // Only 2 webhooks will be called, as one of them has `sendSafeCreations=false`
      expect(postWebhookSpy).toHaveBeenCalledTimes(2);
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
      const event = {
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
      const results = await webhookService.postWebhook(
        event,
        url,
        authorization,
      );
      expect(results).toBe(axiosResponseMocked);
      expect(httpServicePostSpy).toHaveBeenCalledTimes(1);
      expect(httpServicePostSpy).toHaveBeenCalledWith(url, event, {
        headers: { Authorization: authorization },
      });
    });

    it('should log an error message if response is received with non-2xx status code', async () => {
      const url = 'http://localhost:4815';
      const event = {
        chainId: '1',
        type: 'SAFE_CREATED' as TxServiceEventType,
        text: 'hello',
        address: '0x0275FC2adfF11270F3EcC4D2F7Aa0a9784601Ca6',
      };

      const axiosConfigMocked = {
        headers: new AxiosHeaders(),
      };
      const axiosResponseMocked = <AxiosResponse>{
        status: 503,
        statusText: 'Service Unavailable',
        data: 'No data',
      };

      const httpServicePostSpy = jest
        .spyOn(httpService, 'post')
        .mockReturnValue(
          throwError(
            () =>
              new AxiosError(
                'Service Unavailable',
                '503',
                axiosConfigMocked,
                {},
                axiosResponseMocked,
              ),
          ),
        );
      const loggerErrorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();

      await webhookService.postWebhook(event, url, '');

      expect(httpServicePostSpy).toHaveBeenCalledTimes(1);
      expect(httpServicePostSpy).toHaveBeenCalledWith(url, event, {
        headers: {},
      });
      expect(loggerErrorSpy).toHaveBeenCalledWith({
        message: 'Error sending event',
        messageContext: {
          event: event,
          httpRequest: {
            startTime: expect.any(Number),
            url: url,
          },
          httpResponse: {
            data: axiosResponseMocked.data,
            statusCode: axiosResponseMocked.status,
          },
        },
      });
    });

    it('should log an error message if response is not received', async () => {
      const url = 'http://localhost:4815';
      const event = {
        chainId: '1',
        type: 'SAFE_CREATED' as TxServiceEventType,
        text: 'hello',
        address: '0x0275FC2adfF11270F3EcC4D2F7Aa0a9784601Ca6',
      };

      const axiosConfigMocked = {
        headers: new AxiosHeaders(),
      };
      const errorMessageMocked = 'Service Unavailable';

      const httpServicePostSpy = jest
        .spyOn(httpService, 'post')
        .mockReturnValue(
          throwError(
            () =>
              new AxiosError(
                errorMessageMocked,
                '503',
                axiosConfigMocked,
                {},
                undefined,
              ),
          ),
        );
      const loggerErrorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();

      await webhookService.postWebhook(event, url, '');

      expect(httpServicePostSpy).toHaveBeenCalledTimes(1);
      expect(httpServicePostSpy).toHaveBeenCalledWith(url, event, {
        headers: {},
      });
      expect(loggerErrorSpy).toHaveBeenCalledWith({
        message: 'Error sending event',
        messageContext: {
          event: event,
          httpRequest: {
            url: url,
            startTime: expect.any(Number),
          },
          httpResponse: null,
          httpRequestError: {
            message: expect.stringContaining('Response not received. Error:'),
          },
        },
      });
    });

    it('should log an error message if request cannot be made', async () => {
      const url = 'http://localhost:4815';
      const event = {
        chainId: '1',
        type: 'SAFE_CREATED' as TxServiceEventType,
        text: 'hello',
        address: '0x0275FC2adfF11270F3EcC4D2F7Aa0a9784601Ca6',
      };

      const errorMessage = 'Internal Server Error';

      const httpServicePostSpy = jest
        .spyOn(httpService, 'post')
        .mockReturnValue(throwError(() => new Error(errorMessage)));
      const loggerErrorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();

      await webhookService.postWebhook(event, url, '');

      expect(httpServicePostSpy).toHaveBeenCalledTimes(1);
      expect(httpServicePostSpy).toHaveBeenCalledWith(url, event, {
        headers: {},
      });
      expect(loggerErrorSpy).toHaveBeenCalledWith({
        message: 'Error sending event',
        messageContext: {
          event: event,
          httpRequest: {
            url: url,
            startTime: expect.any(Number),
          },
          httpResponse: null,
          httpRequestError: {
            message: expect.any(String),
          },
        },
      });
    });

    it('should log a debug message if request is successful.', async () => {
      const url = 'http://localhost:4815';
      const event = {
        chainId: '1',
        type: 'SAFE_CREATED' as TxServiceEventType,
        text: 'hello',
        address: '0x0275FC2adfF11270F3EcC4D2F7Aa0a9784601Ca6',
      };

      const httpServicePostSpy = jest
        .spyOn(httpService, 'post')
        .mockReturnValue(
          of({
            status: 204,
            statusText: 'No Content',
            data: null,
          } as AxiosResponse<any>),
        );
      const loggerErrorSpy = jest
        .spyOn(Logger.prototype, 'debug')
        .mockImplementation();

      await webhookService.postWebhook(event, url, '');

      expect(httpServicePostSpy).toHaveBeenCalledTimes(1);
      expect(httpServicePostSpy).toHaveBeenCalledWith(url, event, {
        headers: {},
      });
      expect(loggerErrorSpy).toHaveBeenCalledWith({
        message: 'Success sending event',
        messageContext: {
          event: event,
          httpRequest: {
            endTime: expect.any(Number),
            startTime: expect.any(Number),
            url: url,
          },
          httpResponse: {
            data: 'null',
            elapsedTimeMs: expect.any(Number),
            statusCode: 204,
          },
        },
      });
    });
  });

  describe('Create Get Update Delete webhook', () => {
    it('Should create a webhook correclty', async () => {
      const webhook = await webhookService.createWebhook(public_webhook);
      expect(webhook).not.toBeNull();
      expect(webhook?.public_id).toBe(public_webhook.public_id);
      expect(webhook?.url).toBe(public_webhook.url);
      expect(webhook?.chains).toEqual(public_webhook.chains);
      expect(webhook?.events.sort()).toEqual(public_webhook.events.sort());
      const created_webhook = await Webhook.findOneBy({
        public_id: public_webhook.public_id,
      });
      expect(created_webhook).not.toBeNull();
      expect(created_webhook?.public_id).toBe(public_webhook.public_id);
      expect(created_webhook?.url).toBe(public_webhook.url);
      expect(created_webhook?.sendTokenTransfers).toBe(true);
      expect(created_webhook?.sendEtherTransfers).toBe(true);
      expect(created_webhook?.sendConfirmations).toBe(true);
      expect(created_webhook?.sendMultisigTxs).toBe(false);
      expect(created_webhook?.sendDelegates).toBe(false);
      expect(created_webhook?.sendModuleTransactions).toBe(false);
      expect(created_webhook?.sendSafeCreations).toBe(false);
      expect(created_webhook?.sendMessages).toBe(false);
      expect(created_webhook?.sendReorgs).toBe(false);
    });
    it('Should raise Webhook already exists', async () => {
      await webhookService.createWebhook(public_webhook);
      await expect(
        webhookService.createWebhook(public_webhook),
      ).rejects.toThrow('Webhook already exists');
    });
    it('Should raise WebhookDoesNotExist if webhook does not exist', async () => {
      const webhook = await webhookService.getWebHook(
        '88888888-e757-4b74-a40f-8dca14553576',
      );
      expect(webhook).toBeNull();
    });
    it('Should return the public webhook', async () => {
      const created_webhook =
        await webhookService.createWebhook(public_webhook);
      const webhook = await webhookService.getWebHook(
        created_webhook.public_id,
      );
      expect(webhook).not.toBeNull();
      expect(webhook).not.toBeNull();
      expect(webhook?.public_id).toBe(public_webhook.public_id);
      expect(webhook?.url).toBe(public_webhook.url);
      expect(webhook?.chains).toEqual(public_webhook.chains);
      expect(webhook?.events.sort()).toEqual(public_webhook.events.sort());
    });
  });
});
