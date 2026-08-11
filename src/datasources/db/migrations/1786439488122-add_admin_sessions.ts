import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminSessions1786439488122 implements MigrationInterface {
  name = 'AddAdminSessions1786439488122';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "admin_sessions" ("sid" character varying NOT NULL, "sess" json NOT NULL, "expire" TIMESTAMP(6) NOT NULL, CONSTRAINT "PK_admin_sessions_sid" PRIMARY KEY ("sid"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_admin_sessions_expire" ON "admin_sessions" ("expire")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "admin_sessions"`);
  }
}
