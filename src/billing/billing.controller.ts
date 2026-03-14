//backend/src/billing/billing.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { BillingService } from './billing.service';
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}
  @Post('checkout-session')
  async createCheckout(@Body() body: { userId: string; priceId: string }) {
    return this.billingService.createCheckoutSession(body.userId, body.priceId);
  }
}