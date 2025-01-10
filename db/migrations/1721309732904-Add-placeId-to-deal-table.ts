import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlaceIdToDealTable1721309732904 implements MigrationInterface {
  name = 'AddPlaceIdToDealTable1721309732904';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" DROP COLUMN "vectorStore"`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" ADD "placeId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" ALTER COLUMN "propertyId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_email_document" ALTER COLUMN "status" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_email_document" ALTER COLUMN "dealId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_email_document" ALTER COLUMN "documentType" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" ADD CONSTRAINT "FK_79ef086de828c1e37381f83e33f" FOREIGN KEY ("propertyId") REFERENCES "fincasa_properties"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" DROP CONSTRAINT "FK_79ef086de828c1e37381f83e33f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_email_document" ALTER COLUMN "documentType" SET DEFAULT 'unknown'`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_email_document" ALTER COLUMN "dealId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_email_document" ALTER COLUMN "status" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" ALTER COLUMN "propertyId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" DROP COLUMN "placeId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" ADD "vectorStore" jsonb`,
    );
  }
}
