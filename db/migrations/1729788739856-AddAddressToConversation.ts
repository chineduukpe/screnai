import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAddressToConversation1729788739856
  implements MigrationInterface
{
  name = 'AddAddressToConversation1729788739856';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD "address" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP COLUMN "address"`,
    );
  }
}
