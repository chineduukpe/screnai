import { User } from 'src/user/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrganizationSubscriptionI } from '../interfaces/organization-subscription.interface';
import { Model } from '../../model/entities/model.entity';

@Entity()
export class Organization {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  slug: string;

  @OneToMany(() => User, (user) => user.organization, {
    nullable: true,
  })
  users: User[];

  @Column({ nullable: true })
  owner: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date;

  @Column({ nullable: true, type: 'jsonb' })
  subscription: OrganizationSubscriptionI;

  @OneToMany(() => Model, (model) => model.organization)
  models: Model[];

  // @OneToMany(() => Deal, (deal) => deal.organization)
  // deals: Deal[];
}
