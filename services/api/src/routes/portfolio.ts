import { FastifyPluginAsync } from 'fastify';
import { PortfolioService } from '../services/portfolio.service.js';

export const portfolioRoutes: FastifyPluginAsync = async (app) => {
  const portfolio = new PortfolioService(app.prisma);

  // GET /portfolio/balances
  app.get('/balances', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const balance = await portfolio.getBalance(request.userId);
    return reply.send(balance);
  });

  // GET /portfolio/positions
  app.get('/positions', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const positions = await portfolio.getPositions(request.userId);
    return reply.send(positions);
  });
};
