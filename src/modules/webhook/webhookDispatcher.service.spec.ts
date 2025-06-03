import { Test } from '@nestjs/testing';
import { Webhook, WebhookWithStats } from './repositories/webhook.entity';
import { WebhookModule } from './webhook.module';
import { DatabaseModule } from '../../datasources/db/database.module';
import { ConfigModule } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { WebhookDispatcherService } from './webhookDispatcher.service';
import { TxServiceEventType } from '../events/event.dto';
import { AxiosError, AxiosHeaders, AxiosResponse } from 'axios';
import { HttpService } from '@nestjs/axios';
import { Observable, of, throwError } from 'rxjs';
import { Logger } from '@nestjs/common';
import { webhookWithStatsFactory } from './repositories/webhook.test.factory';

describe('Webhook service', () => {
  let httpService: HttpService;
  let webhookDispatcherService: WebhookDispatcherService;
  let dataSource: DataSource;
  let webhookRepository: Repository<Webhook>;
  

  beforeEach(async () => {
    process.env.WEBHOOK_FAILURE_THRESHOLD = '90'; // 70% failure rate
    process.env.WEBHOOK_HEALTH_WINDOW = '1'; // 1 minute
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot(), WebhookModule, DatabaseModule],
    }).compile();

    httpService = moduleRef.get<HttpService>(HttpService);
    webhookDispatcherService = moduleRef.get<WebhookDispatcherService>(
      WebhookDispatcherService,
    );
    //await webhookDispatcherService.onModuleInit();
    dataSource = moduleRef.get<DataSource>(DataSource);
    webhookRepository = dataSource.getRepository(Webhook);
    await webhookRepository.clear();
  });

  describe('getCachedActiveWebhooks', () => {
    it('should return an array of webhooks', async () => {
      const expected: WebhookWithStats[] = [webhookWithStatsFactory()];
      const findAllActiveSpy = jest
        .spyOn(webhookDispatcherService, 'getAllActive')
        .mockImplementation(async () => expected);
      // Refresh webhooks list
      await webhookDispatcherService.refreshWebhookMap();
      let results = webhookDispatcherService.getCachedActiveWebhooks();
      expect(results).toEqual(expected);
      expect(findAllActiveSpy).toHaveBeenCalledTimes(1);

      // As it's cached, it shouldn't be called again
      results = webhookDispatcherService.getCachedActiveWebhooks();
      expect(results).toEqual(expected);
      expect(findAllActiveSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('postEveryWebhook', () => {
    it('should not post if webhooks are not defined', async () => {
      const webhooks: Webhook[] = [];
      const findAllActiveSpy = jest
        .spyOn(webhookDispatcherService, 'getAllActive')
        .mockImplementation(async () => webhooks);

      // Refresh webhooks list
      await webhookDispatcherService.refreshWebhookMap();

      const postWebhookResponse: any = {
        data: {},
        status: 200,
        statusText: 'OK',
      };
      const postWebhookSpy = jest
        .spyOn(webhookDispatcherService, 'postWebhook')
        .mockImplementation(async () => postWebhookResponse);

      const msg = {
        chainId: '1',
        type: 'SAFE_CREATED' as TxServiceEventType,
        text: 'hello',
        address: '0x0275FC2adfF11270F3EcC4D2F7Aa0a9784601Ca6',
      };
      const results = await webhookDispatcherService.postEveryWebhook(msg);
      expect(results).toEqual([]);
      expect(findAllActiveSpy).toHaveBeenCalledTimes(1);
      expect(postWebhookSpy).toHaveBeenCalledTimes(0);
    });
    it('should post if webhooks are defined', async () => {
      const webhooks: Webhook[] = [
        webhookWithStatsFactory({
          url: 'http://localhost:4815',
          authorization: 'Basic 1234',
          sendSafeCreations: true,
        }),
        webhookWithStatsFactory({
          url: 'http://localhost:1623',
          authorization: '',
          sendSafeCreations: false,
        }),
        webhookWithStatsFactory({
          url: 'http://localhost:42108',
          authorization: '',
          sendSafeCreations: true,
        }),
      ];
      webhooks.forEach((webhook: Webhook) => (webhook.chains = []));
      const findAllActiveSpy = jest
        .spyOn(webhookDispatcherService, 'getAllActive')
        .mockImplementation(async () => webhooks);

      // Refresh webhooks list
      await webhookDispatcherService.refreshWebhookMap();

      const postWebhookResponse: any = {
        data: {},
        status: 200,
        statusText: 'OK',
      };
      const postWebhookSpy = jest
        .spyOn(webhookDispatcherService, 'postWebhook')
        .mockImplementation(async () => postWebhookResponse);

      const msg = {
        chainId: '1',
        type: 'SAFE_CREATED' as TxServiceEventType,
        text: 'hello',
        address: '0x0275FC2adfF11270F3EcC4D2F7Aa0a9784601Ca6',
      };
      const results = await webhookDispatcherService.postEveryWebhook(msg);
      expect(results).toEqual([postWebhookResponse, postWebhookResponse]);
      expect(findAllActiveSpy).toHaveBeenCalledTimes(1);
      // Only 2 webhooks will be called, as one of them has `sendSafeCreations=false`
      expect(postWebhookSpy).toHaveBeenCalledTimes(2);
      expect(postWebhookSpy).toHaveBeenNthCalledWith(1, msg, webhooks[0]);
      expect(postWebhookSpy).toHaveBeenNthCalledWith(2, msg, webhooks[2]);
    });
  });

  describe('postWebhook', () => {
    it('should post without authentication', async () => {
      const webhook = webhookWithStatsFactory({
        url: 'http://localhost:4815',
        authorization: '',
      });
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
      const results = await webhookDispatcherService.postWebhook(msg, webhook);
      expect(results).toBe(axiosResponseMocked);
      expect(httpServicePostSpy).toHaveBeenCalledTimes(1);
      expect(httpServicePostSpy).toHaveBeenCalledWith(webhook.url, msg, {
        headers: {},
      });
    });

    it('shoud post with authentication', async () => {
      const webhook = webhookWithStatsFactory({
        url: 'http://localhost:4815',
        authorization: 'Basic 1234',
      });
      const event = {
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
      const results = await webhookDispatcherService.postWebhook(
        event,
        webhook,
      );
      expect(results).toBe(axiosResponseMocked);
      expect(httpServicePostSpy).toHaveBeenCalledTimes(1);
      expect(httpServicePostSpy).toHaveBeenCalledWith(webhook.url, event, {
        headers: { Authorization: webhook.authorization },
      });
    });

    it('should log an error message if response is received with non-2xx status code', async () => {
      const webhook = webhookWithStatsFactory({
        url: 'http://localhost:4815',
        authorization: '',
      });
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

      await webhookDispatcherService.postWebhook(event, webhook);

      expect(httpServicePostSpy).toHaveBeenCalledTimes(1);
      expect(httpServicePostSpy).toHaveBeenCalledWith(webhook.url, event, {
        headers: {},
      });
      expect(loggerErrorSpy).toHaveBeenCalledWith({
        message: 'Error sending event',
        messageContext: {
          event: event,
          httpRequest: {
            startTime: expect.any(Number),
            url: webhook.url,
          },
          httpResponse: {
            data: axiosResponseMocked.data,
            statusCode: axiosResponseMocked.status,
          },
        },
      });
    });

    it('should log an error message if response is not received', async () => {
      const webhook = webhookWithStatsFactory({
        url: 'http://localhost:4815',
        authorization: '',
      });
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

      await webhookDispatcherService.postWebhook(event, webhook);

      expect(httpServicePostSpy).toHaveBeenCalledTimes(1);
      expect(httpServicePostSpy).toHaveBeenCalledWith(webhook.url, event, {
        headers: {},
      });
      expect(loggerErrorSpy).toHaveBeenCalledWith({
        message: 'Error sending event',
        messageContext: {
          event: event,
          httpRequest: {
            url: webhook.url,
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
      const webhook = webhookWithStatsFactory({
        url: 'http://localhost:4815',
        authorization: '',
      });
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

      await webhookDispatcherService.postWebhook(event, webhook);

      expect(httpServicePostSpy).toHaveBeenCalledTimes(1);
      expect(httpServicePostSpy).toHaveBeenCalledWith(webhook.url, event, {
        headers: {},
      });
      expect(loggerErrorSpy).toHaveBeenCalledWith({
        message: 'Error sending event',
        messageContext: {
          event: event,
          httpRequest: {
            url: webhook.url,
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
      const webhook = webhookWithStatsFactory({
        url: 'http://localhost:4815',
        authorization: '',
      });
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

      await webhookDispatcherService.postWebhook(event, webhook);

      expect(httpServicePostSpy).toHaveBeenCalledTimes(1);
      expect(httpServicePostSpy).toHaveBeenCalledWith(webhook.url, event, {
        headers: {},
      });
      expect(loggerErrorSpy).toHaveBeenCalledWith({
        message: 'Success sending event',
        messageContext: {
          event: event,
          httpRequest: {
            endTime: expect.any(Number),
            startTime: expect.any(Number),
            url: webhook.url,
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

  describe('Test refreshWebhookMap', () => {
    it('should call checkWebhooksHealth before processing webhooks', async () => {
      const checkWebhooksHealthSpy = jest.spyOn(
        webhookDispatcherService,
        'checkWebhooksHealth',
      );

      await webhookDispatcherService.refreshWebhookMap();

      expect(checkWebhooksHealthSpy).toHaveBeenCalledTimes(1);
    });
    it('should fetch webhooks from the database', async () => {
      const getAllActiveSpy = jest
        .spyOn(webhookDispatcherService, 'getAllActive')
        .mockResolvedValue([webhookWithStatsFactory()]);

      await webhookDispatcherService.refreshWebhookMap();

      expect(getAllActiveSpy).toHaveBeenCalledTimes(1);
    });

    it('should update webhooks in the map', async () => {
      const webhooks = [
        webhookWithStatsFactory({ isActive: true }),
        webhookWithStatsFactory({ isActive: true }),
        webhookWithStatsFactory({ isActive: true }),
      ];
      const getAllActiveSpy = jest
        .spyOn(webhookDispatcherService, 'getAllActive')
        .mockResolvedValue(webhooks);

      expect(webhookDispatcherService.getCachedActiveWebhooks().length).toBe(0);

      await webhookDispatcherService.refreshWebhookMap();

      expect(webhookDispatcherService.getCachedActiveWebhooks().length).toBe(3);
      expect(getAllActiveSpy).toHaveBeenCalledTimes(1);

      expect(webhookDispatcherService.getCachedActiveWebhooks()).toEqual(
        webhooks,
      );
    });

    it('should update existing active webhooks in the map', async () => {
      const webhook = webhookWithStatsFactory({
        url: 'https://any.com',
        isActive: true,
      });
      const webhookUpdated = new WebhookWithStats();
      Object.assign(webhookUpdated, webhook);
      webhookUpdated.url = 'https://updated.com';
      const getAllActiveSpy = jest
        .spyOn(webhookDispatcherService, 'getAllActive')
        .mockResolvedValueOnce([webhook])
        .mockResolvedValueOnce([webhookUpdated])
        .mockResolvedValueOnce([]);
      expect(webhookDispatcherService.getCachedActiveWebhooks().length).toBe(0);
      // Should update the map with webhook with old url
      await webhookDispatcherService.refreshWebhookMap();
      expect(getAllActiveSpy).toHaveBeenCalledTimes(1);
      expect(webhookDispatcherService.getCachedActiveWebhooks().length).toBe(1);
      expect(webhookDispatcherService.getCachedActiveWebhooks()[0]).toEqual(
        webhook,
      );
      // Should update the map with webhook with new url
      await webhookDispatcherService.refreshWebhookMap();
      expect(getAllActiveSpy).toHaveBeenCalledTimes(2);
      expect(webhookDispatcherService.getCachedActiveWebhooks()[0]).toEqual(
        webhookUpdated,
      );
      // Should remove the webhooks if there are not any active
      await webhookDispatcherService.refreshWebhookMap();
      expect(getAllActiveSpy).toHaveBeenCalledTimes(3);
      expect(webhookDispatcherService.getCachedActiveWebhooks()).toEqual([]);
    });
  });

  describe('Test refreshWebhookMap', () => {
    it('should not disable any webhook if all webhooks are healthy', async () => {
      const healthyWebhook = webhookWithStatsFactory({ isActive: true });
      healthyWebhook.getFailureRate = jest.fn().mockReturnValue(30);
      const getCachedActiveWebhooksSpy = jest
        .spyOn(webhookDispatcherService, 'getCachedActiveWebhooks')
        .mockReturnValue([healthyWebhook]);
      const disableWebhookSpy = jest.spyOn(
        webhookDispatcherService,
        'disableWebhook',
      );

      await webhookDispatcherService.checkWebhooksHealth();

      expect(getCachedActiveWebhooksSpy).toHaveBeenCalledTimes(1);
      expect(disableWebhookSpy).not.toHaveBeenCalled();
    });
    it('should not disable any webhook even not healthy because time window was not passed', async () => {
      const healthyWebhook = webhookWithStatsFactory({ isActive: true });
      healthyWebhook.getFailureRate = jest.fn().mockReturnValue(30);
      const unHealthyWebhook = webhookWithStatsFactory({ isActive: true });
      unHealthyWebhook.getFailureRate = jest.fn().mockReturnValue(80);
      const getCachedActiveWebhooksSpy = jest
        .spyOn(webhookDispatcherService, 'getCachedActiveWebhooks')
        .mockReturnValue([healthyWebhook, unHealthyWebhook]);
      const disableWebhookSpy = jest.spyOn(
        webhookDispatcherService,
        'disableWebhook',
      );
      expect(unHealthyWebhook.getTimeFromLastCheck()).toBe(0);

      await webhookDispatcherService.checkWebhooksHealth();

      expect(unHealthyWebhook.getTimeFromLastCheck()).toBe(0);
      expect(getCachedActiveWebhooksSpy).toHaveBeenCalledTimes(1);
      expect(disableWebhookSpy).not.toHaveBeenCalled();
    });

    it('should disable any unhealthy webhook when the time window is passed', async () => {
      const healthyWebhook = webhookWithStatsFactory({ isActive: true });
      healthyWebhook.getFailureRate = jest.fn().mockReturnValue(30);
      const unHealthyWebhook = webhookWithStatsFactory({ isActive: true });
      unHealthyWebhook.getFailureRate = jest.fn().mockReturnValue(80);
      const getCachedActiveWebhooksSpy = jest
        .spyOn(webhookDispatcherService, 'getCachedActiveWebhooks')
        .mockReturnValue([healthyWebhook, unHealthyWebhook]);
      const disableWebhookSpy = jest.spyOn(
        webhookDispatcherService,
        'disableWebhook',
      );
      expect(unHealthyWebhook.getTimeFromLastCheck()).toBe(0);
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
      await jest.advanceTimersByTimeAsync(60000);
      expect(unHealthyWebhook.getTimeFromLastCheck()).toBe(1);

      await webhookDispatcherService.checkWebhooksHealth();

      expect(getCachedActiveWebhooksSpy).toHaveBeenCalledTimes(1);
      expect(disableWebhookSpy).toHaveBeenCalledWith(unHealthyWebhook.id);

      jest.useRealTimers();
    });
  });
});
