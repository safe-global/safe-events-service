import { MigrationInterface, QueryRunner } from 'typeorm';

export class SendDelegates1730984672394 implements MigrationInterface {
  name = 'SendDelegates1730984672394';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "webhook" ADD "sendDelegates" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "webhook" DROP COLUMN "sendDelegates"`,
    );
  }
}
