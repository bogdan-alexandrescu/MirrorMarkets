import { PrismaClient } from '@prisma/client';
import type { SigningRequestInput, SigningRequestResult, SigningProvider } from '@mirrormarkets/shared';
import { hashSigningPayload, generateCorrelationId, generateSigningIdempotencyKey } from '@mirrormarkets/shared';

/**
 * SigningRequestService — tracks every signing operation in the SigningRequest table.
 *
 * Every call to sign (typed data, message, or transaction) creates a signing request
 * record before the actual signing attempt. The record is then updated with the result.
 * This provides a complete audit trail of all signing operations.
 */
export class SigningRequestService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a signing request record before the actual signing attempt.
   * Returns the record ID and correlation ID for tracking.
   */
  async create(input: SigningRequestInput): Promise<{
    id: string;
    correlationId: string;
    idempotencyKey: string;
  }> {
    const record = await this.prisma.signingRequest.create({
      data: {
        userId: input.userId,
        requestType: input.requestType,
        purpose: input.purpose,
        idempotencyKey: input.idempotencyKey,
        payloadHash: input.payloadHash,
        payloadJson: input.payloadJson as any,
        status: 'CREATED',
        attemptCount: 0,
        provider: input.provider,
        correlationId: input.correlationId,
      },
    });

    return {
      id: record.id,
      correlationId: record.correlationId,
      idempotencyKey: record.idempotencyKey,
    };
  }

  /**
   * Check if a signing request with the given idempotency key already succeeded.
   * Returns the signature if found, null otherwise.
   */
  async findByIdempotencyKey(idempotencyKey: string): Promise<string | null> {
    const existing = await this.prisma.signingRequest.findUnique({
      where: { idempotencyKey },
    });

    if (existing && existing.status === 'SUCCEEDED' && existing.signature) {
      return existing.signature;
    }

    return null;
  }

  /**
   * Mark the signing request as sent (in-flight to Dynamic API).
   */
  async markSent(id: string): Promise<void> {
    await this.prisma.signingRequest.update({
      where: { id },
      data: {
        status: 'SENT',
        attemptCount: { increment: 1 },
      },
    });
  }

  /**
   * Mark the signing request as succeeded with the resulting signature.
   */
  async markSucceeded(id: string, signature: string): Promise<void> {
    await this.prisma.signingRequest.update({
      where: { id },
      data: {
        status: 'SUCCEEDED',
        signature,
      },
    });
  }

  /**
   * Mark the signing request as failed with the error message.
   */
  async markFailed(id: string, error: string): Promise<void> {
    await this.prisma.signingRequest.update({
      where: { id },
      data: {
        status: 'FAILED',
        lastError: error,
      },
    });
  }

  /**
   * Mark the signing request as retried (will be re-attempted).
   */
  async markRetried(id: string): Promise<void> {
    await this.prisma.signingRequest.update({
      where: { id },
      data: {
        status: 'RETRIED',
        attemptCount: { increment: 1 },
      },
    });
  }

  /**
   * Get recent signing request stats for a user (for rate limit window).
   */
  async countRecentByUser(userId: string, windowMs: number): Promise<number> {
    const since = new Date(Date.now() - windowMs);
    return this.prisma.signingRequest.count({
      where: {
        userId,
        createdAt: { gte: since },
      },
    });
  }

  /**
   * Get global signing request count for rate limit window.
   */
  async countRecentGlobal(windowMs: number): Promise<number> {
    const since = new Date(Date.now() - windowMs);
    return this.prisma.signingRequest.count({
      where: {
        createdAt: { gte: since },
      },
    });
  }

  /**
   * Get recent failure count for circuit breaker assessment.
   */
  async countRecentFailures(windowMs: number): Promise<number> {
    const since = new Date(Date.now() - windowMs);
    return this.prisma.signingRequest.count({
      where: {
        status: 'FAILED',
        createdAt: { gte: since },
      },
    });
  }

  /**
   * Convenience: build idempotency key + correlation ID + payload hash.
   */
  buildRequestInput(params: {
    userId: string;
    requestType: 'TYPED_DATA' | 'MESSAGE' | 'TX';
    purpose: SigningRequestInput['purpose'];
    payload: unknown;
    provider: SigningProvider;
  }): SigningRequestInput {
    const payloadHash = hashSigningPayload(params.payload);
    const correlationId = generateCorrelationId();
    const idempotencyKey = generateSigningIdempotencyKey(
      params.userId,
      params.purpose,
      payloadHash,
    );

    return {
      userId: params.userId,
      requestType: params.requestType,
      purpose: params.purpose,
      idempotencyKey,
      payloadHash,
      provider: params.provider,
      correlationId,
    };
  }
}
