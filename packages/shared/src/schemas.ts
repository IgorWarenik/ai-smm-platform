import { z } from 'zod'
import {
  ScenarioType,
  AgentType,
  TaskStatus,
  KnowledgeCategory,
  MemberRole,
  ToneOfVoice,
  ApprovalDecision,
  FilePurpose,
} from './enums'
import { TASK_SCORE_THRESHOLD } from './enums'

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100).optional(),
})

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
})

// ─── Projects ─────────────────────────────────────────────────────────────────

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  settings: z
    .object({
      language: z.string().optional(),
      defaultScenario: z.nativeEnum(ScenarioType).optional(),
    })
    .optional()
    .default({}),
})

export const UpdateProjectSchema = CreateProjectSchema.partial()

export const AddProjectMemberSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(MemberRole).default(MemberRole.MEMBER),
})

// ─── Project Profile (§12.1 ТЗ) ──────────────────────────────────────────────

const ProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  price: z.string().optional(),
})

const AudienceSchema = z.object({
  segment: z.string().min(1),
  portrait: z.string().min(1),
  pain_points: z.array(z.string()).default([]),
})

const CompetitorSchema = z.object({
  name: z.string().min(1),
  url: z.string().url().optional(),
  positioning: z.string().min(1),
})

const ReferenceSchema = z.object({
  url: z.string().url(),
  description: z.string().min(1),
})

// Tier 1 — required minimum
export const CreateProjectProfileSchema = z.object({
  companyName: z.string().min(1).max(200),
  description: z.string().min(10).max(2000),
  niche: z.string().min(1).max(200),
  geography: z.string().min(1).max(200).default('Russia'),
  // Tier 2 — recommended
  products: z.array(ProductSchema).default([]),
  audience: z.array(AudienceSchema).default([]),
  usp: z.string().max(500).optional(),
  competitors: z.array(CompetitorSchema).default([]),
  tov: z.nativeEnum(ToneOfVoice).default(ToneOfVoice.FRIENDLY),
  keywords: z.array(z.string()).default([]),
  forbidden: z.array(z.string()).default([]),
  references: z.array(ReferenceSchema).default([]),
  // Tier 3 — full profile
  websiteUrl: z.string().url().optional(),
  socialLinks: z
    .object({
      instagram: z.string().optional(),
      telegram: z.string().optional(),
      vk: z.string().optional(),
      youtube: z.string().optional(),
    })
    .default({}),
  kpi: z
    .object({
      cac: z.number().optional(),
      ltv: z.number().optional(),
      conversion_rate: z.number().min(0).max(100).optional(),
      avg_check: z.number().optional(),
    })
    .default({}),
  existingContent: z.string().max(5000).optional(),
})

export const UpdateProjectProfileSchema = CreateProjectProfileSchema.partial()

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const CreateTaskSchema = z.object({
  input: z
    .string()
    .min(10, 'Task description must be at least 10 characters')
    .max(5000),
})

export const ExecuteTaskSchema = z.object({
  // Optionally override the auto-detected scenario
  scenario: z.nativeEnum(ScenarioType).optional(),
})

// Clarification response from the client (§11.2 ТЗ)
export const ClarificationResponseSchema = z.object({
  answer: z.string().min(1).max(5000),
})

// Task scoring result returned by the scoring service
export const TaskScoringResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  scenario: z.nativeEnum(ScenarioType),
  reasoning: z.string(),
  isValid: z.boolean(),
  clarificationQuestions: z.array(z.string()).optional(),
})

export type TaskScoringResult = z.infer<typeof TaskScoringResultSchema>

// ─── Approvals (§11.4 ТЗ) ────────────────────────────────────────────────────

const MIN_REVISION_CHARS = 50 // mirrors MIN_REVISION_FEEDBACK_CHARS in ai-engine

export const CreateApprovalSchema = z
  .object({
    decision: z.nativeEnum(ApprovalDecision),
    comment: z.string().max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.decision !== ApprovalDecision.REVISION_REQUESTED) return

    if (!data.comment || data.comment.trim().length < MIN_REVISION_CHARS) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_small,
        minimum: MIN_REVISION_CHARS,
        type: 'string',
        inclusive: true,
        message: `Revision feedback must be at least ${MIN_REVISION_CHARS} characters`,
        path: ['comment'],
      })
    }
  })

export type CreateApprovalInput = z.infer<typeof CreateApprovalSchema>

// ─── Agent Feedback (§9.1 ТЗ) ────────────────────────────────────────────────

export const CreateAgentFeedbackSchema = z.object({
  agentType: z.nativeEnum(AgentType),
  score: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
})

export type CreateAgentFeedbackInput = z.infer<typeof CreateAgentFeedbackSchema>

// ─── Files ────────────────────────────────────────────────────────────────────

export const FileQuerySchema = z.object({
  taskId: z.string().uuid().optional(),
  purpose: z.nativeEnum(FilePurpose).optional(),
})

// ─── Knowledge ────────────────────────────────────────────────────────────────

export const CreateKnowledgeItemSchema = z.object({
  category: z.nativeEnum(KnowledgeCategory),
  content: z.string().min(1).max(50000),
  metadata: z
    .object({
      title: z.string().optional(),
      source: z.string().optional(),
      platform: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional()
    .default({}),
})

export const KnowledgeSearchSchema = z.object({
  q: z.string().min(1).max(500),
  category: z.nativeEnum(KnowledgeCategory).optional(),
  limit: z.coerce.number().int().min(1).max(20).default(5),
  maxCharsPerChunk: z.coerce.number().int().min(100).max(5000).default(1200),
  maxTotalChars: z.coerce.number().int().min(500).max(20000).default(4000),
  minSimilarity: z.coerce.number().min(0).max(1).default(0.72),
})

// ─── Pagination ───────────────────────────────────────────────────────────────

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const TaskQuerySchema = PaginationSchema.extend({
  status: z.nativeEnum(TaskStatus).optional(),
})

export type TaskQueryInput = z.infer<typeof TaskQuerySchema>

// ─── n8n Webhook payloads (sent by Fastify to n8n) ────────────────────────────

export const OrchestratorWebhookPayloadSchema = z.object({
  executionId: z.string().uuid(),
  taskId: z.string().uuid(),
  projectId: z.string().uuid(),
  input: z.string(),
  scenario: z.nativeEnum(ScenarioType),
  callbackUrl: z.string().url(),
  // Task quality score (0-100) used by Scenario A to select model tier
  taskScore: z.number().int().min(0).max(100).optional(),
  // Project profile injected so agents have full business context (§6.3 / §12.1 ТЗ)
  projectProfile: z
    .object({
      companyName: z.string(),
      description: z.string(),
      niche: z.string(),
      geography: z.string(),
      products: z.array(z.any()).default([]),
      audience: z.array(z.any()).default([]),
      usp: z.string().nullable().optional(),
      competitors: z.array(z.any()).default([]),
      tov: z.nativeEnum(ToneOfVoice),
      keywords: z.array(z.string()).default([]),
      forbidden: z.array(z.string()).default([]),
    })
    .nullable()
    .optional(),
})

export type OrchestratorWebhookPayload = z.infer<typeof OrchestratorWebhookPayloadSchema>

// ─── n8n → Fastify callback (agent result) ───────────────────────────────────

export const AgentResultCallbackSchema = z.object({
  executionId: z.string().uuid(),
  agentType: z.nativeEnum(AgentType),
  output: z.string(),
  iteration: z.number().int().min(1).default(1),
  evalScore: z.number().int().min(0).max(100).optional(),
  status: z.enum(['completed', 'failed']),
  error: z.string().optional(),
})

export type AgentResultCallback = z.infer<typeof AgentResultCallbackSchema>

// ─── n8n → Fastify execution-complete ────────────────────────────────────────

export const ExecutionCompleteSchema = z.object({
  executionId: z.string().uuid(),
  // Scenario D: true when all 3 iterations exhausted without evaluator pass.
  // Causes task.requiresReview = true and SSE event includes requiresReview flag.
  iterationsFailed: z.boolean().optional(),
})

export type ExecutionCompleteInput = z.infer<typeof ExecutionCompleteSchema>

// ─── Inferred types ───────────────────────────────────────────────────────────

export type LoginInput = z.infer<typeof LoginSchema>
export type RegisterInput = z.infer<typeof RegisterSchema>
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>
export type CreateProjectProfileInput = z.infer<typeof CreateProjectProfileSchema>
export type UpdateProjectProfileInput = z.infer<typeof UpdateProjectProfileSchema>
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>
export type ExecuteTaskInput = z.infer<typeof ExecuteTaskSchema>
export type ClarificationResponseInput = z.infer<typeof ClarificationResponseSchema>
export type CreateKnowledgeItemInput = z.infer<typeof CreateKnowledgeItemSchema>
export type KnowledgeSearchInput = z.infer<typeof KnowledgeSearchSchema>
export type PaginationInput = z.infer<typeof PaginationSchema>
