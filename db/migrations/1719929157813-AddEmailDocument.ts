import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailDocument1719929157813 implements MigrationInterface {
  name = 'AddEmailDocument1719929157813';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "fincasa_email_document" ("id" SERIAL NOT NULL, "email" character varying NOT NULL, "subject" character varying NOT NULL, "documentURL" character varying NOT NULL, "documentType" character varying NOT NULL DEFAULT 'unknown' ,  "status" character varying NOT NULL DEFAULT 'uploaded', "dealId" integer, "sessionId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_75eaabbc0dcec8427a96fdadec1" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "fincasa_email_document"`);
  }
}
