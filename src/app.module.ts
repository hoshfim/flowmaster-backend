import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { BillingModule } from './billing/billing.module';
import { LiquidityModule } from './liquidity/liquidity.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AuditModule } from './audit/audit.module';
import { User } from './users/user.entity';
import { ConnectedAccount } from './users/connected-account.entity';
import { FinancialEvent } from './dashboard/financial-event.entity';
import { LiquidityRequest } from './liquidity/liquidity-request.entity';
import { AuditLog } from './audit/audit-log.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        url: process.env.DATABASE_URL,
        entities: [User, ConnectedAccount, FinancialEvent, LiquidityRequest, AuditLog],
        synchronize: true
      })
    }),
    UsersModule,
    BillingModule,
    LiquidityModule,
    DashboardModule,
    AuditModule
  ]
})
export class AppModule {}