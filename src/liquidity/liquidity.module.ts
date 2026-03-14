//backend/src/liquidity/liquidity.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LiquidityRequest } from './liquidity-request.entity';
import { LiquidityService } from './liquidity.service';
import { LiquidityController } from './liquidity.controller';
import { FinancialEvent } from '../dashboard/financial-event.entity';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
@Module({
  imports: [
    TypeOrmModule.forFeature([LiquidityRequest, FinancialEvent]),
    UsersModule,
    AuditModule
  ],
  providers: [LiquidityService],
  controllers: [LiquidityController]
})
export class LiquidityModule {}