import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import {
  ChatHistory,
  DealComparablesI,
  DealMetaI,
} from '../interfaces/entity.interface';
import { Model } from '../../model/entities/model.entity';
import { Document } from 'src/document/entities/document.entity';
import { SyncedModelI } from '../interfaces/model.sync.interface';
import { Property } from 'src/property/entities/property.entity';
import { Conversation } from 'src/conversation/entities/conversation.entity';

@Entity('fincasa_deals')
export class Deal {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  dealName: string;

  @Column({ nullable: true })
  dealAddress?: string;

  @Column({ nullable: true })
  organizationId: number;

  @Column({ nullable: true, default: false })
  notifcationSent: boolean;

  @Column({ nullable: true })
  propertyId: number;

  @Column({ nullable: true })
  placeId: string;

  @Column({ type: 'jsonb', nullable: true })
  investmentMemo?: string[];

  @Column({ nullable: true })
  dealColor?: string;

  @Column({ type: 'jsonb', nullable: true })
  comparables?: DealComparablesI;

  @Column({ type: 'jsonb', nullable: true })
  dealTags?: string[];

  @Column({ type: 'jsonb', nullable: true })
  meta?: DealMetaI;

  @Column({ type: 'jsonb', nullable: true })
  chatHistory?: ChatHistory[];

  @Column({ nullable: true })
  activeModelSyncId?: number;

  @Column({ nullable: true, type: 'jsonb' })
  models?: SyncedModelI[];

  @Column({ nullable: true })
  userId: string;

  @Column({ nullable: true })
  emailThreadId: string;

  @Column({ nullable: true })
  conversationId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date;

  @ManyToOne(() => Model, (model) => model.activeDeals)
  @JoinColumn({ name: 'activeModelSyncId' })
  activeModel: Model;

  @OneToMany(() => Document, (document) => document.deal)
  documents: Document[];

  @ManyToOne(() => Property, (property) => property.deals)
  property: Property;

  @JoinColumn({
    name: 'conversationId',
    referencedColumnName: 'conversationId',
  })
  @OneToOne(() => Conversation, (conversation) => conversation.deal)
  conversation: Conversation;
}
