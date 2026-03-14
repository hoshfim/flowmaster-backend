//backend/src/billing/billing.service.ts
import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
@Injectable()
export class BillingService {
  private stripe: Stripe;
  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UsersService
  ) {
	this.stripe = new Stripe(
	  this.config.getOrThrow<string>('STRIPE_SECRET_KEY'),
	  { apiVersion: '2024-06-20' }
	);
  }
  async createCheckoutSession(userId: string, priceId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: user.stripeCustomerId || undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: this.config.get('FRONTEND_URL') + '/dashboard',
      cancel_url: this.config.get('FRONTEND_URL') + '/billing'
    });
    return { url: session.url };
  }
}