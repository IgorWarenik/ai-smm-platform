import { prisma } from '@ai-marketing/db';
import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';

describe('Approvals API', () => {
    let app: FastifyInstance;
    let authToken: string;
    let projectId: string;
    let taskId: string;
    let outputId: string;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(async () => {
        // Полная очистка для изоляции тестов
        await prisma.agentOutput.deleteMany();
        await prisma.execution.deleteMany();
        await prisma.task.deleteMany();
        await prisma.projectMember.deleteMany();
        await prisma.project.deleteMany();
        await prisma.user.deleteMany();

        // 1. Создаем пользователя и проект
        const regRes = await app.inject({
            method: 'POST',
            url: '/api/auth/register',
            payload: { email: 'approver@example.com', password: 'password123', name: 'Approver' },
        });
        authToken = JSON.parse(regRes.payload).data.tokens.accessToken;

        const projRes = await app.inject({
            method: 'POST',
            url: '/api/projects',
            headers: { authorization: `Bearer ${authToken}` },
            payload: { name: 'Approval Flow Project' },
        });
        projectId = JSON.parse(projRes.payload).data.id;

        // 2. Создаем задачу и "фейковый" результат агента для тестирования
        const task = await prisma.task.create({
            data: {
                projectId,
                title: 'Marketing Strategy Task',
                input: 'Need strategy for AI tool',
                scenario: 'B',
                status: 'RUNNING'
            }
        });
        taskId = task.id;

        const execution = await prisma.execution.create({
            data: { taskId, status: 'RUNNING' }
        });

        const output = await prisma.agentOutput.create({
            data: {
                executionId: execution.id,
                agentType: 'MARKETER',
                content: { strategy: 'Focus on LinkedIn ads' },
                status: 'PENDING'
            }
        });
        outputId = output.id;
    });

    describe('POST /api/approvals/approve', () => {
        it('should set output status to APPROVED', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/approvals/approve',
                headers: { authorization: `Bearer ${authToken}` },
                payload: { outputId }
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.data.status).toBe('APPROVED');

            const updatedOutput = await prisma.agentOutput.findUnique({ where: { id: outputId } });
            expect(updatedOutput?.status).toBe('APPROVED');
        });
    });

    describe('POST /api/approvals/reject', () => {
        it('should set output status to REJECTED and trigger revision flow', async () => {
            const feedback = 'Please focus more on Twitter instead of LinkedIn.';

            const response = await app.inject({
                method: 'POST',
                url: '/api/approvals/reject',
                headers: { authorization: `Bearer ${authToken}` },
                payload: {
                    outputId,
                    feedback
                }
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.data.status).toBe('REJECTED');

            const updatedOutput = await prisma.agentOutput.findUnique({ where: { id: outputId } });
            expect(updatedOutput?.status).toBe('REJECTED');
        });
    });
});