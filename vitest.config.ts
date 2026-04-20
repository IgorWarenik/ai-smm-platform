import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@ai-marketing/shared': path.resolve(__dirname, 'packages/shared/src'),
      '@ai-marketing/db': path.resolve(__dirname, 'packages/db/src'),
      '@ai-marketing/ai-engine': path.resolve(__dirname, 'packages/ai-engine/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: [
      'apps/api/tests/auth.test.ts',
    ],
    exclude: [
      'apps/api/tests/approvals.test.ts',
      'apps/api/tests/callback.test.ts',
      'apps/api/tests/knowledge.test.ts',
      'apps/api/tests/rag.test.ts',
      'apps/api/tests/tasks.test.ts',
      'apps/api/tests/token-monitor.test.ts',
      'tests/integration/**/*.test.ts',
    ],
    testTimeout: 15000,
  },
})
