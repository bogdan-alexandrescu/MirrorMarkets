import { PrismaClient, AuditAction } from '@prisma/client';

export class AuditService {
  constructor(private prisma: PrismaClient) {}

  async log(params: {
    userId?: string;
    action: AuditAction;
    details?: Record<string, unknown>;
    ipAddress?: string;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        details: params.details ? (params.details as any) : undefined,
        ipAddress: params.ipAddress,
      },
    });
  }
}
