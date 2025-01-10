import { Organization } from 'src/organization/entities/organization.entity';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  AutomationI,
  ModelAutomationMetaI,
  ModelMappingI,
} from '../interfaces/model-automation.interface';
import { Deal } from '../../deal/entities/deal.entity';
import { ModelBenchamarkI } from '../interfaces/model-benchmark.interface';

@Entity('fincasa_models')
export class Model {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  modelName: string;

  @Column()
  modelDocumentURL: string;

  @Column({ nullable: true })
  documentName: string;

  @ManyToOne(() => Organization, (organization) => organization.models, {
    nullable: true,
  })
  organization: Organization;

  @Column({ nullable: true })
  organizationId: number;

  @Column({ nullable: true })
  userId: string;

  @Column({ nullable: true, type: 'jsonb' })
  modelAutomation: AutomationI[];

  @Column({ nullable: true, type: 'jsonb' })
  modelBenchmark: ModelBenchamarkI[];

  @Column({ nullable: true, type: 'jsonb' })
  meta: ModelAutomationMetaI;

  @Column({ nullable: true, type: 'jsonb' })
  modelMapping: ModelMappingI[];

  @Column({ nullable: true })
  modelMSGraphURL: string;

  @Column({ default: false })
  isDefault: boolean;

  @Column({ nullable: true })
  conversationId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date;

  @OneToMany(() => Deal, (deal) => deal.activeModel)
  activeDeals: Deal[];
}
