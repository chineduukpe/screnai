import { Deal } from 'src/deal/entities/deal.entity';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('fincasa_properties')
export class Property {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  propertyName: string;

  @Column()
  propertyAddress: string;

  @Column({ type: 'jsonb', nullable: true })
  propertyMetrics: any;

  @Column({ nullable: true })
  yearBuilt: number;

  @Column({ nullable: true })
  noOfUnits: number;

  @Column({ nullable: true })
  helloDataID: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  state: string;

  @Column({ nullable: true })
  zipCode: string;

  @Column({ type: 'jsonb', nullable: true })
  propertyImages: Array<{ imageId: string; imageUrl: string }>;

  @Column({ nullable: true })
  price: string;

  @Column({ nullable: true })
  propertySummary: string;

  @Column({ nullable: true })
  noOfBuildings: string;

  @OneToMany(() => Deal, (deal) => deal.property)
  deals: Deal[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
