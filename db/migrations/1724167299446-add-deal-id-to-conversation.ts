import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDealIdToConversation1724167299446
  implements MigrationInterface
{
  name = 'AddDealIdToConversation1724167299446';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "conversations" ADD "dealId" integer`);
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "fullName" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "fullName" SET NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "dealId"`);
  }
}
