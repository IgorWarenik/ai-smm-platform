export enum PlatformRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  MANAGER = 'MANAGER',
  USER = 'USER',
}

export enum MemberRole {
  OWNER = 'OWNER',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

export enum ToneOfVoice {
  OFFICIAL = 'OFFICIAL',
  FRIENDLY = 'FRIENDLY',
  EXPERT = 'EXPERT',
  PROVOCATIVE = 'PROVOCATIVE',
}

export enum ScenarioType {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
}

export enum AgentType {
  MARKETER = 'MARKETER',
  CONTENT_MAKER = 'CONTENT_MAKER',
  EVALUATOR = 'EVALUATOR',
}

export enum TaskStatus {
  PENDING = 'PENDING',
  REJECTED = 'REJECTED',
  AWAITING_CLARIFICATION = 'AWAITING_CLARIFICATION',
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum ExecutionStatus {
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum KnowledgeCategory {
  FRAMEWORK = 'FRAMEWORK',
  CASE = 'CASE',
  TEMPLATE = 'TEMPLATE',
  SEO = 'SEO',
  PLATFORM_SPEC = 'PLATFORM_SPEC',
  BRAND_GUIDE = 'BRAND_GUIDE',
}

export enum ConversationRole {
  USER = 'USER',
  AGENT = 'AGENT',
  SYSTEM = 'SYSTEM',
}

export enum FilePurpose {
  TASK_INPUT = 'TASK_INPUT',
  TASK_OUTPUT = 'TASK_OUTPUT',
  BRAND_ASSET = 'BRAND_ASSET',
  REFERENCE = 'REFERENCE',
}

export enum ApprovalDecision {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REVISION_REQUESTED = 'REVISION_REQUESTED',
}

export enum BillingPlan {
  FREE = 'FREE',
  BASIC = 'BASIC',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE',
}

// Task scoring threshold — tasks below this score are rejected (§11.1 ТЗ)
export const TASK_SCORE_THRESHOLD = 25

// Score range requiring clarification questions (§11.1 ТЗ)
export const TASK_SCORE_CLARIFICATION_MIN = 25
export const TASK_SCORE_CLARIFICATION_MAX = 39

// Max revision iterations before manager escalation (§11.4 ТЗ)
export const SCENARIO_D_MAX_ITERATIONS = 3
export const APPROVAL_MAX_REVISIONS = 3
