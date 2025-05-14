import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWebhookId1747207597673 implements MigrationInterface {
  name = 'AddWebhookId1747207597673';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "webhook" ADD "publicId" uuid NOT NULL DEFAULT uuid_generate_v4()`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook" ADD CONSTRAINT "UQ_b2a6def3bbe704e4d1122a9ac8a" UNIQUE ("publicId")`,
    );
    await queryRunner.query(`ALTER TABLE "webhook" DROP COLUMN "url"`);
    await queryRunner.query(
      `ALTER TABLE "webhook" ADD "url" character varying(300) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook" ADD CONSTRAINT "UQ_1d66ccfc5321ea9310100a77cf6" UNIQUE ("url")`,
    );
    await queryRunner.query(`ALTER TABLE "webhook" DROP COLUMN "description"`);
    await queryRunner.query(
      `ALTER TABLE "webhook" ADD "description" character varying(300) NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "webhook" DROP COLUMN "description"`);
    await queryRunner.query(
      `ALTER TABLE "webhook" ADD "description" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook" DROP CONSTRAINT "UQ_1d66ccfc5321ea9310100a77cf6"`,
    );
    await queryRunner.query(`ALTER TABLE "webhook" DROP COLUMN "url"`);
    await queryRunner.query(
      `ALTER TABLE "webhook" ADD "url" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook" DROP CONSTRAINT "UQ_b2a6def3bbe704e4d1122a9ac8a"`,
    );
    await queryRunner.query(`ALTER TABLE "webhook" DROP COLUMN "publicId"`);
  }
}
