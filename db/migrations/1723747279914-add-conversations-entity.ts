import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConversationsEntity1723747279914 implements MigrationInterface {
  name = 'AddConversationsEntity1723747279914';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "conversations" ("id" SERIAL NOT NULL, "conversationId" character varying NOT NULL, "messages" jsonb, "organizationId" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_ee34f4f7ced4ec8681f26bf04ef" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "conversations"`);
  }
}
