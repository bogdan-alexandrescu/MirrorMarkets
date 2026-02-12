import { FastifyPluginAsync } from 'fastify';
import { randomBytes } from 'crypto';
import { verifyDynamicSchema } from '@mirrormarkets/shared';
import { DynamicAdapter } from '../adapters/dynamic.adapter.js';
import { AuditService } from '../services/audit.service.js';

const dynamicAdapter = new DynamicAdapter();

export const authRoutes: FastifyPluginAsync = async (app) => {
  const audit = new AuditService(app.prisma);

  // POST /auth/dynamic/verify
  app.post('/dynamic/verify', async (request, reply) => {
    const { token } = verifyDynamicSchema.parse(request.body);
    const jwt = await dynamicAdapter.verifyToken(token);

    // Upsert user
    const user = await app.prisma.user.upsert({
      where: { dynamicId: jwt.sub },
      create: {
        dynamicId: jwt.sub,
        email: jwt.email,
      },
      update: {
        email: jwt.email,
      },
    });

    // Create session
    const sessionToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const session = await app.prisma.authSession.create({
      data: {
        userId: user.id,
        token: sessionToken,
        expiresAt,
      },
    });

    // Extract Dynamic EOA address from verified credentials
    const eoaCredential = jwt.verified_credentials?.find(
      (c) => c.format === 'blockchain' && c.chain === 'eip155',
    );

    await audit.log({
      userId: user.id,
      action: 'USER_CREATED',
      details: { email: jwt.email },
      ipAddress: request.ip,
    });

    return reply.send({
      token: sessionToken,
      expiresAt: expiresAt.toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      dynamicEoaAddress: eoaCredential?.address ?? null,
    });
  });

  // POST /auth/logout
  app.post('/logout', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    await app.prisma.authSession.delete({
      where: { id: request.sessionId },
    });
    return reply.send({ ok: true });
  });
};
