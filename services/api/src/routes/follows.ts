import { FastifyPluginAsync } from 'fastify';
import { createFollowSchema, ConflictError, ErrorCodes, NotFoundError } from '@mirrormarkets/shared';
import { AuditService } from '../services/audit.service.js';

export const followRoutes: FastifyPluginAsync = async (app) => {
  const audit = new AuditService(app.prisma);

  // POST /follows
  app.post('/', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { leaderAddress } = createFollowSchema.parse(request.body);
    const address = leaderAddress.toLowerCase();

    // Ensure leader exists in DB
    let leader = await app.prisma.leader.findUnique({ where: { address } });

    if (!leader) {
      leader = await app.prisma.leader.create({
        data: { address },
      });
    }

    // Check if already following
    const existing = await app.prisma.follow.findUnique({
      where: { userId_leaderId: { userId: request.userId, leaderId: leader.id } },
    });

    if (existing && existing.status === 'ACTIVE') {
      throw new ConflictError(ErrorCodes.ALREADY_FOLLOWING, 'Already following this leader');
    }

    const follow = await app.prisma.follow.upsert({
      where: { userId_leaderId: { userId: request.userId, leaderId: leader.id } },
      create: {
        userId: request.userId,
        leaderId: leader.id,
        status: 'ACTIVE',
      },
      update: { status: 'ACTIVE' },
      include: { leader: true },
    });

    await audit.log({
      userId: request.userId,
      action: 'FOLLOW_CREATED',
      details: { leaderAddress: address, leaderId: leader.id },
      ipAddress: request.ip,
    });

    return reply.status(201).send(follow);
  });

  // GET /follows
  app.get('/', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const follows = await app.prisma.follow.findMany({
      where: { userId: request.userId, status: 'ACTIVE' },
      include: { leader: true },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send(follows);
  });

  // DELETE /follows/:followId
  app.delete('/:followId', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { followId } = request.params as { followId: string };

    const follow = await app.prisma.follow.findFirst({
      where: { id: followId, userId: request.userId },
    });

    if (!follow) {
      throw new NotFoundError('Follow');
    }

    await app.prisma.follow.update({
      where: { id: followId },
      data: { status: 'REMOVED' },
    });

    await audit.log({
      userId: request.userId,
      action: 'FOLLOW_REMOVED',
      details: { followId, leaderId: follow.leaderId },
      ipAddress: request.ip,
    });

    return reply.send({ ok: true });
  });
};
