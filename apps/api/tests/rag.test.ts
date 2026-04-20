import { describe, expect, it } from 'vitest';
import { applyRagBudget } from '@ai-marketing/ai-engine'

describe('RAG Budgeting', () => {
    const mockItems = [
        { id: '1', content: 'Short item', similarity: 0.9 },
        { id: '2', content: 'This is a much longer item that should be trimmed if budget is low', similarity: 0.8 },
        { id: '3', content: 'Last item', similarity: 0.7 },
    ];

    it('should filter items by minSimilarity', () => {
        const result = applyRagBudget(mockItems, { minSimilarity: 0.85 });
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('1');
    });

    it('should trim items to fit maxTotalChars', () => {
        // Пытаемся вместить элементы в жесткий лимит 30 символов
        const result = applyRagBudget(mockItems, { maxTotalChars: 30 });

        const totalLength = result.reduce((sum, item) => sum + item.content.length, 0);
        expect(totalLength).toBeLessThanOrEqual(30);
        expect(result.length).toBeGreaterThan(0);
    });

    it('should return all items if budget is large', () => {
        const result = applyRagBudget(mockItems, { maxTotalChars: 1000, minSimilarity: 0 });
        expect(result).toHaveLength(3);
    });
});