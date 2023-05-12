import { Injectable } from '@nestjs/common';
import {About} from './entities/about.entity';
const { version } = require('../../../package.json');

@Injectable()
export class AboutService {
  getAbout(): About {
    return {
      name: 'Safe Events Service',
      version: version
    };
  }
}
