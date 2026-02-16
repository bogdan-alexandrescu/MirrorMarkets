import * as jose from 'jose';
import { UnauthorizedError } from '@mirrormarkets/shared';

const JWKS = jose.createRemoteJWKSet(
  new URL('https://www.crossmint.com/.well-known/jwks.json'),
);

export class CrossmintAuthAdapter {
  async verifyToken(token: string): Promise<{ userId: string; email: string }> {
    try {
      const { payload } = await jose.jwtVerify(token, JWKS);
      return {
        userId: payload.sub as string,
        email: (payload as Record<string, unknown>).email as string,
      };
    } catch {
      throw new UnauthorizedError('Invalid Crossmint JWT');
    }
  }
}
