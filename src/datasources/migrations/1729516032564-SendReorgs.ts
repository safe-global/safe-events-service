import { MigrationInterface, QueryRunner } from 'typeorm';

export class SendReorgs1729516032564 implements MigrationInterface {
  name = 'SendReorgs1729516032564';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "webhook" ADD "sendReorgs" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "webhook" DROP COLUMN "sendReorgs"`);
  }
}
