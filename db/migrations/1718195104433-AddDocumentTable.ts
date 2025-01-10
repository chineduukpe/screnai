import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDocumentTable1718195104433 implements MigrationInterface {
  name = 'AddDocumentTable1718195104433';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "fincasa_documents" ("id" SERIAL NOT NULL, "documentName" character varying NOT NULL, "dealId" integer NOT NULL, "status" character varying, "extractionData" jsonb, "postProcessedData" jsonb, "inputFileURL" character varying, "extractedFileURL" character varying, "fileType" character varying, "meta" jsonb, "map" jsonb, summary jsonb, "userId" character varying NOT NULL , "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_d6df271bba301d5ccff15426ac1" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE fincasa_documents`);
  }
}
