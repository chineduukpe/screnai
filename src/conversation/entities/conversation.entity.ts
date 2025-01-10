import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ConversationI } from '../dto/create-conversation.dto';
import { Deal } from 'src/deal/entities/deal.entity';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  conversationId: string;

  @Column()
  intent: string;

  @Column({ nullable: true, type: 'jsonb' })
  messages?: ConversationI[];

  @Column({ nullable: true })
  organizationId: number;

  @Column({ nullable: true })
  dealId: number;

  @Column({ nullable: true })
  address: string;

  @Column({ type: 'jsonb', nullable: true })
  data?: any;

  @Column({ type: 'jsonb', nullable: true })
  investmentMemo: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date;

  @JoinColumn({ name: 'dealId', referencedColumnName: 'id' })
  @OneToOne(() => Deal, (deal) => deal.conversation)
  deal: Deal;
}
