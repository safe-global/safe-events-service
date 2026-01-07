import { Test } from '@nestjs/testing';
import { Webhook, WebhookWithStats } from './repositories/webhook.entity';
import { WebhookModule } from './webhook.module';
import { DatabaseModule } from '../../datasources/db/database.module';
import { ConfigModule } from '@nestjs/config';
import { DataSource, Repository, UpdateResult } from 'typeorm';
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
  let webhookRepository: Repository<Webhook>;

  async function createTestingModuleWithEnv(
    autoDisableWebhook: boolean,
    webhookFailureThreshold: number,
    webhookHealthMinutesWindow: number,
  ) {
    // Reset modules to apply new environment variables to ConfigModule
    jest.resetModules();
    // Environment overrides

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot(), WebhookModule, DatabaseModule],
    }).compile();

    const httpService = moduleRef.get<HttpService>(HttpService);
    const webhookDispatcherService = moduleRef.get<WebhookDispatcherService>(
      WebhookDispatcherService,
    );
    // @ts-expect-error: accessing private field for testing purposes
    webhookDispatcherService.autoDisableWebhook = autoDisableWebhook;
    // @ts-expect-error: accessing private field for testing purposes
    webhookDispatcherService.webhookFailureThreshold = webhookFailureThreshold;
    // @ts-expect-error: accessing private field for testing purposes
    webhookDispatcherService.webhookHealthMinutesWindow =
      webhookHealthMinutesWindow;
    const dataSource = moduleRef.get<DataSource>(DataSource);
    const webhookRepository = dataSource.getRepository(Webhook);

    return {
      httpService,
      webhookDispatcherService,
      webhookRepository,
    };
  }

  beforeEach(async () => {
    ({ httpService, webhookDispatcherService, webhookRepository } =
      await createTestingModuleWithEnv(true, 50, 1));
    jest.clearAllMocks();
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

  describe('Test disableWebhook', () => {
    it('should return true if webhook is successfully disabled', async () => {
      const mockedWebhookUpdate = jest
        .spyOn(webhookRepository, 'update')
        .mockResolvedValue({
          affected: 1,
        } as UpdateResult);

      const result = await webhookDispatcherService.disableWebhook('123');

      expect(result).toBe(true);
      expect(mockedWebhookUpdate).toHaveBeenCalledWith(
        { id: '123' },
        { isActive: false },
      );
    });
    it('should return false if webhook is successfully disabled', async () => {
      const mockedWebhookUpdate = jest
        .spyOn(webhookRepository, 'update')
        .mockResolvedValue({
          affected: 0,
        } as UpdateResult);
      const loggerErrorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();

      const result = await webhookDispatcherService.disableWebhook('123');

      expect(result).toBe(false);
      expect(mockedWebhookUpdate).toHaveBeenCalledWith(
        { id: '123' },
        { isActive: false },
      );
      expect(loggerErrorSpy).toHaveBeenCalledWith({
        message: 'Webhook with ID 123 not found or already inactive.',
      });
    });
    it('should catch any exception and return False', async () => {
      const mockedWebhookUpdate = jest
        .spyOn(webhookRepository, 'update')
        .mockRejectedValue(new Error('Database failure'));
      const loggerErrorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();

      const result = await webhookDispatcherService.disableWebhook('123');

      expect(result).toBe(false);
      expect(mockedWebhookUpdate).toHaveBeenCalledWith(
        { id: '123' },
        { isActive: false },
      );
      expect(loggerErrorSpy).toHaveBeenCalledWith({
        message: 'Failed to disable webhook with ID 123: Database failure',
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
      expect(unHealthyWebhook.getMinutesFromStartTime()).toBe(0);

      await webhookDispatcherService.checkWebhooksHealth();

      expect(unHealthyWebhook.getMinutesFromStartTime()).toBe(0);
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
      const disableWebhookSpy = jest
        .spyOn(webhookDispatcherService, 'disableWebhook')
        .mockResolvedValue(true);

      expect(unHealthyWebhook.getMinutesFromStartTime()).toBe(0);
      const getMinutesFromStartTimeSpy = jest
        .spyOn(unHealthyWebhook, 'getMinutesFromStartTime')
        .mockReturnValue(1);
      const loggerWarnSpy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation();

      await webhookDispatcherService.checkWebhooksHealth();

      expect(getCachedActiveWebhooksSpy).toHaveBeenCalledTimes(1);
      expect(getMinutesFromStartTimeSpy).toHaveBeenCalledTimes(1);
      expect(disableWebhookSpy).toHaveBeenCalledWith(unHealthyWebhook.id);
      expect(loggerWarnSpy).toHaveBeenCalledWith({
        message: 'Webhook disabled, failure rate exceeded threshold.',
        messageContext: {
          webhook: {
            id: unHealthyWebhook.id,
            url: unHealthyWebhook.url,
          },
        },
      });
    });
    it('should not disable any unhealthy webhook when the auto disable webhook is false', async () => {
      ({ httpService, webhookDispatcherService, webhookRepository } =
        await createTestingModuleWithEnv(false, 50, 1));
      const healthyWebhook = webhookWithStatsFactory({ isActive: true });
      healthyWebhook.getFailureRate = jest.fn().mockReturnValue(30);
      const unHealthyWebhook = webhookWithStatsFactory({ isActive: true });
      unHealthyWebhook.getFailureRate = jest.fn().mockReturnValue(80);
      const getCachedActiveWebhooksSpy = jest
        .spyOn(webhookDispatcherService, 'getCachedActiveWebhooks')
        .mockReturnValue([healthyWebhook, unHealthyWebhook]);
      const disableWebhookSpy = jest
        .spyOn(webhookDispatcherService, 'disableWebhook')
        .mockResolvedValue(true);
      expect(unHealthyWebhook.getMinutesFromStartTime()).toBe(0);
      const getMinutesFromStartTimeSpy = jest
        .spyOn(unHealthyWebhook, 'getMinutesFromStartTime')
        .mockReturnValue(1);
      const loggerWarnSpy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation();

      await webhookDispatcherService.checkWebhooksHealth();

      expect(getCachedActiveWebhooksSpy).toHaveBeenCalledTimes(1);
      expect(getMinutesFromStartTimeSpy).toHaveBeenCalledTimes(1);
      expect(disableWebhookSpy).not.toHaveBeenCalledWith(unHealthyWebhook.id);
      expect(loggerWarnSpy).toHaveBeenCalledWith({
        message:
          'Webhook exceeded failure threshold but was not disabled (autoDisableWebhook is OFF)',
        messageContext: {
          webhook: {
            id: unHealthyWebhook.id,
            url: unHealthyWebhook.url,
          },
        },
      });
    });
    it('should log error if it was not able to disable the webhook', async () => {
      const healthyWebhook = webhookWithStatsFactory({ isActive: true });
      healthyWebhook.getFailureRate = jest.fn().mockReturnValue(30);
      const unHealthyWebhook = webhookWithStatsFactory({ isActive: true });
      unHealthyWebhook.getFailureRate = jest.fn().mockReturnValue(80);
      const getCachedActiveWebhooksSpy = jest
        .spyOn(webhookDispatcherService, 'getCachedActiveWebhooks')
        .mockReturnValue([healthyWebhook, unHealthyWebhook]);
      const disableWebhookSpy = jest
        .spyOn(webhookDispatcherService, 'disableWebhook')
        .mockResolvedValue(false);

      expect(unHealthyWebhook.getMinutesFromStartTime()).toBe(0);
      const getMinutesFromStartTimeSpy = jest
        .spyOn(unHealthyWebhook, 'getMinutesFromStartTime')
        .mockReturnValue(1);
      const loggerErrorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();

      await webhookDispatcherService.checkWebhooksHealth();

      expect(getCachedActiveWebhooksSpy).toHaveBeenCalledTimes(1);
      expect(getMinutesFromStartTimeSpy).toHaveBeenCalledTimes(1);
      expect(disableWebhookSpy).toHaveBeenCalledWith(unHealthyWebhook.id);
      expect(loggerErrorSpy).toHaveBeenCalledWith({
        message: 'Failed to disable webhook',
        messageContext: {
          webhook: {
            id: unHealthyWebhook.id,
            url: unHealthyWebhook.url,
          },
        },
      });
    });
  });
});
