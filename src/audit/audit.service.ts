//backend/src/audit/audit.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';
@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>
  ) {}
  async log(userId: string | null, actionType: string, metadata: any) {
    const log = this.repo.create({
      user: userId ? ({ id: userId } as any) : null,
      actionType,
      metadata
    });
    await this.repo.save(log);
  }
}