import { MigrationInterface, QueryRunner } from 'typeorm';

export class Initial1687522269061 implements MigrationInterface {
  name = 'Initial1687522269061';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "webhook" ("id" SERIAL NOT NULL, "url" character varying NOT NULL, "description" character varying NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "sendConfirmations" boolean NOT NULL DEFAULT true, "sendMultisigTxs" boolean NOT NULL DEFAULT true, "sendEtherTransfers" boolean NOT NULL DEFAULT true, "sendTokenTransfers" boolean NOT NULL DEFAULT true, "sendModuleTransactions" boolean NOT NULL DEFAULT true, "sendSafeCreations" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_e6765510c2d078db49632b59020" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "webhook"`);
  }
}
