import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrganizationIdNullable1719260728880 implements MigrationInterface {
  name = 'OrganizationIdNullable1719260728880';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" ALTER COLUMN "organizationId" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" ALTER COLUMN "organizationId" SET NOT NULL`,
    );
  }
}
