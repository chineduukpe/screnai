import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPropertyTable1718186564945 implements MigrationInterface {
  name = 'AddPropertyTable1718186564945';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "fincasa_properties" ("id" SERIAL NOT NULL, "propertyName" character varying NOT NULL, "propertyAddress" character varying NOT NULL, "propertyMetrics" jsonb, "yearBuilt" integer, "propertyImages" jsonb, "meta" jsonb, "price" integer, "propertySummary" character varying, "noOfBuildings" integer ,"createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_d6df271bba301d5cc09caff64ff" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE fincasa_properties`);
  }
}
