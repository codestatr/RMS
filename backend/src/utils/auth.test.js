import { afterEach, describe, expect, it } from '@jest/globals';
import { generateToken, verifyToken } from './auth.js';

describe('JWT helpers', () => {
  const originalSecret = process.env.JWT_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });

  it('signs and verifies a token payload', () => {
    process.env.JWT_SECRET = 'unit-test-secret';
    const payload = { id: 'user-123', role: 'customer' };

    const decoded = verifyToken(generateToken(payload));

    expect(decoded.id).toBe(payload.id);
    expect(decoded.role).toBe(payload.role);
  });
});
