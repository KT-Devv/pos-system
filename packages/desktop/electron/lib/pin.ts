import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(pin, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  if (stored.includes(':')) {
    const [salt, hash] = stored.split(':');
    const derived = scryptSync(pin, salt, 64).toString('hex');
    try {
      return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'));
    } catch {
      return false;
    }
  }
  return pin === stored;
}
