import { MigrationInterface, QueryRunner } from 'typeorm';

export class GenerateBeachheadTable1724779246892 implements MigrationInterface {
  name = 'GenerateBeachheadTable1724779246892';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "beachhead" ("id" SERIAL NOT NULL, "conversationId" character varying NOT NULL, "email" character varying, "messages" jsonb, "rentCastData" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_2dda8106d323f43b830debe0e81" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "beachhead"`);
  }
}
