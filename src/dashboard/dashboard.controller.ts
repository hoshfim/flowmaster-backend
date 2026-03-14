//backend/src/dashboard/dashboard.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}
  @Get('summary')
  async getSummary(@Query('userId') userId: string) {
    return this.dashboardService.getSummary(userId);
  }
}