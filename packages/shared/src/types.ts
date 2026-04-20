import type {
  ScenarioType,
  AgentType,
  TaskStatus,
  ExecutionStatus,
  MemberRole,
  KnowledgeCategory,
  PlatformRole,
  ToneOfVoice,
  ConversationRole,
  FilePurpose,
  ApprovalDecision,
  BillingPlan,
} from './enums'

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  email: string
  name: string | null
  platformRole: PlatformRole
  emailVerified: boolean
}

export interface AuthTokens {
  accessToken: string
  refreshToken?: string
}

export interface LoginResponse {
  user: AuthUser
  tokens: AuthTokens
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export interface Project {
  id: string
  ownerId: string
  name: string
  settings: ProjectSettings
  createdAt: string
}

export interface ProjectSettings {
  language?: string
  defaultScenario?: ScenarioType
}

export interface ProjectMember {
  id: string
  userId: string
  projectId: string
  role: MemberRole
  createdAt: string
}

// ─── Project Profile (§6.3 / §12.1 ТЗ) ──────────────────────────────────────

export interface ProjectProfileProduct {
  name: string
  description: string
  price?: string
}

export interface ProjectProfileAudience {
  segment: string
  portrait: string
  pain_points: string[]
}

export interface ProjectProfileCompetitor {
  name: string
  url?: string
  positioning: string
}

export interface ProjectProfileReference {
  url: string
  description: string
}

export interface ProjectProfileSocialLinks {
  instagram?: string
  telegram?: string
  vk?: string
  youtube?: string
}

export interface ProjectProfileKpi {
  cac?: number
  ltv?: number
  conversion_rate?: number
  avg_check?: number
}

export interface ProjectProfile {
  id: string
  projectId: string
  // Tier 1 — required
  companyName: string
  description: string
  niche: string
  geography: string
  // Tier 2 — recommended
  products: ProjectProfileProduct[]
  audience: ProjectProfileAudience[]
  usp: string | null
  competitors: ProjectProfileCompetitor[]
  tov: ToneOfVoice
  keywords: string[]
  forbidden: string[]
  references: ProjectProfileReference[]
  // Tier 3 — full profile
  websiteUrl: string | null
  socialLinks: ProjectProfileSocialLinks
  kpi: ProjectProfileKpi
  existingContent: string | null
  createdAt: string
  updatedAt: string
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export interface Task {
  id: string
  projectId: string
  input: string
  score: number
  status: TaskStatus
  scenario: ScenarioType | null
  clarificationNote: string | null
  rejectedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface TaskWithExecutions extends Task {
  executions: Execution[]
}

// ─── Executions ───────────────────────────────────────────────────────────────

export interface Execution {
  id: string
  taskId: string
  projectId: string
  scenario: ScenarioType
  status: ExecutionStatus
  createdAt: string
  finishedAt: string | null
}

export interface ExecutionWithOutputs extends Execution {
  agentOutputs: AgentOutput[]
}

// ─── Agent Outputs ────────────────────────────────────────────────────────────

export interface AgentOutput {
  id: string
  executionId: string
  agentType: AgentType
  output: string
  iteration: number
  evalScore: number | null
  createdAt: string
}

// ─── Conversations (§5.1 / §11.3 ТЗ) ─────────────────────────────────────────

export interface Conversation {
  id: string
  projectId: string
  taskId: string | null
  role: ConversationRole
  content: string
  agentType: AgentType | null
  createdAt: string
}

// ─── Files (§9.3 / §8 ТЗ) ────────────────────────────────────────────────────

export interface File {
  id: string
  projectId: string
  taskId: string | null
  filename: string
  mimeType: string
  sizeBytes: number
  storagePath: string
  purpose: FilePurpose
  createdAt: string
}

// ─── Approvals (§11.4 ТЗ) ────────────────────────────────────────────────────

export interface Approval {
  id: string
  projectId: string
  taskId: string
  decision: ApprovalDecision
  comment: string | null
  iteration: number
  decidedById: string | null
  createdAt: string
}

// ─── Agent Feedback (§9.1 ТЗ) ────────────────────────────────────────────────

export interface AgentFeedback {
  id: string
  projectId: string
  taskId: string
  agentType: AgentType
  score: number
  comment: string | null
  createdAt: string
}

// ─── Billing ──────────────────────────────────────────────────────────────────

export interface Billing {
  id: string
  projectId: string
  plan: BillingPlan
  tasksLimit: number
  tasksUsed: number
  tokensUsed: string // BigInt serialized as string
  periodStart: string
  periodEnd: string | null
  createdAt: string
  updatedAt: string
}

// ─── Knowledge ────────────────────────────────────────────────────────────────

export interface KnowledgeItem {
  id: string
  projectId: string
  category: KnowledgeCategory
  content: string
  metadata: KnowledgeMetadata
  createdAt: string
}

export interface KnowledgeMetadata {
  title?: string
  source?: string
  platform?: string
  tags?: string[]
}

export interface KnowledgeSearchResult {
  item: KnowledgeItem
  similarity: number
}

// ─── SSE Stream Events ────────────────────────────────────────────────────────

export type SSEEventType =
  | 'execution.started'
  | 'agent.thinking'
  | 'agent.output'
  | 'agent.iteration'
  | 'execution.completed'
  | 'execution.failed'

export interface SSEEvent {
  type: SSEEventType
  executionId: string
  agentType?: AgentType
  content?: string
  iteration?: number
  scenario?: ScenarioType
  error?: string
  timestamp: string
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface ApiError {
  error: string
  code?: string
  details?: Record<string, string[]>
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}
