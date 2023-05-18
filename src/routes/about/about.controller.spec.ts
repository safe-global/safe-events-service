import { Test, TestingModule } from '@nestjs/testing';
import { AboutController } from './about.controller';
import { AboutService } from './about.service';
import { About } from './entities/about.entity';
/* eslint-disable */
const { version } = require('../../../package.json');
/* eslint-enable */

describe('AppController', () => {
  let aboutController: AboutController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AboutController],
      providers: [AboutService],
    }).compile();

    aboutController = app.get<AboutController>(AboutController);
  });

  describe('GET /about', () => {
    it('Success', () => {
      const expected: About = { name: 'Safe Events Service', version: version };
      expect(aboutController.getAbout()).toStrictEqual(expected);
    });
  });
});
