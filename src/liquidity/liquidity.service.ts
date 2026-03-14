//backend/src/liquidity/liquidity.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LiquidityRequest } from './liquidity-request.entity';
import { FinancialEvent } from '../dashboard/financial-event.entity';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
@Injectable()
export class LiquidityService {
  constructor(
    @InjectRepository(LiquidityRequest)
    private readonly reqRepo: Repository<LiquidityRequest>,
    @InjectRepository(FinancialEvent)
    private readonly eventsRepo: Repository<FinancialEvent>,
    private readonly usersService: UsersService,
    private readonly auditService: AuditService
  ) {}
  async createRequest(userId: string, amountToLiquidate: number) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    const events = await this.eventsRepo.find({ where: { user: { id: userId } } });
    const pendingAmount = events
      .filter((e) => e.status === 'pending')
      .reduce((s, e) => s + Number(e.amount), 0);
    const avgMonthlyRevenue = 45000; // placeholder
    const riskScore = 'A'; // placeholder
    const payload = {
      request_id: 'REQ-' + Date.now(),
      user_data: {
        company_id: user.email,
        avg_monthly_revenue: avgMonthlyRevenue,
        risk_score: riskScore
      },
      collateral: {
        source: 'Unified_Reserve',
        pending_amount: pendingAmount,
        currency: 'USD',
        expected_release_date: new Date().toISOString().slice(0, 10)
      },
      request: {
        amount_to_liquidate: amountToLiquidate,
        platform_fee: 1.5
      }
    };
    const entity = this.reqRepo.create({
      user,
      requestedAmount: amountToLiquidate,
      feePercentage: 1.5,
      partnerJsonPayload: payload
    });
    const saved = await this.reqRepo.save(entity);
    await this.auditService.log(userId, 'liquidity_request_created', {
      liquidityRequestId: saved.id,
      payload
    });
    // Here you would call the external financial partner API with "payload"
    return payload;
  }
}