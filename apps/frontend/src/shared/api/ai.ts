import {
  AiAnswer,
  AiConfigStatus,
  AiConversation,
  AiDocument,
  AiFileContent,
  AiGenerationResult,
  AiProjectDetail,
  AiProjectFile,
  AiProjectSummary,
} from '../types/domain';
import { apiRequest } from './client';

function normalizeArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item));
}

function normalizeProject(project: any): AiProjectSummary {
  return {
    id: project.id,
    name: project.name,
    sourceType: project.sourceType,
    sourcePath: project.sourcePath,
    projectType: project.projectType,
    summary: project.summary,
    fileCount: Number(project.fileCount || 0),
    moduleCount: Number(project.moduleCount || 0),
    techStack: normalizeArray(project.techStack),
    createdAt: project.createdAt,
  };
}

function normalizeProjectDetail(project: any): AiProjectDetail {
  return {
    ...normalizeProject(project),
    readmeSummary: project.readmeSummary || '',
    keyFiles: normalizeArray(project.keyFiles),
    configFiles: normalizeArray(project.configFiles),
    mainEntryPoints: normalizeArray(project.mainEntryPoints),
    onboardingSteps: normalizeArray(project.onboardingSteps),
  };
}

export const aiApi = {
  importProject: (sourcePath: string, projectName?: string) =>
    apiRequest<any>('/ai/projects/import', {
      method: 'POST',
      body: JSON.stringify({ sourcePath, projectName }),
    }).then(normalizeProjectDetail),

  listProjects: () => apiRequest<any[]>('/ai/projects').then((rows) => rows.map(normalizeProject)),

  getProject: (id: string) => apiRequest<any>(`/ai/projects/${id}`).then(normalizeProjectDetail),

  generateKnowledge: (id: string, provider = 'openai') =>
    apiRequest<AiGenerationResult>(`/ai/projects/${id}/generate`, {
      method: 'POST',
      body: JSON.stringify({ provider }),
    }),

  askQuestion: (id: string, question: string, provider = 'openai') =>
    apiRequest<AiAnswer>(`/ai/projects/${id}/qa`, {
      method: 'POST',
      body: JSON.stringify({ question, provider }),
    }),

  listDocuments: (id: string) => apiRequest<AiDocument[]>(`/ai/projects/${id}/documents`),

  listProjectFiles: (id: string) => apiRequest<AiProjectFile[]>(`/ai/projects/${id}/files`),
  getProjectFileContent: (id: string, filePath: string) =>
    apiRequest<AiFileContent>(`/ai/projects/${id}/files/content?path=${encodeURIComponent(filePath)}`),

  listConversations: (id: string) => apiRequest<AiConversation[]>(`/ai/projects/${id}/conversations`),

  getConfigStatus: (provider = 'openai') => apiRequest<AiConfigStatus>(`/ai/configs/${provider}/status`),

  upsertConfig: (provider: string, apiKey: string) =>
    apiRequest<AiConfigStatus>(`/ai/configs/${provider}`, {
      method: 'PUT',
      body: JSON.stringify({ apiKey }),
    }),

  clearConfig: (provider: string) =>
    apiRequest<{ provider: string; configured: boolean; status: string }>(`/ai/configs/${provider}`, {
      method: 'DELETE',
    }),
};
