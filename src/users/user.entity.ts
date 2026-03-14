//backend/src/users/user.entity.ts
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ConnectedAccount } from './connected-account.entity';
import { LiquidityRequest } from '../liquidity/liquidity-request.entity';
import { AuditLog } from '../audit/audit-log.entity';
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column({ unique: true })
  email: string;
  @Column({ nullable: true })
  stripeCustomerId: string;
  @Column({ default: 'inactive' })
  status: 'inactive' | 'active' | 'past_due' | 'canceled';
  @OneToMany(() => ConnectedAccount, (acc) => acc.user)
  connectedAccounts: ConnectedAccount[];
  @OneToMany(() => LiquidityRequest, (req) => req.user)
  liquidityRequests: LiquidityRequest[];
  @OneToMany(() => AuditLog, (log) => log.user)
  auditLogs: AuditLog[];
}