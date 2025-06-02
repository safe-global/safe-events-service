import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWebhookId1747217443681 implements MigrationInterface {
  name = 'AddWebhookId1747217443681';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Update id
    await queryRunner.query(
      `ALTER TABLE "webhook" DROP CONSTRAINT "PK_e6765510c2d078db49632b59020"`,
    );
    await queryRunner.query(`ALTER TABLE "webhook" DROP COLUMN "id"`);
    await queryRunner.query(
      `ALTER TABLE "webhook" ADD "id" uuid NOT NULL DEFAULT uuid_generate_v4()`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook" ADD CONSTRAINT "PK_e6765510c2d078db49632b59020" PRIMARY KEY ("id")`,
    );
    // Update url column
    await queryRunner.query(
      'ALTER TABLE "webhook" ALTER COLUMN "url" TYPE character varying(300);',
    );
    await queryRunner.query(
      `ALTER TABLE "webhook" ADD CONSTRAINT "UQ_1d66ccfc5321ea9310100a77cf6" UNIQUE ("url")`,
    );
    // Update description column
    await queryRunner.query(
      `ALTER TABLE "webhook" ALTER COLUMN "description" TYPE character varying(300);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback migration for description
    await queryRunner.query(
      `ALTER TABLE "webhook" ALTER COLUMN "description" TYPE character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook" DROP CONSTRAINT "UQ_1d66ccfc5321ea9310100a77cf6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook" ALTER COLUMN "url" TYPE character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook" DROP CONSTRAINT "PK_e6765510c2d078db49632b59020"`,
    );
    await queryRunner.query(`ALTER TABLE "webhook" DROP COLUMN "id"`);
    await queryRunner.query(`ALTER TABLE "webhook" ADD "id" SERIAL NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "webhook" ADD CONSTRAINT "PK_e6765510c2d078db49632b59020" PRIMARY KEY ("id")`,
    );
  }
}
