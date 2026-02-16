import { FastifyPluginAsync } from 'fastify';
import { randomBytes } from 'crypto';
import { verifyDynamicSchema, verifyTokenSchema } from '@mirrormarkets/shared';
import { DynamicAdapter } from '../adapters/dynamic.adapter.js';
import { CrossmintAuthAdapter } from '../adapters/crossmint-auth.adapter.js';
import { AuditService } from '../services/audit.service.js';

const dynamicAdapter = new DynamicAdapter();
const crossmintAuthAdapter = new CrossmintAuthAdapter();

export const authRoutes: FastifyPluginAsync = async (app) => {
  const audit = new AuditService(app.prisma);

  // POST /auth/crossmint/verify
  app.post('/crossmint/verify', async (request, reply) => {
    const { token, email: bodyEmail } = verifyTokenSchema.parse(request.body);
    const { userId: crossmintId, email: jwtEmail } = await crossmintAuthAdapter.verifyToken(token);
    const email = jwtEmail ?? bodyEmail;

    // Upsert user by crossmintId
    let user = await app.prisma.user.findUnique({ where: { crossmintId } });
    if (user) {
      user = await app.prisma.user.update({
        where: { crossmintId },
        data: { ...(email ? { email } : {}) },
      });
    } else if (email) {
      // Check if a user with this email already exists (migrating from Dynamic)
      const existingByEmail = await app.prisma.user.findUnique({ where: { email } });
      if (existingByEmail) {
        user = await app.prisma.user.update({
          where: { id: existingByEmail.id },
          data: { crossmintId },
        });
      } else {
        user = await app.prisma.user.create({
          data: { crossmintId, email },
        });
      }
    } else {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Email is required for new user registration',
      });
    }

    // Create session
    const sessionToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await app.prisma.authSession.create({
      data: {
        userId: user.id,
        token: sessionToken,
        expiresAt,
      },
    });

    await audit.log({
      userId: user.id,
      action: 'USER_CREATED',
      details: { email },
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
    });
  });

  // POST /auth/dynamic/verify (kept temporarily for active sessions)
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

    await app.prisma.authSession.create({
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
