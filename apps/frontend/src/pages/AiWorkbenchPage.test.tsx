import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiWorkbenchPage } from './AiWorkbenchPage';

const listProjectsMock = vi.fn();
const getConfigStatusMock = vi.fn();
const getProjectMock = vi.fn();
const listProjectFilesMock = vi.fn();
const getProjectFileContentMock = vi.fn();
const listDocumentsMock = vi.fn();
const listConversationsMock = vi.fn();
const generateKnowledgeMock = vi.fn();
const askQuestionMock = vi.fn();

vi.mock('../shared/api/ai', () => ({
  aiApi: {
    listProjects: (...args: unknown[]) => listProjectsMock(...args),
    getConfigStatus: (...args: unknown[]) => getConfigStatusMock(...args),
    getProject: (...args: unknown[]) => getProjectMock(...args),
    listProjectFiles: (...args: unknown[]) => listProjectFilesMock(...args),
    getProjectFileContent: (...args: unknown[]) => getProjectFileContentMock(...args),
    listDocuments: (...args: unknown[]) => listDocumentsMock(...args),
    listConversations: (...args: unknown[]) => listConversationsMock(...args),
    generateKnowledge: (...args: unknown[]) => generateKnowledgeMock(...args),
    askQuestion: (...args: unknown[]) => askQuestionMock(...args),
  },
}));

describe('AiWorkbenchPage', () => {
  beforeEach(() => {
    listProjectsMock.mockResolvedValue([
      { id: 'project-1', name: '测试项目', sourceType: 'local', sourcePath: 'C:/tmp', projectType: 'React', summary: '测试项目摘要', fileCount: 10, moduleCount: 1 },
    ]);
    getConfigStatusMock.mockResolvedValue({ provider: 'openai', configured: true, source: 'env', status: 'ready', keyHint: '已配置' });
    getProjectMock.mockResolvedValue({ id: 'project-1', name: '测试项目', sourceType: 'local', sourcePath: 'C:/tmp', projectType: 'React', summary: '测试项目摘要', fileCount: 10, moduleCount: 1 });
    listProjectFilesMock.mockResolvedValue([
      { path: 'README.md', title: 'README', docType: 'markdown' },
    ]);
    getProjectFileContentMock.mockResolvedValue({ path: 'README.md', content: '这是文档内容。' });
    listDocumentsMock.mockResolvedValue([
      { id: 'doc-1', projectId: 'project-1', title: 'README 摘要', docType: 'knowledge', content: '这是完整知识摘要内容。' },
    ]);
    listConversationsMock.mockResolvedValue([]);
    generateKnowledgeMock.mockResolvedValue({ document: { id: 'doc-1', projectId: 'project-1', title: 'README 摘要', docType: 'knowledge', content: '这是文档内容。' }, provider: 'openai', mode: 'llm' });
    askQuestionMock.mockResolvedValue({ projectId: 'project-1', question: '测试问题', answer: '测试回答', citations: [], conversationId: 'conversation-1' });
  });

  it('shows document view modal when clicking 查看文档', async () => {
    render(<AiWorkbenchPage />);

    await waitFor(() => expect(listProjectsMock).toHaveBeenCalled());
    await waitFor(() => expect(getConfigStatusMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('这是完整知识摘要内容。')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: '查看文档' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '查看文档' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('这是文档内容。')).toBeInTheDocument();
  });
});
