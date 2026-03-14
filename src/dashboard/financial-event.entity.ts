//backend/src/dashboard/financial-event.entity.ts
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';
@Entity('financial_events')
export class FinancialEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @ManyToOne(() => User)
  user: User;
  @Column()
  sourcePlatform: string;
  @Column()
  externalId: string;
  @Column('numeric')
  amount: number;
  @Column()
  currency: string;
  @Column()
  eventType: string; // sale, refund, fee, payout, reserve_increase, reserve_release
  @Column()
  status: string; // pending, cleared
  @Column({ type: 'timestamptz' })
  eventDate: Date;
  @Column({ type: 'timestamptz', nullable: true })
  expectedDate: Date | null;
}