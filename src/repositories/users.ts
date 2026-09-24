import { eq } from 'drizzle-orm';
import type { Database, Exec } from '../db/client.js';
import { users, userAutomationSettings } from '../db/schema/index.js';
import type { User } from '../db/schema/users.js';

export interface CreateUserInput {
  displayName?: string | null;
}

/**
 * Create a user AND their automation settings row in one transaction. Every user
 * always has exactly one settings row with the safe defaults (automation disabled,
 * review target 20, approval NOT_REQUESTED).
 */
export async function createUser(
  db: Database,
  input: CreateUserInput = {},
): Promise<User> {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ displayName: input.displayName ?? null })
      .returning();
    if (!user) throw new Error('Failed to create user');
    await tx.insert(userAutomationSettings).values({ userId: user.id });
    return user;
  });
}

export async function getUser(exec: Exec, id: string): Promise<User | null> {
  const [row] = await exec.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

export async function listUsers(exec: Exec): Promise<User[]> {
  return exec.select().from(users).orderBy(users.createdAt);
}

/** Returns the single V1 local user, or null if none seeded yet. */
export async function getFirstUser(exec: Exec): Promise<User | null> {
  const [row] = await exec.select().from(users).orderBy(users.createdAt).limit(1);
  return row ?? null;
}
