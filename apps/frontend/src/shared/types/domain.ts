export type TeamStatus = 'OPEN' | 'FULL' | 'CLOSED' | 'COMPLETED';
export type TeamType = 'COURSE' | 'COMPETITION' | 'VOLUNTEER' | 'CLUB' | 'BOUNTY';
// 后端任务实际有 4 态，但 TaskResponseDto 会把 CONFIRMED 折叠成 DONE 返回。
// 前端看板按 3 列展示，队长“确认完成”单独走 confirm 接口。
export type TaskStatus = 'TODO' | 'DOING' | 'DONE' | 'CONFIRMED';

export interface UserProfile {
  userId: string;
  id?: string;
  email?: string;
  studentNo?: string;
  nickname: string;
  college: string;
  grade: string;
  skills: string[];
  availability: string[];
  completeness: number;
}

export interface PublicProfile extends UserProfile {
  creditScore?: number;
}

export interface Team {
  id: string;
  teamCode?: string;
  ownerId?: string;
  ownerNickname?: string;
  title: string;
  type: TeamType;
  description: string;
  requiredSkills: string[];
  status: TeamStatus;
  maxMembers: number;
  currentMembers: number;
  deadline?: string | null;
  bountyAmount?: number | string | null;
  createdAt?: string;
  updatedAt?: string;
  matchScore?: number;
  myRole?: string;
  owner?: {
    id?: string;
    nickname?: string;
    college?: string;
    grade?: string;
    creditScore?: number;
    profile?: {
      nickname?: string;
      college?: string;
      grade?: string;
    };
  };
  members?: Array<{
    userId: string;
    nickname?: string;
    role: string;
    joinedAt?: string;
    user?: {
      email?: string;
      profile?: {
        nickname?: string;
        college?: string;
        grade?: string;
      };
    };
  }>;
  applications?: {
    pending?: number;
    approved?: number;
    rejected?: number;
  };
}

export interface CreateTeamPayload {
  type: TeamType;
  title: string;
  description: string;
  maxMembers: number;
  requiredSkills: string[];
  deadline?: string;
  bountyAmount?: number;
}

export interface UpdateTeamPayload extends Partial<CreateTeamPayload> {
  teamCode?: string;
}

export interface Task {
  id: string;
  teamId: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  deadline?: string | null;
  createdAt?: string;
  assigneeIds: string[];
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  read: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
}

export interface MatchTeam {
  id: string;
  ownerId?: string;
  ownerNickname?: string;
  type: TeamType;
  title: string;
  description: string;
  requiredSkills: string[];
  status: TeamStatus;
  maxMembers: number;
  currentMembers: number;
  deadline?: string | null;
  bountyAmount?: number | null;
  matchScore: number;
  matchedSkills: string[];
}

export interface MatchUser {
  userId: string;
  studentNo?: string | null;
  nickname: string;
  college?: string | null;
  grade?: string | null;
  skills: string[];
  matchScore: number;
  matchedSkills: string[];
}

export interface TeamApplication {
  id: string;
  teamId: string;
  applicantId: string;
  applicantNickname?: string;
  creditScore?: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';
  createdAt?: string;
  reviewedAt?: string | null;
}

export interface AdminReport {
  id: string;
  targetType?: string;
  reason: string;
  status: string;
  createdAt?: string;
  resolvedAt?: string | null;
  reporter?: {
    email?: string;
    profile?: { nickname?: string };
  };
  reportedUser?: {
    email?: string;
    profile?: { nickname?: string };
  } | null;
  team?: {
    id?: string;
    title?: string;
  } | null;
}

export interface AdminAppeal {
  id: string;
  reviewId: string;
  reason: string;
  status: string;
  createdAt?: string;
  resolvedAt?: string | null;
  user?: {
    email?: string;
    profile?: { nickname?: string };
  };
  review?: {
    id?: string;
    rating?: number;
    comment?: string;
    team?: { id?: string; title?: string };
  };
}

export interface AdminAuditLog {
  id: string;
  action: string;
  actorId?: string | null;
  target?: string | null;
  createdAt?: string;
  actor?: {
    email?: string;
    profile?: { nickname?: string };
  } | null;
}

export interface AdminAccount {
  id: string;
  email: string;
  studentNo: string;
  role: 'STUDENT' | 'ADMIN';
  status: 'ACTIVE' | 'DISABLED';
  disabledAt?: string | null;
  disabledReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
  nickname: string;
  college: string;
  grade: string;
  skills: string[];
  availability: Array<{ weekday: number; startTime: string; endTime: string }>;
}

export interface CreditScore {
  userId?: string;
  baseScore?: number;
  totalScore: number;
}

export interface CreditReview {
  id: string;
  teamId?: string;
  revieweeId?: string;
  reviewerId?: string;
  reviewerName?: string;
  teamTitle?: string;
  teamType?: TeamType;
  rating: number;
  tags: string[];
  comment: string;
  createdAt?: string;
  team?: {
    id?: string;
    title?: string;
    type?: TeamType;
  };
  reviewer?: {
    id?: string;
    email?: string;
    profile?: {
      nickname?: string;
    };
  };
}

export interface CreateReviewPayload {
  revieweeId: string;
  rating: number;
  tags?: string[];
  comment: string;
}

export interface AiProjectSummary {
  id: string;
  name: string;
  sourceType: string;
  sourcePath: string;
  projectType: string;
  summary: string;
  fileCount: number;
  moduleCount: number;
  techStack?: string[];
  createdAt?: string;
}

export interface AiProjectDetail extends AiProjectSummary {
  readmeSummary?: string;
  keyFiles?: string[];
  configFiles?: string[];
  mainEntryPoints?: string[];
  onboardingSteps?: string[];
}

export interface AiDocument {
  id: string;
  projectId: string;
  title: string;
  docType: string;
  content: string;
  createdAt?: string;
}

export interface AiProjectFile {
  path: string;
  title: string;
  docType: 'markdown' | 'text';
}

export interface AiFileContent {
  path: string;
  content: string;
}

export interface AiCitation {
  documentId: string;
  title: string;
  snippet: string;
}

export interface AiConversation {
  id: string;
  projectId: string;
  question: string;
  answer: string;
  citations?: AiCitation[];
  mode?: 'llm' | 'local-fallback';
  fallbackReason?: string | null;
  fallbackMessage?: string | null;
  fallbackDetail?: string | null;
  createdAt?: string;
}

export interface AiAnswer {
  projectId: string;
  question: string;
  answer: string;
  citations: AiCitation[];
  conversationId: string;
  provider?: string;
  mode?: 'llm' | 'local-fallback';
  fallbackReason?: string | null;
  fallbackMessage?: string | null;
  fallbackDetail?: string | null;
}

export interface AiGenerationResult {
  document: AiDocument;
  provider: string;
  mode: 'llm' | 'local-fallback';
  fallbackReason?: string | null;
  fallbackMessage?: string | null;
  fallbackDetail?: string | null;
}

export interface AiConfigStatus {
  provider: string;
  configured: boolean;
  source: 'env' | 'secure_store' | 'db' | 'none';
  keyHint?: string | null;
  status: string;
  updatedAt?: string | null;
}
