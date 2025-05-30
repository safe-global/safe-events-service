import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { About } from './entities/about.entity';
import { AboutService } from './about.service';

@Controller({ path: 'about' })
@ApiTags('about')
export class AboutController {
  constructor(private readonly aboutService: AboutService) {}

  @Get()
  @ApiOkResponse({ type: About })
  getAbout(): About {
    return this.aboutService.getAbout();
  }
}
