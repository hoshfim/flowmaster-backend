//backend/src/users/connected-account.entity.ts
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';
@Entity('connected_accounts')
export class ConnectedAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @ManyToOne(() => User, (user) => user.connectedAccounts)
  user: User;
  @Column()
  platformName: string; // 'shopify' | 'tiktok' | 'amazon' | ...
  @Column()
  accessTokenEnc: string;
  @Column({ nullable: true })
  refreshTokenEnc: string;
  @Column({ nullable: true })
  storeIdentifier: string;
  @Column({ type: 'timestamptz', nullable: true })
  lastSync: Date | null;
}