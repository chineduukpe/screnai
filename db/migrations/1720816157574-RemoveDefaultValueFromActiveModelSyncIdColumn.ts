import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveDefaultValueFromActiveModelSyncIdColumn1720816157574
  implements MigrationInterface
{
  name = 'RemoveDefaultValueFromActiveModelSyncIdColumn1720816157574';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" DROP CONSTRAINT "FK_f93a53d2b563dc859d8e95f5706"`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" ALTER COLUMN "activeModelSyncId" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" ADD CONSTRAINT "FK_f93a53d2b563dc859d8e95f5706" FOREIGN KEY ("activeModelSyncId") REFERENCES "fincasa_models"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" DROP CONSTRAINT "FK_f93a53d2b563dc859d8e95f5706"`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" ALTER COLUMN "activeModelSyncId" SET DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincasa_deals" ADD CONSTRAINT "FK_f93a53d2b563dc859d8e95f5706" FOREIGN KEY ("activeModelSyncId") REFERENCES "fincasa_models"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
