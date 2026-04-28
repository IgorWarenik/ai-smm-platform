import { readFile, writeFile } from 'fs/promises'
import path from 'path'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Redis } from 'ioredis'
import { prisma } from '@ai-marketing/db'
import { MemberRole } from '@ai-marketing/shared'
import { runAgent } from '@ai-marketing/ai-engine'

const MODEL_LAST_ERROR_KEY = 'model:last_error'

async function readModelError(): Promise<{ provider: string; message: string; timestamp: string } | null> {
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) return null
  try {
    const redis = new Redis(redisUrl, { lazyConnect: true, enableOfflineQueue: false })
    await redis.connect()
    const raw = await redis.get(MODEL_LAST_ERROR_KEY)
    redis.disconnect()
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

const ModelProviderSchema = z.enum(['DEEPSEEK', 'CLAUDE', 'CHATGPT', 'GEMINI'])

const ModelConfigSchema = z.object({
  provider: ModelProviderSchema,
  apiKey: z.string().max(500).optional(),
  apiUrl: z.string().url().max(500),
})

const TestModelConfigSchema = z.object({
  provider: ModelProviderSchema.optional(),
  apiKey: z.string().max(500).optional(),
  apiUrl: z.string().url().max(500).optional(),
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

function normalizeProvider(value: string | undefined): ModelProvider {
  return value === 'DEEPSEEK' || value === 'CLAUDE' || value === 'CHATGPT' || value === 'GEMINI'
    ? value
    : 'CLAUDE'
}

function getProviderApiKey(content: string, provider: ModelProvider): string | undefined {
  const defaults = PROVIDER_DEFAULTS[provider]
  const activeProvider = normalizeProvider(getEnvValue(content, 'MODEL_PROVIDER'))
  return getEnvValue(content, defaults.apiKeyEnv) ?? (activeProvider === provider ? getEnvValue(content, 'MODEL_API_KEY') : undefined)
}

function getProviderApiUrl(content: string, provider: ModelProvider): string {
  const defaults = PROVIDER_DEFAULTS[provider]
  const activeProvider = normalizeProvider(getEnvValue(content, 'MODEL_PROVIDER'))
  return getEnvValue(content, defaults.apiUrlEnv) ?? (activeProvider === provider ? getEnvValue(content, 'MODEL_API_URL') : undefined) ?? defaults.apiUrl
}

function getProviderKeyMap(content: string): Record<ModelProvider, boolean> {
  return {
    CLAUDE: Boolean(getProviderApiKey(content, 'CLAUDE')),
    CHATGPT: Boolean(getProviderApiKey(content, 'CHATGPT')),
    GEMINI: Boolean(getProviderApiKey(content, 'GEMINI')),
    DEEPSEEK: Boolean(getProviderApiKey(content, 'DEEPSEEK')),
  }
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
  const nextApiKey = config.apiKey?.trim() || getProviderApiKey(content, config.provider)

  if (!nextApiKey) {
    throw new Error(`API key for ${config.provider} is not configured`)
  }

  content = setEnvValue(content, 'MODEL_PROVIDER', config.provider)
  content = setEnvValue(content, 'MODEL_API_KEY', nextApiKey)
  content = setEnvValue(content, 'MODEL_API_URL', config.apiUrl)
  content = setEnvValue(content, provider.apiKeyEnv, nextApiKey)
  content = setEnvValue(content, provider.apiUrlEnv, config.apiUrl)

  await writeFile(ENV_FILE_PATH, content, 'utf8')

  process.env.MODEL_PROVIDER = config.provider
  process.env.MODEL_API_KEY = nextApiKey
  process.env.MODEL_API_URL = config.apiUrl
  process.env[provider.apiKeyEnv] = nextApiKey
  process.env[provider.apiUrlEnv] = config.apiUrl
}

function applyModelConfigToProcess(content: string) {
  const provider = normalizeProvider(getEnvValue(content, 'MODEL_PROVIDER'))
  const defaults = PROVIDER_DEFAULTS[provider]
  const apiKey = getProviderApiKey(content, provider)
  const apiUrl = getProviderApiUrl(content, provider)

  process.env.MODEL_PROVIDER = provider
  if (apiKey) {
    process.env.MODEL_API_KEY = apiKey
    process.env[defaults.apiKeyEnv] = apiKey
  }
  process.env.MODEL_API_URL = apiUrl
  process.env[defaults.apiUrlEnv] = apiUrl

  return { provider, apiKey, apiUrl }
}

function applyTestModelConfigToProcess(content: string, body: z.infer<typeof TestModelConfigSchema>) {
  const provider = normalizeProvider(body.provider ?? getEnvValue(content, 'MODEL_PROVIDER'))
  const defaults = PROVIDER_DEFAULTS[provider]
  const apiKey = body.apiKey?.trim() || getProviderApiKey(content, provider)
  const apiUrl = body.apiUrl ?? getProviderApiUrl(content, provider)

  process.env.MODEL_PROVIDER = provider
  process.env.MODEL_API_URL = apiUrl
  process.env[defaults.apiUrlEnv] = apiUrl
  if (apiKey) {
    process.env.MODEL_API_KEY = apiKey
    process.env[defaults.apiKeyEnv] = apiKey
  }

  return { provider, apiKey, apiUrl }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
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
    const provider = normalizeProvider(getEnvValue(content, 'MODEL_PROVIDER'))
    const apiUrl = getProviderApiUrl(content, provider)
    const apiKey = getProviderApiKey(content, provider)
    const lastError = await readModelError()

    return reply.send({
      data: {
        provider,
        apiUrl,
        hasApiKey: Boolean(apiKey),
        providerKeys: getProviderKeyMap(content),
        envFilePath: ENV_FILE_PATH,
        lastError,
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

    try {
      await writeModelConfigToEnv(body)
    } catch (err) {
      return reply.badRequest(err instanceof Error ? err.message : 'API key is not configured')
    }

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

  app.post('/test', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const userId = request.user.sub

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!membership) return reply.notFound('Project not found')

    const start = Date.now()
    const content = await readEnvFile()
    const body = TestModelConfigSchema.parse(request.body ?? {})
    const current = applyTestModelConfigToProcess(content, body)
    try {
      const result = await withTimeout(
        runAgent({
          systemPrompt: 'You are a helpful assistant. Reply briefly.',
          userMessage: 'Reply with exactly one word: OK',
          maxTokens: 20,
          operation: 'model.test',
        }),
        10000,
        'model test'
      )
      return reply.send({
        data: {
          ok: true,
          provider: current.provider,
          message: result.trim(),
          latencyMs: Date.now() - start,
        },
      })
    } catch (err) {
      return reply.send({
        data: {
          ok: false,
          provider: current.provider,
          message: err instanceof Error ? err.message : String(err),
          latencyMs: Date.now() - start,
        },
      })
    }
  })
}
