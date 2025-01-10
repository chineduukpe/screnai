import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdatePropertyEntity1718890167745 implements MigrationInterface {
  name = 'UpdatePropertyEntity1718890167745';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "dealId"`);

    await queryRunner.query(
      `ALTER TABLE "fincasa_properties" ADD "noOfUnits" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_properties" ADD "helloDataID" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_properties" ADD "city" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_properties" ADD "state" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_properties" ADD "zipCode" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_documents" ALTER COLUMN "status" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_documents" ALTER COLUMN "status" SET DEFAULT 'uploaded'`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_documents" ALTER COLUMN "inputFileURL" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_documents" ALTER COLUMN "fileType" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_documents" ALTER COLUMN "fileType" SET DEFAULT 'others'`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" ALTER COLUMN "dealName" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" ALTER COLUMN "dealAddress" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" DROP COLUMN "investmentMemo"`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" ADD "investmentMemo" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" ALTER COLUMN "activeModelSyncId" SET DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" ALTER COLUMN "userId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_models" ALTER COLUMN "userId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_properties" DROP COLUMN "price"`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_properties" ADD "price" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_properties" DROP COLUMN "noOfBuildings"`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_properties" ADD "noOfBuildings" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_documents" ADD CONSTRAINT "FK_72d98cae3262c3c59a2e682d970" FOREIGN KEY ("dealId") REFERENCES "fincasa_deals"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" ADD CONSTRAINT "FK_f93a53d2b563dc859d8e95f5706" FOREIGN KEY ("activeModelSyncId") REFERENCES "fincasa_models"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_models" ADD CONSTRAINT "FK_dab3ac737765bfa3917c26c646b" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fincasa_models" DROP CONSTRAINT "FK_dab3ac737765bfa3917c26c646b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" DROP CONSTRAINT "FK_f93a53d2b563dc859d8e95f5706"`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_documents" DROP CONSTRAINT "FK_72d98cae3262c3c59a2e682d970"`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_properties" DROP COLUMN "noOfBuildings"`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_properties" ADD "noOfBuildings" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_properties" DROP COLUMN "price"`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_properties" ADD "price" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_models" ALTER COLUMN "userId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" ALTER COLUMN "userId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" ALTER COLUMN "activeModelSyncId" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" DROP COLUMN "investmentMemo"`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" ADD "investmentMemo" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" ALTER COLUMN "dealAddress" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" ALTER COLUMN "dealName" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_documents" ALTER COLUMN "fileType" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_documents" ALTER COLUMN "fileType" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_documents" ALTER COLUMN "inputFileURL" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_documents" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_documents" ALTER COLUMN "status" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_properties" DROP COLUMN "zipCode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_properties" DROP COLUMN "state"`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_properties" DROP COLUMN "city"`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_properties" DROP COLUMN "helloDataID"`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_properties" DROP COLUMN "noOfUnits"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "dealId" character varying`,
    );
  }
}
