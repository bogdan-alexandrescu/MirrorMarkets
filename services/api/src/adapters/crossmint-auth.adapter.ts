import * as jose from 'jose';
import { UnauthorizedError } from '@mirrormarkets/shared';

const JWKS = jose.createRemoteJWKSet(
  new URL('https://www.crossmint.com/.well-known/jwks.json'),
);

export class CrossmintAuthAdapter {
  async verifyToken(token: string): Promise<{ userId: string; email?: string }> {
    try {
      const { payload } = await jose.jwtVerify(token, JWKS);
      const email = (payload as Record<string, unknown>).email as string | undefined;
      return {
        userId: payload.sub as string,
        ...(email ? { email } : {}),
      };
    } catch {
      throw new UnauthorizedError('Invalid Crossmint JWT');
    }
  }
}
