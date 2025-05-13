import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWebhookId1747148540092 implements MigrationInterface {
    name = 'AddWebhookId1747148540092'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "webhook" DROP COLUMN "isActive"`);
        await queryRunner.query(`ALTER TABLE "webhook" ADD "public_id" uuid NOT NULL DEFAULT uuid_generate_v4()`);
        await queryRunner.query(`ALTER TABLE "webhook" ADD CONSTRAINT "UQ_77acaae49602ae8e0a54c08bde9" UNIQUE ("public_id")`);
        await queryRunner.query(`ALTER TABLE "webhook" ADD "is_active" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "webhook" DROP COLUMN "url"`);
        await queryRunner.query(`ALTER TABLE "webhook" ADD "url" character varying(300) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "webhook" DROP COLUMN "description"`);
        await queryRunner.query(`ALTER TABLE "webhook" ADD "description" character varying(300) NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "webhook" DROP COLUMN "description"`);
        await queryRunner.query(`ALTER TABLE "webhook" ADD "description" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "webhook" DROP COLUMN "url"`);
        await queryRunner.query(`ALTER TABLE "webhook" ADD "url" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "webhook" DROP COLUMN "is_active"`);
        await queryRunner.query(`ALTER TABLE "webhook" DROP CONSTRAINT "UQ_77acaae49602ae8e0a54c08bde9"`);
        await queryRunner.query(`ALTER TABLE "webhook" DROP COLUMN "public_id"`);
        await queryRunner.query(`ALTER TABLE "webhook" ADD "isActive" boolean NOT NULL DEFAULT true`);
    }

}
