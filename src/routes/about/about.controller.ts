import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { About } from './entities/about.entity';
import { AboutService } from './about.service';

@ApiTags('about')
@Controller({ path: 'about' })
export class AboutController {
  constructor(private readonly aboutService: AboutService) {}

  @ApiOkResponse({ type: About })
  @Get()
  getAbout(): About {
    return this.aboutService.getAbout();
  }
}
