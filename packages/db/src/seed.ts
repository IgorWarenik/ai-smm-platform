import { prisma } from './client'
import { MemberRole } from '@prisma/client'
import * as crypto from 'crypto'

async function main() {
  console.log('🌱 Seeding database...')

  // Test user
  const user = await prisma.user.upsert({
    where: { email: 'admin@ai-marketing.local' },
    update: {},
    create: {
      email: 'admin@ai-marketing.local',
      // password: 'admin123' — bcrypt hash
      passwordHash: '$2b$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0lSsqmMm.a2',
      name: 'Admin',
    },
  })
  console.log(`✅ User: ${user.email}`)

  // Test project
  const project = await prisma.project.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      ownerId: user.id,
      name: 'Demo Project',
      settings: {
        language: 'ru',
        defaultScenario: 'B',
      },
    },
  })
  console.log(`✅ Project: ${project.name}`)

  // Project membership
  await prisma.projectMember.upsert({
    where: {
      userId_projectId: {
        userId: user.id,
        projectId: project.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      projectId: project.id,
      role: MemberRole.OWNER,
    },
  })
  console.log(`✅ ProjectMember: OWNER`)

  console.log('✅ Seed complete')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
