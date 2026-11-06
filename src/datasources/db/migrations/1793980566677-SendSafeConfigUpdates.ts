import { MigrationInterface, QueryRunner } from 'typeorm';

export class SendSafeConfigUpdates1793980566677 implements MigrationInterface {
  name = 'SendSafeConfigUpdates1793980566677';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "webhook" ADD "sendSafeConfigUpdates" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "webhook" DROP COLUMN "sendSafeConfigUpdates"`,
    );
  }
}
