//backend/src/audit/audit-log.entity.ts
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @ManyToOne(() => User, (user) => user.auditLogs, { nullable: true })
  user: User | null;
  @Column()
  actionType: string;
  @Column({ type: 'jsonb', nullable: true })
  metadata: any;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
 