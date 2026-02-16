import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { AppError, ErrorCodes } from '@mirrormarkets/shared';

// ── Mock DynamicAdapter ──────────────────────────────────────────────────────

const mockVerifyToken = vi.fn();

vi.mock('../adapters/dynamic.adapter.js', () => ({
  DynamicAdapter: class {
    verifyToken = mockVerifyToken;
  },
}));

// ── Mock CrossmintAuthAdapter ────────────────────────────────────────────────

const mockCrossmintVerify = vi.fn();

vi.mock('../adapters/crossmint-auth.adapter.js', () => ({
  CrossmintAuthAdapter: class {
    verifyToken = mockCrossmintVerify;
  },
}));

// ── Mock data ────────────────────────────────────────────────────────────────

const MOCK_DYNAMIC_JWT = {
  sub: 'dynamic-user-123',
  email: 'test@example.com',
  environment_id: 'env-123',
  verified_credentials: [
    {
      address: '0x1234567890abcdef1234567890abcdef12345678',
      chain: 'eip155',
      format: 'blockchain',
      wallet_name: 'metamask',
    },
  ],
};

const MOCK_USER = {
  id: 'user-1',
  dynamicId: 'dynamic-user-123',
  crossmintId: null,
  email: 'test@example.com',
  name: 'Test User',
  avatarUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_CROSSMINT_USER = {
  id: 'user-2',
  dynamicId: null,
  crossmintId: 'crossmint-user-456',
  email: 'crossmint@example.com',
  name: null,
  avatarUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_SESSION = {
  id: 'session-1',
  userId: 'user-1',
  token: 'mock-session-token',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMockPrisma() {
  return {
    user: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    authSession: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
}

async function buildApp(mockPrisma: ReturnType<typeof createMockPrisma>) {
  const app = Fastify({ logger: false });

  await app.register(
    fp(async (fastify) => {
      fastify.decorate('prisma', mockPrisma);
    }, { name: 'prisma' }),
  );

  await app.register(
    fp(async (fastify) => {
      fastify.setErrorHandler((error: any, _request, reply) => {
        if (error instanceof AppError) {
          return reply.status(error.statusCode).send(error.toJSON());
        }
        if (error?.name === 'ZodError' && Array.isArray(error?.issues)) {
          return reply.status(400).send({
            code: ErrorCodes.VALIDATION_ERROR,
            message: 'Validation failed',
            details: { issues: error.issues },
          });
        }
        return reply.status(500).send({
          code: ErrorCodes.INTERNAL_ERROR,
          message: 'Internal server error',
        });
      });
    }, { name: 'error-handler' }),
  );

  await app.register(
    fp(async (fastify) => {
      fastify.decorateRequest('userId', '');
      fastify.decorateRequest('sessionId', '');
      fastify.decorate('authenticate', async (request: any) => {
        const authHeader = request.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
          throw new AppError(ErrorCodes.UNAUTHORIZED, 'Unauthorized', 401);
        }
        const token = authHeader.slice(7);
        const session = await mockPrisma.authSession.findUnique({
          where: { token },
          select: { id: true, userId: true, expiresAt: true },
        });
        if (!session) {
          throw new AppError(ErrorCodes.UNAUTHORIZED, 'Invalid session token', 401);
        }
        request.userId = session.userId;
        request.sessionId = session.id;
      });
    }, { name: 'auth' }),
  );

  const { authRoutes } = await import('../routes/auth.js');
  await app.register(authRoutes, { prefix: '/auth' });

  await app.ready();
  return app;
}

function mockAuthSession(mockPrisma: ReturnType<typeof createMockPrisma>, userId = 'user-1') {
  mockPrisma.authSession.findUnique.mockResolvedValue({
    id: 'session-1',
    userId,
    expiresAt: new Date(Date.now() + 3600_000),
  });
}

const AUTH = { authorization: 'Bearer valid-token' };

// ── Tests: POST /auth/crossmint/verify ──────────────────────────────────────

describe('POST /auth/crossmint/verify', () => {
  let app: FastifyInstance;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    app = await buildApp(mockPrisma);
    mockCrossmintVerify.mockReset();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 400 when token is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/crossmint/verify',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 401 when Crossmint JWT is invalid', async () => {
    mockCrossmintVerify.mockRejectedValue(
      new AppError(ErrorCodes.UNAUTHORIZED, 'Invalid Crossmint JWT', 401),
    );

    const res = await app.inject({
      method: 'POST',
      url: '/auth/crossmint/verify',
      payload: { token: 'bad-jwt' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('creates new user and session on valid token', async () => {
    mockCrossmintVerify.mockResolvedValue({
      userId: 'crossmint-user-456',
      email: 'crossmint@example.com',
    });
    mockPrisma.user.findUnique.mockResolvedValue(null); // no existing user
    mockPrisma.user.create.mockResolvedValue(MOCK_CROSSMINT_USER);
    mockPrisma.authSession.create.mockResolvedValue(MOCK_SESSION);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/crossmint/verify',
      payload: { token: 'valid-crossmint-jwt' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.token).toBeDefined();
    expect(body.expiresAt).toBeDefined();
    expect(body.user.id).toBe('user-2');
    expect(body.user.email).toBe('crossmint@example.com');
  });

  it('updates existing user by crossmintId', async () => {
    mockCrossmintVerify.mockResolvedValue({
      userId: 'crossmint-user-456',
      email: 'crossmint@example.com',
    });
    mockPrisma.user.findUnique.mockResolvedValueOnce(MOCK_CROSSMINT_USER); // found by crossmintId
    mockPrisma.user.update.mockResolvedValue(MOCK_CROSSMINT_USER);
    mockPrisma.authSession.create.mockResolvedValue(MOCK_SESSION);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/crossmint/verify',
      payload: { token: 'valid-crossmint-jwt' },
    });

    expect(res.statusCode).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { crossmintId: 'crossmint-user-456' },
      data: { email: 'crossmint@example.com' },
    });
  });

  it('links existing email user to crossmintId (migration)', async () => {
    mockCrossmintVerify.mockResolvedValue({
      userId: 'crossmint-user-456',
      email: 'test@example.com',
    });
    // First findUnique (by crossmintId) returns null
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    // Second findUnique (by email) returns existing user
    mockPrisma.user.findUnique.mockResolvedValueOnce(MOCK_USER);
    mockPrisma.user.update.mockResolvedValue({ ...MOCK_USER, crossmintId: 'crossmint-user-456' });
    mockPrisma.authSession.create.mockResolvedValue(MOCK_SESSION);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/crossmint/verify',
      payload: { token: 'valid-crossmint-jwt' },
    });

    expect(res.statusCode).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { crossmintId: 'crossmint-user-456' },
    });
  });

  it('does not return dynamicEoaAddress', async () => {
    mockCrossmintVerify.mockResolvedValue({
      userId: 'crossmint-user-456',
      email: 'crossmint@example.com',
    });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue(MOCK_CROSSMINT_USER);
    mockPrisma.authSession.create.mockResolvedValue(MOCK_SESSION);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/crossmint/verify',
      payload: { token: 'valid-crossmint-jwt' },
    });

    const body = res.json();
    expect(body.dynamicEoaAddress).toBeUndefined();
  });
});

// ── Tests: POST /auth/dynamic/verify ─────────────────────────────────────────

describe('POST /auth/dynamic/verify', () => {
  let app: FastifyInstance;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    app = await buildApp(mockPrisma);
    mockVerifyToken.mockReset();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 400 when token is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/dynamic/verify',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when token is empty string', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/dynamic/verify',
      payload: { token: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 401 when Dynamic JWT is invalid', async () => {
    mockVerifyToken.mockRejectedValue(
      new AppError(ErrorCodes.UNAUTHORIZED, 'Invalid Dynamic JWT', 401),
    );

    const res = await app.inject({
      method: 'POST',
      url: '/auth/dynamic/verify',
      payload: { token: 'bad-jwt' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('upserts user and creates session on valid token', async () => {
    mockVerifyToken.mockResolvedValue(MOCK_DYNAMIC_JWT);
    mockPrisma.user.upsert.mockResolvedValue(MOCK_USER);
    mockPrisma.authSession.create.mockResolvedValue(MOCK_SESSION);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/dynamic/verify',
      payload: { token: 'valid-dynamic-jwt' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.token).toBeDefined();
    expect(body.expiresAt).toBeDefined();
    expect(body.user.id).toBe('user-1');
    expect(body.user.email).toBe('test@example.com');
  });

  it('calls user.upsert with correct Dynamic ID and email', async () => {
    mockVerifyToken.mockResolvedValue(MOCK_DYNAMIC_JWT);
    mockPrisma.user.upsert.mockResolvedValue(MOCK_USER);
    mockPrisma.authSession.create.mockResolvedValue(MOCK_SESSION);

    await app.inject({
      method: 'POST',
      url: '/auth/dynamic/verify',
      payload: { token: 'valid-jwt' },
    });

    expect(mockPrisma.user.upsert).toHaveBeenCalledWith({
      where: { dynamicId: 'dynamic-user-123' },
      create: { dynamicId: 'dynamic-user-123', email: 'test@example.com' },
      update: { email: 'test@example.com' },
    });
  });

  it('creates authSession with 7-day expiry', async () => {
    mockVerifyToken.mockResolvedValue(MOCK_DYNAMIC_JWT);
    mockPrisma.user.upsert.mockResolvedValue(MOCK_USER);
    mockPrisma.authSession.create.mockResolvedValue(MOCK_SESSION);

    await app.inject({
      method: 'POST',
      url: '/auth/dynamic/verify',
      payload: { token: 'valid-jwt' },
    });

    const createCall = mockPrisma.authSession.create.mock.calls[0][0];
    expect(createCall.data.userId).toBe('user-1');
    expect(createCall.data.token).toBeDefined();
    expect(typeof createCall.data.token).toBe('string');
    expect(createCall.data.token.length).toBe(64); // 32 bytes hex
    const expiresAt = new Date(createCall.data.expiresAt);
    const diffDays = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(6.9);
    expect(diffDays).toBeLessThan(7.1);
  });

  it('returns dynamicEoaAddress from blockchain credential', async () => {
    mockVerifyToken.mockResolvedValue(MOCK_DYNAMIC_JWT);
    mockPrisma.user.upsert.mockResolvedValue(MOCK_USER);
    mockPrisma.authSession.create.mockResolvedValue(MOCK_SESSION);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/dynamic/verify',
      payload: { token: 'valid-jwt' },
    });

    const body = res.json();
    expect(body.dynamicEoaAddress).toBe('0x1234567890abcdef1234567890abcdef12345678');
  });

  it('returns null dynamicEoaAddress when no blockchain credential', async () => {
    mockVerifyToken.mockResolvedValue({
      ...MOCK_DYNAMIC_JWT,
      verified_credentials: [],
    });
    mockPrisma.user.upsert.mockResolvedValue(MOCK_USER);
    mockPrisma.authSession.create.mockResolvedValue(MOCK_SESSION);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/dynamic/verify',
      payload: { token: 'valid-jwt' },
    });

    const body = res.json();
    expect(body.dynamicEoaAddress).toBeNull();
  });

  it('creates audit log on successful verify', async () => {
    mockVerifyToken.mockResolvedValue(MOCK_DYNAMIC_JWT);
    mockPrisma.user.upsert.mockResolvedValue(MOCK_USER);
    mockPrisma.authSession.create.mockResolvedValue(MOCK_SESSION);

    await app.inject({
      method: 'POST',
      url: '/auth/dynamic/verify',
      payload: { token: 'valid-jwt' },
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        action: 'USER_CREATED',
      }),
    });
  });
});

// ── Tests: POST /auth/logout ─────────────────────────────────────────────────

describe('POST /auth/logout', () => {
  let app: FastifyInstance;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    app = await buildApp(mockPrisma);
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 401 without auth header', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 with invalid session token', async () => {
    mockPrisma.authSession.findUnique.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { authorization: 'Bearer invalid-token' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('deletes session and returns ok on valid logout', async () => {
    mockAuthSession(mockPrisma);
    mockPrisma.authSession.delete.mockResolvedValue({});

    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: AUTH,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('deletes the correct session by ID', async () => {
    mockAuthSession(mockPrisma);
    mockPrisma.authSession.delete.mockResolvedValue({});

    await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: AUTH,
    });

    expect(mockPrisma.authSession.delete).toHaveBeenCalledWith({
      where: { id: 'session-1' },
    });
  });

  it('does not affect other sessions', async () => {
    // Simulate user with session-1 logging out
    mockAuthSession(mockPrisma);
    mockPrisma.authSession.delete.mockResolvedValue({});

    await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: AUTH,
    });

    // Only session-1 was deleted, not a bulk delete
    expect(mockPrisma.authSession.delete).toHaveBeenCalledTimes(1);
    expect(mockPrisma.authSession.delete).toHaveBeenCalledWith({
      where: { id: 'session-1' },
    });
  });
});
