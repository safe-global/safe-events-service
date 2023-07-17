import { MigrationInterface, QueryRunner } from 'typeorm';

export class WebhookAuthorization1689597925334 implements MigrationInterface {
  name = 'WebhookAuthorization1689597925334';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "webhook" ADD "authorization" character varying NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "webhook" DROP COLUMN "authorization"`,
    );
  }
}
