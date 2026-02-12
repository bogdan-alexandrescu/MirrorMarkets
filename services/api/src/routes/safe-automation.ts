import { FastifyPluginAsync } from 'fastify';
import {
  enableModuleSchema,
  updateConstraintsSchema,
  updateSigningModeSchema,
  registerSessionKeySchema,
  revokeSessionKeySchema,
  addWithdrawalAllowlistSchema,
  removeWithdrawalAllowlistSchema,
} from '@mirrormarkets/shared';
import { SafeAutomationService } from '../services/safe-automation.service.js';
import { AuditService } from '../services/audit.service.js';

/**
 * Safe Automation routes — Phase 2B
 *
 * POST   /safe-automation/enable          — Enable module on user's Safe
 * POST   /safe-automation/disable         — Disable module
 * GET    /safe-automation/status          — Get module status
 * PUT    /safe-automation/signing-mode    — Update signing mode
 * PUT    /safe-automation/constraints     — Update constraints
 *
 * POST   /safe-automation/session-keys          — Register new session key
 * GET    /safe-automation/session-keys          — List session keys
 * DELETE /safe-automation/session-keys/:id      — Revoke session key
 *
 * GET    /safe-automation/withdrawal-allowlist       — List allowlist
 * POST   /safe-automation/withdrawal-allowlist       — Add address
 * DELETE /safe-automation/withdrawal-allowlist       — Remove address
 *
 * GET    /safe-automation/module-txs             — List recent module transactions
 */
export const safeAutomationRoutes: FastifyPluginAsync = async (app) => {
  const auditService = new AuditService(app.prisma);
  const safeService = new SafeAutomationService(app.prisma, auditService);

  // ── Module Management ────────────────────────────────────────

  // POST /safe-automation/enable
  app.post('/enable', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.userId!;
    const body = enableModuleSchema.parse(request.body);

    const automation = await safeService.enableModule({
      userId,
      safeAddress: body.safeAddress,
      moduleAddress: body.moduleAddress,
      enableTxHash: body.ownerSignature, // The tx hash of the enableModule Safe tx
    });

    return reply.status(201).send({
      id: automation.id,
      safeAddress: automation.safeAddress,
      moduleAddress: automation.moduleAddress,
      enabled: automation.enabled,
      signingMode: automation.signingMode,
      enabledAt: automation.enabledAt?.toISOString(),
    });
  });

  // POST /safe-automation/disable
  app.post('/disable', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.userId!;
    await safeService.disableModule(userId);
    return reply.send({ disabled: true });
  });

  // GET /safe-automation/status
  app.get('/status', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.userId!;
    const automation = await safeService.getAutomation(userId);

    if (!automation) {
      return reply.send({ configured: false });
    }

    const sessionKeys = await safeService.getSessionKeys(userId);
    const allowlist = await safeService.getWithdrawalAllowlist(userId);

    return reply.send({
      configured: true,
      id: automation.id,
      safeAddress: automation.safeAddress,
      moduleAddress: automation.moduleAddress,
      enabled: automation.enabled,
      signingMode: automation.signingMode,
      activeSessionKeyId: automation.activeSessionKeyId,
      sessionKeyPublicAddress: automation.sessionKeyPublicAddress,
      constraints: automation.constraints,
      enableTxHash: automation.enableTxHash,
      enabledAt: automation.enabledAt?.toISOString(),
      disabledAt: automation.disabledAt?.toISOString(),
      sessionKeys: sessionKeys.map((sk) => ({
        id: sk.id,
        publicAddress: sk.publicAddress,
        status: sk.status,
        expiresAt: sk.expiresAt.toISOString(),
        createdAt: sk.createdAt.toISOString(),
      })),
      withdrawalAllowlist: allowlist.map((entry) => ({
        id: entry.id,
        address: entry.address,
        label: entry.label,
        addedTxHash: entry.addedTxHash,
        createdAt: entry.createdAt.toISOString(),
      })),
    });
  });

  // PUT /safe-automation/signing-mode
  app.put('/signing-mode', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.userId!;
    const body = updateSigningModeSchema.parse(request.body);
    await safeService.updateSigningMode(userId, body.signingMode);
    return reply.send({ signingMode: body.signingMode });
  });

  // PUT /safe-automation/constraints
  app.put('/constraints', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.userId!;
    const body = updateConstraintsSchema.parse(request.body);
    await safeService.updateConstraints(userId, body.constraints);
    return reply.send({ constraints: body.constraints });
  });

  // ── Session Keys ─────────────────────────────────────────────

  // POST /safe-automation/session-keys
  app.post('/session-keys', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.userId!;
    const body = registerSessionKeySchema.parse(request.body);

    const result = await safeService.registerSessionKey(
      userId,
      body.expiresInSeconds,
      body.constraints,
    );

    return reply.status(201).send(result);
  });

  // GET /safe-automation/session-keys
  app.get('/session-keys', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.userId!;
    const sessionKeys = await safeService.getSessionKeys(userId);

    return reply.send({
      items: sessionKeys.map((sk) => ({
        id: sk.id,
        publicAddress: sk.publicAddress,
        status: sk.status,
        expiresAt: sk.expiresAt.toISOString(),
        createdAt: sk.createdAt.toISOString(),
      })),
    });
  });

  // DELETE /safe-automation/session-keys/:id
  app.delete<{ Params: { id: string } }>('/session-keys/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.userId!;
    const { id } = request.params;
    await safeService.revokeSessionKey(userId, id);
    return reply.send({ revoked: true });
  });

  // ── Withdrawal Allowlist ─────────────────────────────────────

  // GET /safe-automation/withdrawal-allowlist
  app.get('/withdrawal-allowlist', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.userId!;
    const entries = await safeService.getWithdrawalAllowlist(userId);

    return reply.send({
      items: entries.map((entry) => ({
        id: entry.id,
        address: entry.address,
        label: entry.label,
        addedTxHash: entry.addedTxHash,
        createdAt: entry.createdAt.toISOString(),
      })),
    });
  });

  // POST /safe-automation/withdrawal-allowlist
  app.post('/withdrawal-allowlist', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.userId!;
    const body = addWithdrawalAllowlistSchema.parse(request.body);

    const entry = await safeService.addWithdrawalAddress(
      userId,
      body.address,
      body.label,
    );

    return reply.status(201).send({
      id: entry.id,
      address: entry.address,
      label: entry.label,
      createdAt: entry.createdAt.toISOString(),
    });
  });

  // DELETE /safe-automation/withdrawal-allowlist
  app.delete('/withdrawal-allowlist', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.userId!;
    const body = removeWithdrawalAllowlistSchema.parse(request.body);
    await safeService.removeWithdrawalAddress(userId, body.address);
    return reply.send({ removed: true });
  });

  // ── Module Transactions ──────────────────────────────────────

  // GET /safe-automation/module-txs
  app.get('/module-txs', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.userId!;
    const txs = await safeService.getModuleTxs(userId);

    return reply.send({
      items: txs.map((tx) => ({
        id: tx.id,
        sessionKeyId: tx.sessionKeyId,
        action: tx.action,
        targetContract: tx.targetContract,
        functionSelector: tx.functionSelector,
        notionalUsd: tx.notionalUsd,
        status: tx.status,
        transactionHash: tx.transactionHash,
        errorMessage: tx.errorMessage,
        blockReason: tx.blockReason,
        createdAt: tx.createdAt.toISOString(),
      })),
    });
  });
};
