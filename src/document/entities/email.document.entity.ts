import { Status } from '@sentry/node';
import { DocumentStatusENUM } from 'src/utilities/constants';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('fincasa_email_document')
export class EmailDocument {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  email: string;

  @Column()
  subject: string;

  @Column()
  documentURL: string;

  @Column({ default: DocumentStatusENUM.UPLOADED, nullable: true })
  status: string;

  @Column()
  dealId?: number;

  @Column()
  documentType: string;

  @Column()
  sessionId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date;
}
