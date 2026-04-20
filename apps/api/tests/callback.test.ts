import { prisma } from '@ai-marketing/db';
import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';

describe('Internal Callback API', () => {
    let app: FastifyInstance;
    let taskId: string;
    let executionId: string;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(async () => {
        await prisma.agentOutput.deleteMany();
        await prisma.execution.deleteMany();
        await prisma.task.deleteMany();
        await prisma.projectMember.deleteMany();
        await prisma.project.deleteMany();
        await prisma.user.deleteMany();

        const user = await prisma.user.create({
            data: { email: 'callback@test.com', passwordHash: 'hash' }
        });

        const project = await prisma.project.create({
            data: { name: 'Test Project', ownerId: user.id }
        });

        const task = await prisma.task.create({
            data: {
                projectId: project.id,
                title: 'Callback Task',
                input: 'Test input',
                status: 'RUNNING',
                scenario: 'B'
            }
        });
        taskId = task.id;

        const execution = await prisma.execution.create({
            data: { taskId: task.id, status: 'RUNNING' }
        });
        executionId = execution.id;
    });

    describe('POST /api/internal/agent-completion', () => {
        it('should record agent output and return 200', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/internal/agent-completion',
                payload: {
                    executionId,
                    agentType: 'MARKETER',
                    content: { brief: 'Strategic brief content' },
                    usage: { promptTokens: 100, completionTokens: 200 }
                }
            });

            expect(response.statusCode).toBe(200);

            const output = await prisma.agentOutput.findFirst({
                where: { executionId, agentType: 'MARKETER' }
            });
            expect(output).toBeDefined();
            expect(output?.content).toEqual({ brief: 'Strategic brief content' });
        });
    });

    describe('POST /api/internal/execution-complete', () => {
        it('should mark execution and task as COMPLETED', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/internal/execution-complete',
                payload: {
                    executionId,
                    status: 'COMPLETED'
                }
            });

            expect(response.statusCode).toBe(200);

            const execution = await prisma.execution.findUnique({ where: { id: executionId } });
            expect(execution?.status).toBe('COMPLETED');

            const task = await prisma.task.findUnique({ where: { id: taskId } });
            expect(task?.status).toBe('COMPLETED');
        });
    });
});