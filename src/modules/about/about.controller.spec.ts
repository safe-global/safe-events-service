import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AboutController } from './about.controller';
import { AboutService } from './about.service';
import { About } from './entities/about.entity';
/* eslint-disable */
const { version } = require('../../../package.json');
/* eslint-enable */

describe('AppController', () => {
  const commit = 'a618123e4f0c3b1d2e5f6a7b8c9d0e1f2a3b4c5d';

  async function buildController(
    buildCommit: string,
  ): Promise<AboutController> {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AboutController],
      providers: [
        AboutService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(buildCommit) },
        },
      ],
    }).compile();

    return app.get<AboutController>(AboutController);
  }

  describe('GET /about', () => {
    it('Success', async () => {
      const aboutController = await buildController(commit);
      const expected: About = {
        name: 'Safe Events Service',
        version: version,
        buildCommit: commit,
      };
      expect(aboutController.getAbout()).toStrictEqual(expected);
    });

    it('Returns null buildCommit when BUILD_COMMIT is empty', async () => {
      const aboutController = await buildController('');
      const expected: About = {
        name: 'Safe Events Service',
        version: version,
        buildCommit: null,
      };
      expect(aboutController.getAbout()).toStrictEqual(expected);
    });
  });
});
