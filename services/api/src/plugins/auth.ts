import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { UnauthorizedError } from '@mirrormarkets/shared';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    sessionId: string;
  }
}

const authPluginImpl: FastifyPluginAsync = async (app) => {
  app.decorateRequest('userId', '');
  app.decorateRequest('sessionId', '');

  app.decorate('authenticate', async (request: FastifyRequest) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }

    const token = authHeader.slice(7);

    const session = await app.prisma.authSession.findUnique({
      where: { token },
      select: { id: true, userId: true, expiresAt: true },
    });

    if (!session) {
      throw new UnauthorizedError('Invalid session token');
    }

    if (session.expiresAt < new Date()) {
      await app.prisma.authSession.delete({ where: { id: session.id } });
      throw new UnauthorizedError('Session expired');
    }

    request.userId = session.userId;
    request.sessionId = session.id;
  });
};

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
  }
}

export const authPlugin = fp(authPluginImpl, {
  name: 'auth',
  dependencies: ['prisma'],
});
