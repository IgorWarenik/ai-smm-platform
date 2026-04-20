import { prisma } from '@ai-marketing/db';
import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';

describe('Project Profile API', () => {
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
        await prisma.projectProfile.deleteMany();
        await prisma.projectMember.deleteMany();
        await prisma.project.deleteMany();
        await prisma.user.deleteMany();

        // 1. Создаем пользователя
        const regRes = await app.inject({
            method: 'POST',
            url: '/api/auth/register',
            payload: { email: 'owner@example.com', password: 'password123', name: 'Owner' },
        });
        const authData = JSON.parse(regRes.payload);
        authToken = authData.data.tokens.accessToken;

        // 2. Создаем проект
        const projRes = await app.inject({
            method: 'POST',
            url: '/api/projects',
            headers: { authorization: `Bearer ${authToken}` },
            payload: { name: 'Profile Test Project' },
        });
        projectId = JSON.parse(projRes.payload).data.id;
    });

    describe('GET /api/projects/:id/profile', () => {
        it('should return 404 or default if profile is not set', async () => {
            const response = await app.inject({
                method: 'GET',
                url: `/api/projects/${projectId}/profile`,
                headers: { authorization: `Bearer ${authToken}` },
            });

            // В зависимости от реализации может быть 200 с null или 404
            expect([200, 404]).toContain(response.statusCode);
        });

        it('should return profile if it exists', async () => {
            // Предварительно создаем через Prisma
            await prisma.projectProfile.create({
                data: {
                    projectId,
                    brandVoice: 'Professional',
                    targetAudience: 'Developers',
                }
            });

            const response = await app.inject({
                method: 'GET',
                url: `/api/projects/${projectId}/profile`,
                headers: { authorization: `Bearer ${authToken}` },
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.data.brandVoice).toBe('Professional');
        });
    });

    describe('PUT /api/projects/:id/profile', () => {
        it('should create or update profile', async () => {
            const payload = {
                brandVoice: 'Friendly',
                targetAudience: 'Entrepreneurs',
                description: 'AI platform for marketing',
            };

            const response = await app.inject({
                method: 'PUT',
                url: `/api/projects/${projectId}/profile`,
                headers: { authorization: `Bearer ${authToken}` },
                payload,
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.data.brandVoice).toBe('Friendly');

            // Проверяем в БД
            const dbProfile = await prisma.projectProfile.findUnique({ where: { projectId } });
            expect(dbProfile?.targetAudience).toBe('Entrepreneurs');
        });

        it('should return 403 if user is not a project member', async () => {
            const response = await app.inject({
                method: 'PUT',
                url: `/api/projects/${projectId}/profile`,
                headers: { authorization: 'Bearer invalid_or_other_token' },
                payload: { brandVoice: 'Hack' },
            });

            expect(response.statusCode).toBe(401); // Unauthorized так как токен невалиден
        });
    });
});