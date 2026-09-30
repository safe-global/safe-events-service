import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { About } from './entities/about.entity';
/* eslint-disable */
const { version } = require('../../../package.json');
/* eslint-enable */

@Injectable()
export class AboutService {
  constructor(private readonly configService: ConfigService) {}

  getAbout(): About {
    return {
      name: 'Safe Events Service',
      version: version,
      // A Docker build without the argument still sets the variable, empty
      buildCommit: this.configService.get('BUILD_COMMIT', '') || null,
    };
  }
}
