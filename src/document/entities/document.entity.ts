import { Deal } from 'src/deal/entities/deal.entity';
import { Model } from 'src/model/entities/model.entity';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  DocumentMetaI,
  ExtractedDataI,
  PostProcessedDataI,
  T12CategorizationI,
} from '../interfaces/document.entitiy.interfaces';
import { DocumentStatusENUM } from 'src/utilities/constants';

@Entity('fincasa_documents')
export class Document {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  documentName: string;

  @Column({ nullable: true })
  dealId: number;

  @Column({ nullable: true })
  conversationId: string;

  @Column({ default: DocumentStatusENUM.UPLOADED })
  status: string;

  @Column({ type: 'jsonb', nullable: true })
  extractionData: ExtractedDataI;

  @Column({ type: 'jsonb', nullable: true })
  postProcessedData: PostProcessedDataI;

  @Column()
  inputFileURL: string;

  @Column({ nullable: true })
  extractedFileURL?: string;

  @Column({ default: 'others', nullable: true })
  fileType: string;

  @Column({ type: 'jsonb', nullable: true })
  meta?: DocumentMetaI;

  @Column({ type: 'jsonb', nullable: true })
  map?: any;

  @Column({ type: 'jsonb', nullable: true })
  summary: any;

  @Column({ type: 'jsonb', nullable: true })
  categorization?: T12CategorizationI;

  @Column({ nullable: true })
  postProcessedDataURL: string;

  @Column({})
  userId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date;

  @ManyToOne(() => Deal, (deal) => deal.documents)
  deal: Deal;
}
