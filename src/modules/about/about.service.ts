import { Injectable } from '@nestjs/common';
import { About } from './entities/about.entity';
/* eslint-disable */
const { version } = require('../../../package.json');
/* eslint-enable */

@Injectable()
export class AboutService {
  getAbout(): About {
    return {
      name: 'Safe Events Service',
      version: version,
    };
  }
}
