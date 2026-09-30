import { ApiProperty } from '@nestjs/swagger';

export class About {
  @ApiProperty()
  name: string;
  @ApiProperty()
  version: string;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Commit the image was built from',
  })
  buildCommit: string | null;
}
