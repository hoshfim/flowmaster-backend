//backend/src/liquidity/liquidity.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { LiquidityService } from './liquidity.service';
@Controller('liquidity')
export class LiquidityController {
  constructor(private readonly liquidityService: LiquidityService) {}
  @Post('request')
  async request(@Body() body: { userId: string; amountToLiquidate: number }) {
    return this.liquidityService.createRequest(body.userId, body.amountToLiquidate);
  }
}