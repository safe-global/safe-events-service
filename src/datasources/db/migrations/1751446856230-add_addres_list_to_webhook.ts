import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAddresListToWebhook1751446856230 implements MigrationInterface {
  name = 'AddAddresListToWebhook1751446856230';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "webhook" ADD "addresses" character varying array NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "webhook" DROP COLUMN "addresses"`);
  }
}
