import { createHash, randomBytes } from 'crypto';

/**
 * Compute a SHA-256 hash of the signing payload for deduplication / audit.
 * Uses deterministic (sorted-key) JSON serialization at all nesting levels.
 */
export function hashSigningPayload(payload: unknown): string {
  const canonical = JSON.stringify(payload, (_key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value).sort().reduce<Record<string, unknown>>((sorted, k) => {
        sorted[k] = value[k];
        return sorted;
      }, {});
    }
    return value;
  });
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Generate a cryptographically secure correlation ID.
 * Format: "sig_<32 hex chars>"
 */
export function generateCorrelationId(): string {
  return `sig_${randomBytes(16).toString('hex')}`;
}

/**
 * Generate a signing idempotency key from purpose + payload hash.
 * Ensures the same signing request is not submitted twice.
 */
export function generateSigningIdempotencyKey(
  userId: string,
  purpose: string,
  payloadHash: string,
): string {
  const input = `${userId}:${purpose}:${payloadHash}`;
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Generate a nonce for wallet binding proofs.
 */
export function generateBindingNonce(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Validate an Ethereum address (basic checksum-agnostic check).
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate a 4-byte function selector.
 */
export function isValidSelector(selector: string): boolean {
  return /^0x[a-fA-F0-9]{8}$/.test(selector);
}

/**
 * Compute SHA-256 of binding message for proof storage.
 */
export function hashBindingProof(message: string, signature: string): string {
  return createHash('sha256').update(`${message}:${signature}`).digest('hex');
}
