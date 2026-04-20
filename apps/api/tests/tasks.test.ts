import { prisma } from '@ai-marketing/db';
import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app';

// Мокаем сервис скоринга, чтобы избежать реальных вызовов Claude в интеграционных тестах
vi.mock('../src/services/scoring', () => ({
    scoreTask: vi.fn().mockResolvedValue({
        score: 85,
        reasoning: 'Comprehensive task description',
        suggestions: []
    })
}));

describe('Tasks API', () => {
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
        // Очистка базы
        await prisma.task.deleteMany();
        await prisma.projectMember.deleteMany();
        await prisma.project.deleteMany();
        await prisma.user.deleteMany();

        // Создаем окружение: пользователь и проект
        const regRes = await app.inject({
            method: 'POST',
            url: '/api/auth/register',
            payload: { email: 'task-tester@example.com', password: 'password123', name: 'Tester' },
        });
        authToken = JSON.parse(regRes.payload).data.tokens.accessToken;

        const projRes = await app.inject({
            method: 'POST',
            url: '/api/projects',
            headers: { authorization: `Bearer ${authToken}` },
            payload: { name: 'Automated Testing Project' },
        });
        projectId = JSON.parse(projRes.payload).data.id;
    });

    describe('POST /api/projects/:id/tasks', () => {
        it('should create a task with status PENDING if score is >= 40', async () => {
            const response = await app.inject({
                method: 'POST',
                url: `/api/projects/${projectId}/tasks`,
                headers: { authorization: `Bearer ${authToken}` },
                payload: {
                    title: 'Social Media Strategy',
                    input: 'Generate a 30-day content plan for LinkedIn',
                    scenario: 'B'
                },
            });

            expect(response.statusCode).toBe(201);
            const body = JSON.parse(response.payload);
            expect(body.data.status).toBe('PENDING');
            expect(body.data.score).toBe(85);
        });

        it('should set status to AWAITING_CLARIFICATION if score is between 25 and 39', async () => {
            const scoring = await import('../src/services/scoring');
            (scoring.scoreTask as any).mockResolvedValueOnce({
                score: 30,
                reasoning: 'Too vague',
                suggestions: ['Define target audience']
            });

            const response = await app.inject({
                method: 'POST',
                url: `/api/projects/${projectId}/tasks`,
                headers: { authorization: `Bearer ${authToken}` },
                payload: { title: 'Vague Task', input: 'Do marketing', scenario: 'A' },
            });

            expect(response.statusCode).toBe(201);
            expect(JSON.parse(response.payload).data.status).toBe('AWAITING_CLARIFICATION');
        });
    });

    describe('POST /api/tasks/:id/clarify', () => {
        it('should update task details and re-score', async () => {
            // 1. Создаем задачу, требующую уточнений
            const scoring = await import('../src/services/scoring');
            (scoring.scoreTask as any).mockResolvedValueOnce({ score: 30, reasoning: '..', suggestions: ['..'] });

            const createRes = await app.inject({
                method: 'POST',
                url: `/api/projects/${projectId}/tasks`,
                headers: { authorization: `Bearer ${authToken}` },
                payload: { title: 'Need Clarify', input: '...', scenario: 'A' },
            });
            const taskId = JSON.parse(createRes.payload).data.id;

            // 2. Отправляем уточнения и получаем высокий балл
            (scoring.scoreTask as any).mockResolvedValueOnce({ score: 90, reasoning: 'Clear now', suggestions: [] });

            const response = await app.inject({
                method: 'POST',
                url: `/api/tasks/${taskId}/clarify`,
                headers: { authorization: `Bearer ${authToken}` },
                payload: {
                    answers: [{ question: 'Target audience?', answer: 'Marketing agencies' }]
                },
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.data.status).toBe('PENDING');
            expect(body.data.score).toBe(90);
        });
    });

    describe('POST /api/tasks/:id/execute', () => {
        it('should transition task to RUNNING status', async () => {
            const createRes = await app.inject({
                method: 'POST',
                url: `/api/projects/${projectId}/tasks`,
                headers: { authorization: `Bearer ${authToken}` },
                payload: { title: 'Execution Test', input: 'Valid input', scenario: 'A' },
            });
            const taskId = JSON.parse(createRes.payload).data.id;

            const response = await app.inject({
                method: 'POST',
                url: `/api/tasks/${taskId}/execute`,
                headers: { authorization: `Bearer ${authToken}` },
            });

            expect(response.statusCode).toBe(200);
            expect(JSON.parse(response.payload).data.status).toBe('RUNNING');
        });
    });

    describe('GET /api/tasks/:id/stream', () => {
        it('should establish SSE connection with correct headers', async () => {
            const createRes = await app.inject({
                method: 'POST',
                url: `/api/projects/${projectId}/tasks`,
                headers: { authorization: `Bearer ${authToken}` },
                payload: { title: 'Stream Test', input: '...', scenario: 'A' },
            });
            const taskId = JSON.parse(createRes.payload).data.id;

            // Запускаем выполнение, чтобы создать объект Execution
            await app.inject({
                method: 'POST',
                url: `/api/tasks/${taskId}/execute`,
                headers: { authorization: `Bearer ${authToken}` },
            });

            const response = await app.inject({
                method: 'GET',
                url: `/api/tasks/${taskId}/stream`,
                headers: { authorization: `Bearer ${authToken}` },
            });

            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toContain('text/event-stream');
            expect(response.headers['cache-control']).toBe('no-cache');
        });
    });
});