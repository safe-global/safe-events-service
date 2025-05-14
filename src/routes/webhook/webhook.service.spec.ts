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
import { WebhookRequestDto } from './dtos/webhook.dto';
import { DataSource, Repository } from 'typeorm';
import { WebhookDoesNotExist } from './exceptions/webhook.exceptions';

describe('Webhook service', () => {
  let httpService: HttpService;
  let webhookService: WebhookService;
  let dataSource: DataSource;
  let webhookRepository: Repository<Webhook>;
  const requestWebhook: WebhookRequestDto = {
    description: 'Awesome webhook',
    url: 'https://example.com/webhook',
    isActive: true,
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
    webhookRepository = dataSource.getRepository(Webhook);
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
      const webhook = await webhookService.createWebhook(requestWebhook);
      expect(webhook).not.toBeNull();
      expect(webhook?.id).not.toBeNull();
      expect(webhook?.url).toBe(requestWebhook.url);
      expect(webhook?.chains).toEqual(requestWebhook.chains);
      expect(webhook?.events.sort()).toEqual(requestWebhook.events.sort());
      const createdWebhook = await Webhook.findOneBy({
        publicId: webhook.id,
      });
      expect(createdWebhook).not.toBeNull();
      expect(createdWebhook?.publicId).toBe(webhook.id);
      expect(createdWebhook?.url).toBe(requestWebhook.url);
      expect(createdWebhook?.sendTokenTransfers).toBe(true);
      expect(createdWebhook?.sendEtherTransfers).toBe(true);
      expect(createdWebhook?.sendConfirmations).toBe(true);
      expect(createdWebhook?.sendMultisigTxs).toBe(false);
      expect(createdWebhook?.sendDelegates).toBe(false);
      expect(createdWebhook?.sendModuleTransactions).toBe(false);
      expect(createdWebhook?.sendSafeCreations).toBe(false);
      expect(createdWebhook?.sendMessages).toBe(false);
      expect(createdWebhook?.sendReorgs).toBe(false);
    });
    it('Should return null if webhook does not exist', async () => {
      const webhook = await webhookService.getWebhook(
        '88888888-e757-4b74-a40f-8dca14553576',
      );
      expect(webhook).toBeNull();
    });
    it('Should return the public webhook', async () => {
      const createdWebhook = await webhookService.createWebhook(requestWebhook);
      const webhook = await webhookService.getWebhook(createdWebhook.id);
      expect(webhook).not.toBeNull();
      expect(webhook).not.toBeNull();
      expect(webhook?.id).toBe(createdWebhook.id);
      expect(webhook?.url).toBe(requestWebhook.url);
      expect(webhook?.chains).toEqual(requestWebhook.chains);
      expect(webhook?.events.sort()).toEqual(requestWebhook.events.sort());
    });
    it('Should raise exception during upodate if webhook does not exist', async () => {
      await expect(
        webhookService.updateWebhook(
          '88888888-e757-4b74-a40f-8dca14553576',
          requestWebhook,
        ),
      ).rejects.toThrow(new WebhookDoesNotExist());
    });
    it('Should update the existing webhook', async () => {
      const createdWebhook = await webhookService.createWebhook(requestWebhook);

      requestWebhook.description = 'Modified description';
      requestWebhook.chains = [5];
      const updatedWebhook = await webhookService.updateWebhook(
        createdWebhook.id,
        requestWebhook,
      );
      expect(updatedWebhook.id).toBe(createdWebhook.id);
      expect(updatedWebhook.chains).toEqual([5]);
      expect(updatedWebhook.description).toBe('Modified description');
      // Check if was stored in database
      const storedWebhook = await webhookRepository.findOne({
        where: { publicId: createdWebhook.id },
      });
      expect(storedWebhook).not.toBeNull();
      expect(storedWebhook?.publicId).toBe(createdWebhook.id);
      expect(storedWebhook?.chains).toEqual(['5']);
      expect(storedWebhook?.description).toBe('Modified description');
    });
    it('Should raise webhook does not exist during delete', async () => {
      await expect(
        webhookService.deleteWebhook('88888888-e757-4b74-a40f-8dca14553576'),
      ).rejects.toThrow(new WebhookDoesNotExist());
    });
    it('Should delete a webhook', async () => {
      const createdWebhook = await webhookService.createWebhook(requestWebhook);

      await webhookService.deleteWebhook(createdWebhook.id);

      const storedWebhook = await webhookRepository.findOne({
        where: { publicId: createdWebhook.id },
      });
      expect(storedWebhook).toBeNull();
    });
  });
});
