import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvestmentMemoToConversation1727092591452
  implements MigrationInterface
{
  name = 'AddInvestmentMemoToConversation1727092591452';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD "investmentMemo" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP COLUMN "investmentMemo"`,
    );
  }
}
