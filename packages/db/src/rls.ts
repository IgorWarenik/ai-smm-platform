import { prisma } from './client'

/**
 * Execute a callback within an RLS-isolated transaction.
 * Sets app.project_id and app.user_id for the duration of the transaction.
 * All queries inside the callback respect Row-Level Security policies.
 */
export async function withProjectContext<T>(
  projectId: string,
  userId: string,
  fn: (tx: typeof prisma) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // Use set_config() with parameterized values — safe against SQL injection.
    // Third argument `true` makes the setting transaction-local (same as SET LOCAL).
    await tx.$executeRaw`SELECT set_config('app.project_id', ${projectId}, true)`
    await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`
    return fn(tx as unknown as typeof prisma)
  })
}

/**
 * Set project context for a single raw SQL query (outside transaction).
 * Use withProjectContext for multiple queries to avoid race conditions.
 */
export async function setProjectContext(
  projectId: string,
  userId: string
): Promise<void> {
  await prisma.$executeRaw`SELECT set_config('app.project_id', ${projectId}, false)`
  await prisma.$executeRaw`SELECT set_config('app.user_id', ${userId}, false)`
}
