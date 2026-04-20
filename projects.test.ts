import { prisma } from '@ai-marketing/db';
import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';

describe('Projects API', () => {
    let app: FastifyInstance;
    let authToken: string;
    let userId: string;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(async () => {
        // Очистка базы перед каждым тестом
        await prisma.projectMember.deleteMany();
        await prisma.project.deleteMany();
        await prisma.user.deleteMany();

        // Создаем тестового пользователя и получаем токен
        const registerResponse = await app.inject({
            method: 'POST',
            url: '/api/auth/register',
            payload: {
                email: 'owner@example.com',
                password: 'password123',
                name: 'Project Owner',
            },
        });

        const data = JSON.parse(registerResponse.payload);
        authToken = data.data.tokens.accessToken;
        userId = data.data.user.id;
    });

    describe('POST /api/projects', () => {
        it('should create a new project and make the creator an owner', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/projects',
                headers: { authorization: `Bearer ${authToken}` },
                payload: {
                    name: 'Test Campaign',
                    settings: { language: 'ru', defaultScenario: 'B' },
                },
            });

            expect(response.statusCode).toBe(201);
            const body = JSON.parse(response.payload);
            expect(body.data.name).toBe('Test Campaign');
            expect(body.data.ownerId).toBe(userId);

            // Проверяем запись в БД через Prisma
            const membership = await prisma.projectMember.findFirst({
                where: { projectId: body.data.id, userId },
            });
            expect(membership?.role).toBe('OWNER');
        });

        it('should return 401 if unauthorized', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/projects',
                payload: { name: 'No Auth Project' },
            });
            expect(response.statusCode).toBe(401);
        });
    });

    describe('GET /api/projects', () => {
        it('should list only projects where the user is a member', async () => {
            // Создаем проект для текущего пользователя
            await app.inject({
                method: 'POST',
                url: '/api/projects',
                headers: { authorization: `Bearer ${authToken}` },
                payload: { name: 'User Project' },
            });

            // Создаем другой проект через БД, где пользователя нет
            await prisma.project.create({
                data: {
                    name: 'Other Project',
                    ownerId: 'some-other-uuid', // В реальности тут должен быть существующий ID
                },
            });

            const response = await app.inject({
                method: 'GET',
                url: '/api/projects',
                headers: { authorization: `Bearer ${authToken}` },
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.data).toHaveLength(1);
            expect(body.data[0].name).toBe('User Project');
        });
    });

    describe('GET /api/projects/:id', () => {
        it('should return project details for a member', async () => {
            const createRes = await app.inject({
                method: 'POST',
                url: '/api/projects',
                headers: { authorization: `Bearer ${authToken}` },
                payload: { name: 'Detail Project' },
            });
            const project = JSON.parse(createRes.payload).data;

            const response = await app.inject({
                method: 'GET',
                url: `/api/projects/${project.id}`,
                headers: { authorization: `Bearer ${authToken}` },
            });

            expect(response.statusCode).toBe(200);
            expect(JSON.parse(response.payload).data.name).toBe('Detail Project');
        });

        it('should return 403/404 if user is not a member', async () => {
            // Создаем проект "чужого" пользователя напрямую
            const otherProject = await prisma.project.create({
                data: { name: 'Secret Project', ownerId: 'another-user' },
            });

            const response = await app.inject({
                method: 'GET',
                url: `/api/projects/${otherProject.id}`,
                headers: { authorization: `Bearer ${authToken}` },
            });

            // RLS или логика контроллера должна скрыть проект
            expect([403, 404]).toContain(response.statusCode);
        });
    });

    describe('POST /api/projects/:id/members', () => {
        it('should add a new member to the project', async () => {
            const createRes = await app.inject({
                method: 'POST',
                url: '/api/projects',
                headers: { authorization: `Bearer ${authToken}` },
                payload: { name: 'Team Project' },
            });
            const project = JSON.parse(createRes.payload).data;

            const response = await app.inject({
                method: 'POST',
                url: `/api/projects/${project.id}/members`,
                headers: { authorization: `Bearer ${authToken}` },
                payload: {
                    email: 'member@example.com',
                    role: 'MEMBER',
                },
            });

            expect(response.statusCode).toBe(201);
            const body = JSON.parse(response.payload);
            expect(body.data.role).toBe('MEMBER');
        });
    });
});