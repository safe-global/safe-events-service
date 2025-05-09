import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWebhookId1746717193395 implements MigrationInterface {
  name = 'AddWebhookId1746717193395';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "webhook" ADD "public_id" uuid NOT NULL DEFAULT uuid_generate_v4()`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook" ADD CONSTRAINT "UQ_77acaae49602ae8e0a54c08bde9" UNIQUE ("public_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "webhook" DROP CONSTRAINT "UQ_77acaae49602ae8e0a54c08bde9"`,
    );
    await queryRunner.query(`ALTER TABLE "webhook" DROP COLUMN "public_id"`);
  }
}
