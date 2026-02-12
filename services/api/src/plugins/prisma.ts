import { PrismaClient } from '@prisma/client';
import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

const prismaPluginImpl: FastifyPluginAsync = async (app) => {
  const prisma = new PrismaClient({
    log: app.log.level === 'debug' ? ['query', 'info', 'warn', 'error'] : ['error'],
  });

  await prisma.$connect();
  app.log.info('Connected to database');

  app.decorate('prisma', prisma);

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
};

export const prismaPlugin = fp(prismaPluginImpl, { name: 'prisma' });
