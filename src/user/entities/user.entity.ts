import { Organization } from 'src/organization/entities/organization.entity';
import { Column, Entity, ManyToOne } from 'typeorm';

@Entity()
export class User {
  @Column({ primary: true, unique: true })
  id: string;

  @Column({ nullable: true })
  fullName: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  company: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ nullable: true, default: false })
  completeOnboarding: boolean;

  @Column({ nullable: true })
  whoAreYou: string;

  @Column({ nullable: true, default: 'pending' })
  status: string;

  @Column({ nullable: true })
  invitedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  emailVerifiedAt: Date;

  @Column({ nullable: true })
  organizationId: number;

  @ManyToOne(() => Organization, (organization) => organization.users, {
    nullable: true,
  })
  organization: Organization;
}
