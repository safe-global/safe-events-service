import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWebhookId1746626486886 implements MigrationInterface {
  name = 'AddWebhookId1746626486886';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "webhook" ADD "public_id" uuid NOT NULL DEFAULT uuid_generate_v4()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "webhook" DROP COLUMN "public_id"`);
  }
}
