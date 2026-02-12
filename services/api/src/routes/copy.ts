import { FastifyPluginAsync } from 'fastify';
import { updateCopyProfileSchema, paginationSchema, AppError, ErrorCodes } from '@mirrormarkets/shared';
import { AuditService } from '../services/audit.service.js';

export const copyRoutes: FastifyPluginAsync = async (app) => {
  const audit = new AuditService(app.prisma);

  // PUT /copy/profile
  app.put('/profile', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const data = updateCopyProfileSchema.parse(request.body);

    const profile = await app.prisma.copyProfile.upsert({
      where: { userId: request.userId },
      create: { userId: request.userId, ...data },
      update: data,
    });

    await audit.log({
      userId: request.userId,
      action: 'SETTINGS_UPDATED',
      details: { copyProfile: data },
      ipAddress: request.ip,
    });

    return reply.send(profile);
  });

  // POST /copy/enable
  app.post('/enable', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const profile = await app.prisma.copyProfile.findUnique({
      where: { userId: request.userId },
    });

    if (profile?.status === 'ENABLED') {
      throw new AppError(ErrorCodes.COPY_ALREADY_ENABLED, 'Copy trading already enabled', 409);
    }

    await app.prisma.copyProfile.update({
      where: { userId: request.userId },
      data: { status: 'ENABLED' },
    });

    await audit.log({
      userId: request.userId,
      action: 'COPY_ENABLED',
      ipAddress: request.ip,
    });

    return reply.send({ status: 'ENABLED' });
  });

  // POST /copy/disable
  app.post('/disable', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    await app.prisma.copyProfile.update({
      where: { userId: request.userId },
      data: { status: 'DISABLED' },
    });

    await audit.log({
      userId: request.userId,
      action: 'COPY_DISABLED',
      ipAddress: request.ip,
    });

    return reply.send({ status: 'DISABLED' });
  });

  // GET /copy/profile
  app.get('/profile', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const profile = await app.prisma.copyProfile.findUnique({
      where: { userId: request.userId },
    });

    return reply.send(profile);
  });

  // GET /copy/logs
  app.get('/logs', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { page, pageSize } = paginationSchema.parse(request.query);
    const { leaderId } = request.query as { leaderId?: string };

    const where: any = { userId: request.userId };
    if (leaderId) {
      where.leaderEvent = { leaderId };
    }

    const [items, total] = await Promise.all([
      app.prisma.copyAttempt.findMany({
        where,
        include: { leaderEvent: true, order: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      app.prisma.copyAttempt.count({ where }),
    ]);

    return reply.send({
      items,
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    });
  });

  // GET /copy/logs/stream (SSE)
  app.get('/logs/stream', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const userId = request.userId;

    // Poll for new events every 2 seconds
    let lastId = '';
    const interval = setInterval(async () => {
      try {
        const where: any = { userId };
        if (lastId) {
          where.id = { gt: lastId };
        }

        const attempts = await app.prisma.copyAttempt.findMany({
          where,
          include: { leaderEvent: true },
          orderBy: { createdAt: 'asc' },
          take: 10,
        });

        for (const attempt of attempts) {
          const event = {
            type: 'copy_attempt',
            data: attempt,
            timestamp: new Date().toISOString(),
          };
          reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
          lastId = attempt.id;
        }

        // Also check recent audit logs
        const logs = await app.prisma.auditLog.findMany({
          where: { userId, createdAt: { gte: new Date(Date.now() - 5000) } },
          orderBy: { createdAt: 'asc' },
          take: 10,
        });

        for (const log of logs) {
          const event = {
            type: 'audit',
            data: log,
            timestamp: new Date().toISOString(),
          };
          reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
        }
      } catch {
        // Connection may be closed
      }
    }, 2000);

    request.raw.on('close', () => {
      clearInterval(interval);
    });
  });
};
