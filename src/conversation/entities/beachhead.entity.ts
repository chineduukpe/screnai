import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ConversationI } from '../dto/create-conversation.dto';

@Entity('beachhead')
export class Beachhead {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  conversationId: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true, type: 'jsonb' })
  messages?: ConversationI[];

  @Column({ type: 'jsonb', nullable: true })
  rentCastData?: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date;
}
