import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDealTable1718145435405 implements MigrationInterface {
  name = 'AddDealTable1718145435405';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "fincasa_deals" ("id" SERIAL NOT NULL, "dealName" character varying NOT NULL, "dealAddress" character varying NOT NULL, "organizationId" integer NOT NULL, "models" jsonb, "investmentMemo" character varying, "meta" jsonb, "propertyId" integer NOT NULL, "activeModelSyncId" integer, "dealColor" character varying, "dealTags" jsonb, "comparables" jsonb, "userId" character varying NOT NULL ,"createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_d6df271bba301d5cc79462912a4" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "fincasa_deals"`);
  }
}
