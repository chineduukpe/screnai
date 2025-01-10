import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConversationIDToDocument1724967716253
  implements MigrationInterface
{
  name = 'AddConversationIDToDocument1724967716253';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fincasa_documents" ADD "conversationId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_documents" DROP CONSTRAINT "FK_72d98cae3262c3c59a2e682d970"`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_documents" ALTER COLUMN "dealId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_documents" ALTER COLUMN "fileType" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_documents" ADD CONSTRAINT "FK_72d98cae3262c3c59a2e682d970" FOREIGN KEY ("dealId") REFERENCES "fincasa_deals"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fincasa_documents" DROP CONSTRAINT "FK_72d98cae3262c3c59a2e682d970"`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_documents" ALTER COLUMN "fileType" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_documents" ALTER COLUMN "dealId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_documents" ADD CONSTRAINT "FK_72d98cae3262c3c59a2e682d970" FOREIGN KEY ("dealId") REFERENCES "fincasa_deals"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_documents" DROP COLUMN "conversationId"`,
    );
  }
}
