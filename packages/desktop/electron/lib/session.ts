import { randomBytes } from 'crypto';

export interface SessionUser {
  id: string;
  name: string;
  role: string;
}

interface Session {
  user: SessionUser;
  expiresAt: number;
}

const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export function createSession(user: SessionUser): string {
  const token = randomBytes(32).toString('hex');
  sessions.set(token, { user, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

export function getSession(token: string | undefined | null): SessionUser | null {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return session.user;
}

export function destroySession(token: string | undefined | null): void {
  if (token) sessions.delete(token);
}

export function requireSession(token: string | undefined | null): SessionUser {
  const user = getSession(token);
  if (!user) throw new Error('Unauthorized: please log in');
  return user;
}

export function requireAdmin(token: string | undefined | null): SessionUser {
  const user = requireSession(token);
  if (user.role !== 'admin') throw new Error('Forbidden: admin access required');
  return user;
}
