//backend/src/dashboard/dashboard.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FinancialEvent } from './financial-event.entity';
@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(FinancialEvent)
    private readonly eventsRepo: Repository<FinancialEvent>
  ) {}
  async getSummary(userId: string) {
    const events = await this.eventsRepo.find({
      where: { user: { id: userId } }
    });
    const availableToday = events
      .filter((e) => e.status === 'cleared')
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const inTransit = events
      .filter((e) => e.status === 'pending')
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const now = new Date();
    const last30 = events.filter(
      (e) =>
        e.eventType === 'sale' &&
        e.eventDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    );
    const totalLast30 = last30.reduce((s, e) => s + Number(e.amount), 0);
    const avgPerDay = totalLast30 / 30 || 0;
    const forecast14d = avgPerDay * 14;
    return {
      availableToday,
      inTransit,
      forecast14d
    };
  }
}