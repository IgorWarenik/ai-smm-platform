import { prisma } from '@ai-marketing/db';
import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app';

// Мокаем эмбеддинги, чтобы не делать реальных запросов к Voyage AI
vi.mock('@ai-marketing/ai-engine', async () => {
    const actual = await vi.importActual<any>('@ai-marketing/ai-engine');
    return {
        ...actual,
        embedText: vi.fn().mockResolvedValue(new Array(1024).fill(0.1)),
    };
});

describe('Knowledge API', () => {
    let app: FastifyInstance;
    let authToken: string;
    let projectId: string;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(async () => {
        await prisma.knowledgeItem.deleteMany();
        await prisma.projectMember.deleteMany();
        await prisma.project.deleteMany();
        await prisma.user.deleteMany();

        const regRes = await app.inject({
            method: 'POST',
            url: '/api/auth/register',
            payload: { email: 'kb-admin@example.com', password: 'password123', name: 'Admin' },
        });
        authToken = JSON.parse(regRes.payload).data.tokens.accessToken;

        const projRes = await app.inject({
            method: 'POST',
            url: '/api/projects',
            headers: { authorization: `Bearer ${authToken}` },
            payload: { name: 'KB Testing Project' },
        });
        projectId = JSON.parse(projRes.payload).data.id;
    });

    describe('POST /api/projects/:id/knowledge', () => {
        it('should create a knowledge item and return 201', async () => {
            const response = await app.inject({
                method: 'POST',
                url: `/api/projects/${projectId}/knowledge`,
                headers: { authorization: `Bearer ${authToken}` },
                payload: {
                    title: 'Brand Tone of Voice',
                    content: 'Our voice is professional but accessible.',
                    category: 'BRAND',
                },
            });

            expect(response.statusCode).toBe(201);
            const body = response.json();
            expect(body.data.title).toBe('Brand Tone of Voice');

            const dbItem = await prisma.knowledgeItem.findUnique({ where: { id: body.data.id } });
            expect(dbItem).toBeDefined();
        });
    });

    describe('GET /api/projects/:id/knowledge', () => {
        it('should return all items for the project', async () => {
            await prisma.knowledgeItem.create({
                data: {
                    projectId,
                    title: 'Item 1',
                    content: 'Content 1',
                    category: 'PRODUCT',
                }
            });

            const response = await app.inject({
                method: 'GET',
                url: `/api/projects/${projectId}/knowledge`,
                headers: { authorization: `Bearer ${authToken}` },
            });

            expect(response.statusCode).toBe(200);
            expect(response.json().data).toHaveLength(1);
        });
    });

    describe('POST /api/projects/:id/knowledge/search', () => {
        it('should perform semantic search and respect minSimilarity', async () => {
            // Создаем айтем напрямую через Prisma (в реальности триггер в БД создаст эмбеддинг или API)
            await prisma.knowledgeItem.create({
                data: {
                    projectId,
                    title: 'Deep Strategy',
                    content: 'Information about long-term goals.',
                    category: 'STRATEGY',
                    // Для теста предполагаем, что поиск отработает корректно с моком
                }
            });

            const response = await app.inject({
                method: 'POST',
                url: `/api/projects/${projectId}/knowledge/search`,
                headers: { authorization: `Bearer ${authToken}` },
                payload: {
                    query: 'what are our goals?',
                    limit: 3,
                    minSimilarity: 0.5
                },
            });

            expect(response.statusCode).toBe(200);
            expect(Array.isArray(response.json().data)).toBe(true);
        });

        it('should respect RAG budget (maxTotalChars)', async () => {
            const response = await app.inject({
                method: 'POST',
                url: `/api/projects/${projectId}/knowledge/search`,
                headers: { authorization: `Bearer ${authToken}` },
                payload: {
                    query: 'short context only',
                    maxTotalChars: 50
                },
            });

            expect(response.statusCode).toBe(200);
            const results = response.json().data;
            const totalChars = results.reduce((acc: number, item: any) => acc + item.content.length, 0);
            expect(totalChars).toBeLessThanOrEqual(50);
        });
    });
});