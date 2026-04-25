import { readFile, writeFile } from 'fs/promises'
import path from 'path'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@ai-marketing/db'
import { MemberRole } from '@ai-marketing/shared'

const ModelProviderSchema = z.enum(['DEEPSEEK', 'CLAUDE', 'CHATGPT', 'GEMINI'])

const ModelConfigSchema = z.object({
  provider: ModelProviderSchema,
  apiKey: z.string().min(1).max(500),
  apiUrl: z.string().url().max(500),
})

const PROVIDER_DEFAULTS = {
  DEEPSEEK: { label: 'DeepSeek', apiKeyEnv: 'DEEPSEEK_API_KEY', apiUrlEnv: 'DEEPSEEK_API_URL', apiUrl: 'https://api.deepseek.com' },
  CLAUDE: { label: 'Claude', apiKeyEnv: 'ANTHROPIC_API_KEY', apiUrlEnv: 'ANTHROPIC_API_URL', apiUrl: 'https://api.anthropic.com' },
  CHATGPT: { label: 'ChatGPT', apiKeyEnv: 'OPENAI_API_KEY', apiUrlEnv: 'OPENAI_API_URL', apiUrl: 'https://api.openai.com/v1' },
  GEMINI: {
    label: 'Gemini',
    apiKeyEnv: 'GEMINI_API_KEY',
    apiUrlEnv: 'GEMINI_API_URL',
    apiUrl: 'https://generativelanguage.googleapis.com/v1beta',
  },
} as const

type ModelProvider = keyof typeof PROVIDER_DEFAULTS

const ENV_FILE_PATH = process.env.ENV_FILE_PATH ?? path.resolve(process.cwd(), '.env')

function getEnvValue(content: string, key: string): string | undefined {
  const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'))
  return match?.[1]
}

function setEnvValue(content: string, key: string, value: string): string {
  const line = `${key}=${value}`
  const pattern = new RegExp(`^${key}=.*$`, 'm')
  if (pattern.test(content)) return content.replace(pattern, line)
  const separator = content.endsWith('\n') || content.length === 0 ? '' : '\n'
  return `${content}${separator}${line}\n`
}

async function readEnvFile(): Promise<string> {
  return readFile(ENV_FILE_PATH, 'utf8').catch((err: NodeJS.ErrnoException) => {
    if (err.code === 'ENOENT') return ''
    throw err
  })
}

async function writeModelConfigToEnv(config: z.infer<typeof ModelConfigSchema>) {
  const provider = PROVIDER_DEFAULTS[config.provider]
  let content = await readEnvFile()

  content = setEnvValue(content, 'MODEL_PROVIDER', config.provider)
  content = setEnvValue(content, 'MODEL_API_KEY', config.apiKey)
  content = setEnvValue(content, 'MODEL_API_URL', config.apiUrl)
  content = setEnvValue(content, provider.apiKeyEnv, config.apiKey)
  content = setEnvValue(content, provider.apiUrlEnv, config.apiUrl)

  await writeFile(ENV_FILE_PATH, content, 'utf8')

  process.env.MODEL_PROVIDER = config.provider
  process.env.MODEL_API_KEY = config.apiKey
  process.env.MODEL_API_URL = config.apiUrl
  process.env[provider.apiKeyEnv] = config.apiKey
  process.env[provider.apiUrlEnv] = config.apiUrl
}

export async function modelConfigRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.get('/', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const userId = request.user.sub

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!membership) return reply.notFound('Project not found')

    const content = await readEnvFile()
    const provider = (getEnvValue(content, 'MODEL_PROVIDER') ?? 'CLAUDE') as ModelProvider
    const defaults = PROVIDER_DEFAULTS[provider] ?? PROVIDER_DEFAULTS.CLAUDE
    const apiUrl = getEnvValue(content, 'MODEL_API_URL') ?? getEnvValue(content, defaults.apiUrlEnv) ?? defaults.apiUrl
    const apiKey = getEnvValue(content, 'MODEL_API_KEY') ?? getEnvValue(content, defaults.apiKeyEnv)

    return reply.send({
      data: {
        provider,
        apiUrl,
        hasApiKey: Boolean(apiKey),
        envFilePath: ENV_FILE_PATH,
      },
    })
  })

  app.put('/', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const userId = request.user.sub
    const body = ModelConfigSchema.parse(request.body)

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!membership) return reply.notFound('Project not found')
    if (membership.role !== MemberRole.OWNER) return reply.forbidden('Only project owner can update model API settings')

    await writeModelConfigToEnv(body)

    return reply.send({
      data: {
        provider: body.provider,
        apiUrl: body.apiUrl,
        hasApiKey: true,
        envFilePath: ENV_FILE_PATH,
        restartRequired: false,
      },
    })
  })
}
