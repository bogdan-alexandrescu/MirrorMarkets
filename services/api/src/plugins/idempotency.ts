import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { ConflictError, ErrorCodes } from '@mirrormarkets/shared';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const idempotencyPluginImpl: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', async (request, reply) => {
    // Only apply to mutating methods
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return;

    const idempotencyKey = request.headers['idempotency-key'] as string | undefined;
    if (!idempotencyKey) return;

    const existing = await app.prisma.idempotencyKey.findUnique({
      where: { key: idempotencyKey },
    });

    if (existing) {
      if (existing.endpoint !== `${request.method} ${request.url}`) {
        throw new ConflictError(
          ErrorCodes.IDEMPOTENCY_CONFLICT,
          'Idempotency key already used for a different endpoint',
        );
      }

      // Replay the stored response
      return reply.status(existing.statusCode).send(existing.responseBody);
    }

    // Store the key for post-response saving
    (request as any)._idempotencyKey = idempotencyKey;
  });

  app.addHook('onSend', async (request, reply, payload) => {
    const key = (request as any)._idempotencyKey as string | undefined;
    if (!key || !request.userId) return payload;

    try {
      const responseBody = typeof payload === 'string' ? JSON.parse(payload) : payload;
      await app.prisma.idempotencyKey.create({
        data: {
          key,
          userId: request.userId,
          endpoint: `${request.method} ${request.url}`,
          statusCode: reply.statusCode,
          responseBody,
          expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
        },
      });
    } catch {
      // Ignore duplicate key errors in race conditions
    }

    return payload;
  });
};

export const idempotencyPlugin = fp(idempotencyPluginImpl, {
  name: 'idempotency',
  dependencies: ['prisma'],
});
