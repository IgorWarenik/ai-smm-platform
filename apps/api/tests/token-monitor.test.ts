import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getProjectUsage, incrementTokenUsage, resetUsage } from '../src/token-monitor';

describe('Token Monitor', () => {
    const projectId = 'test-project-id';

    beforeEach(async () => {
        await resetUsage(projectId);
        vi.clearAllMocks();
    });

    it('should increment and retrieve token usage', async () => {
        await incrementTokenUsage({
            projectId,
            model: 'claude-3-opus',
            promptTokens: 100,
            completionTokens: 200,
        });

        const usage = await getProjectUsage(projectId);
        expect(usage.totalTokens).toBe(300);
        expect(usage.models['claude-3-opus']).toBe(300);
    });

    it('should handle multiple increments correctly', async () => {
        await incrementTokenUsage({
            projectId,
            model: 'claude-3-sonnet',
            promptTokens: 50,
            completionTokens: 50,
        });

        await incrementTokenUsage({
            projectId,
            model: 'voyage-2',
            promptTokens: 20,
            completionTokens: 0,
        });

        const usage = await getProjectUsage(projectId);
        expect(usage.totalTokens).toBe(120);
        expect(usage.models['claude-3-sonnet']).toBe(100);
        expect(usage.models['voyage-2']).toBe(20);
    });
});