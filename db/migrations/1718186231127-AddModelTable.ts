import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddModelTable1718186231127 implements MigrationInterface {
  name = 'AddModelTable1718186231127';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "fincasa_models" ("id" SERIAL NOT NULL, "modelName" character varying NOT NULL, "modelDocumentURL" character varying NOT NULL, "documentName" character varying, "organizationId" integer, "modelAutomation" jsonb, "meta" jsonb, "modelBenchmark" jsonb, "modelMSGraphURL" character varying, "userId" character varying NOT NULL ,"createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_d6df271bba3019462312ac21caa" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP table fincasa_models`);
  }
}
