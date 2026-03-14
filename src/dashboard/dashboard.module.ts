//backend/src/dashboard/dashboard.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinancialEvent } from './financial-event.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
@Module({
  imports: [TypeOrmModule.forFeature([FinancialEvent])],
  providers: [DashboardService],
  controllers: [DashboardController]
})
export class DashboardModule {}