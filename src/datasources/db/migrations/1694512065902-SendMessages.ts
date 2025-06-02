import { MigrationInterface, QueryRunner } from 'typeorm';

export class SendMessages1694512065902 implements MigrationInterface {
  name = 'SendMessages1694512065902';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "webhook" ADD "sendMessages" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "webhook" DROP COLUMN "sendMessages"`);
  }
}
