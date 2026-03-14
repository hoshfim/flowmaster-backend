//backend/src/liquidity/liquidity-request.entity.ts
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';
@Entity('liquidity_requests')
export class LiquidityRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @ManyToOne(() => User, (user) => user.liquidityRequests)
  user: User;
  @Column('numeric')
  requestedAmount: number;
  @Column('numeric')
  feePercentage: number;
  @Column({ default: 'pending' })
  partnerStatus: 'pending' | 'approved' | 'funded' | 'rejected';
  @Column({ type: 'jsonb', nullable: true })
  partnerJsonPayload: any;
  @Column({ type: 'jsonb', nullable: true })
  partnerResponseJson: any;
}