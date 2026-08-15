import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Bot, Brain, KeyRound, Sparkles, Wand2 } from 'lucide-react';
import { aiApi } from '../shared/api/ai';
import { ApiError } from '../shared/api/client';
import { AppModal } from '../shared/components/AppModal';
import { DataState } from '../shared/components/DataState';
import { EmptyState } from '../shared/components/EmptyState';
import { PageHero } from '../shared/components/PageHero';
import { AiConversation, AiDocument, AiFileContent, AiGenerationResult, AiProjectDetail, AiProjectFile, AiProjectSummary } from '../shared/types/domain';

export function AiWorkbenchPage() {
  const [projects, setProjects] = useState<AiProjectSummary[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedProject, setSelectedProject] = useState<AiProjectDetail | null>(null);
  const [projectFiles, setProjectFiles] = useState<AiProjectFile[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState('');
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [documents, setDocuments] = useState<AiDocument[]>([]);
  const [configStatus, setConfigStatus] = useState<'checking' | 'ready' | 'missing'>('checking');
  const [configHint, setConfigHint] = useState('');

  const latestDocument = documents[0] || null;

  const [sourcePath, setSourcePath] = useState('');
  const [projectName, setProjectName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [question, setQuestion] = useState('');
  const [openedDocument, setOpenedDocument] = useState<AiFileContent | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<AiFileContent | null>(null);

  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [message, setMessage] = useState('');
  const [lastGeneration, setLastGeneration] = useState<AiGenerationResult | null>(null);

  const canAsk = selectedId && question.trim().length >= 2;
  const selectedFile = useMemo(
    () => projectFiles.find((file) => file.path === selectedFilePath) || projectFiles[0] || null,
    [projectFiles, selectedFilePath],
  );

  useEffect(() => {
    if (projectFiles.length === 0) {
      setSelectedFilePath('');
      setSelectedFileContent(null);
      return;
    }

    if (!projectFiles.some((file) => file.path === selectedFilePath)) {
      setSelectedFilePath(projectFiles[0].path);
    }
  }, [projectFiles, selectedFilePath]);

  useEffect(() => {
    if (!selectedId || !selectedFilePath) {
      return;
    }

    let cancelled = false;
    setBusyAction('loading-file');
    setSelectedFileContent(null);

    aiApi
      .getProjectFileContent(selectedId, selectedFilePath)
      .then((file) => {
        if (!cancelled) {
          setSelectedFileContent(file);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          const reason = error instanceof ApiError ? error.message : '无法读取文件内容';
          setMessage(`读取文件失败：${reason}`);
        }
      })
      .finally(() => {
        if (!cancelled) setBusyAction('');
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId, selectedFilePath]);

  async function loadProjects() {
    const rows = await aiApi.listProjects();
    setProjects(rows);
    if (!selectedId && rows.length > 0) {
      setSelectedId(rows[0].id);
    }
  }

  async function loadConfig() {
    const status = await aiApi.getConfigStatus('openai');
    setConfigStatus(status.configured ? 'ready' : 'missing');
    setConfigHint(status.keyHint || '');
  }

  async function loadProjectData(id: string) {
    const [project, files, docs, history] = await Promise.all([
      aiApi.getProject(id),
      aiApi.listProjectFiles(id),
      aiApi.listDocuments(id),
      aiApi.listConversations(id),
    ]);
    setSelectedProject(project);
    setProjectFiles(files);
    setDocuments(docs);
    setConversations(history);
    if (files.length > 0) {
      setSelectedFilePath(files[0].path);
    }
  }

  useEffect(() => {
    setLoading(true);
    setMessage('');
    Promise.all([loadProjects(), loadConfig()])
      .catch((error) => {
        const reason = error instanceof ApiError ? error.message : '初始化失败';
        setMessage(`初始化失败：${reason}`);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSelectedProject(null);
      setProjectFiles([]);
      setSelectedFilePath('');
      setConversations([]);
      return;
    }

    setBusyAction('loading-project');
    setMessage('');
    loadProjectData(selectedId)
      .catch((error) => {
        const reason = error instanceof ApiError ? error.message : '加载项目数据失败';
        setMessage(`加载失败：${reason}`);
      })
      .finally(() => setBusyAction(''));
  }, [selectedId]);

  async function onImportProject(event: FormEvent) {
    event.preventDefault();
    if (!sourcePath.trim()) {
      setMessage('请输入项目路径或 Git 仓库地址。');
      return;
    }

    setBusyAction('import');
    setMessage('');
    try {
      const created = await aiApi.importProject(sourcePath.trim(), projectName.trim() || undefined);
      setSourcePath('');
      setProjectName('');
      await loadProjects();
      setSelectedId(created.id);
      setMessage('项目导入成功。');
    } catch (error) {
      const reason = error instanceof ApiError ? error.message : '导入失败';
      setMessage(`导入失败：${reason}`);
    } finally {
      setBusyAction('');
    }
  }

  async function onSaveApiKey(event: FormEvent) {
    event.preventDefault();
    if (apiKey.trim().length < 8) {
      setMessage('API Key 长度至少 8 位。');
      return;
    }

    setBusyAction('config');
    setMessage('');
    try {
      await aiApi.upsertConfig('openai', apiKey.trim());
      setApiKey('');
      await loadConfig();
      setMessage('API Key 已加密保存。');
    } catch (error) {
      const reason = error instanceof ApiError ? error.message : '保存失败';
      setMessage(`保存配置失败：${reason}`);
    } finally {
      setBusyAction('');
    }
  }

  async function onClearApiKey() {
    setBusyAction('clear-config');
    setMessage('');
    try {
      await aiApi.clearConfig('openai');
      await loadConfig();
      setApiKey('');
      setMessage('已清除保存的 API Key。');
    } catch (error) {
      const reason = error instanceof ApiError ? error.message : '清除失败';
      setMessage(`清除配置失败：${reason}`);
    } finally {
      setBusyAction('');
    }
  }

  async function onGenerateSummary() {
    if (!selectedId || !selectedProject) {
      setMessage('请先选择项目。');
      return;
    }
    setBusyAction('generate');
    setMessage('正在扫描项目并请求 Token Hub，请稍候...');
    try {
      const result = await aiApi.generateKnowledge(selectedId, 'openai');
      setLastGeneration(result);
      setDocuments((previous) => [result.document, ...previous.filter((doc) => doc.id !== result.document.id)]);
      if (result.mode === 'llm') {
        setMessage('知识摘要已生成（来源：LLM）。');
      } else {
        setMessage(`知识摘要已生成（来源：本地回退）。${result.fallbackMessage ? ` 原因：${result.fallbackMessage}` : ''}`);
      }
    } catch (error) {
      const reason = error instanceof ApiError ? error.message : '生成失败';
      setMessage(`生成失败：${reason}`);
    } finally {
      setBusyAction('');
    }
  }

  async function onAskQuestion(event: FormEvent) {
    event.preventDefault();
    if (!selectedId || !question.trim()) return;

    setBusyAction('qa');
    setMessage('');
    try {
      const answer = await aiApi.askQuestion(selectedId, question.trim(), 'openai');
      setQuestion('');
      setConversations((previous) => [
        {
          id: answer.conversationId,
          projectId: answer.projectId,
          question: answer.question,
          answer: answer.answer,
          citations: answer.citations,
          mode: answer.mode,
          fallbackReason: answer.fallbackReason,
          fallbackMessage: answer.fallbackMessage,
        },
        ...previous,
      ]);
    } catch (error) {
      const reason = error instanceof ApiError ? error.message : '问答失败';
      setMessage(`问答失败：${reason}`);
    } finally {
      setBusyAction('');
    }
  }

  return (
    <section className="market-page ai-page">
      <PageHero
        icon={<Sparkles size={16} />}
        eyebrow="代码仓库知识地图生成器"
        title="代码仓库知识地图生成器"
        description="导入项目路径后，一键生成知识摘要并进行基于上下文的项目问答。"
      />

      {message ? <DataState tone="info">{message}</DataState> : null}
      {loading ? <DataState tone="loading">正在初始化 AI 模块...</DataState> : null}

      <div className="market-grid ai-grid ai-top-panels">
        <div className="panel">
          <h2><KeyRound size={16} /> 凭据状态</h2>
          <p>OpenAI Key 状态：{configStatus === 'ready' ? `已配置 ${configHint}` : configStatus === 'missing' ? '未配置（将使用本地回退回答）' : '检测中'}</p>
          <form onSubmit={onSaveApiKey} className="ai-form">
            <label>
              OpenAI API Key
              <input
                type="password"
                placeholder="sk-..."
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
              />
            </label>
            <button type="submit" disabled={busyAction === 'config'}>{busyAction === 'config' ? '保存中...' : '保存 Key（加密）'}</button>
            <button type="button" className="secondary" onClick={onClearApiKey} disabled={busyAction === 'clear-config' || configStatus === 'missing'}>
              {busyAction === 'clear-config' ? '清除中...' : '清除已保存 Key'}
            </button>
          </form>
        </div>

        <div className="panel">
          <h2><Brain size={16} /> 导入项目</h2>
          <form onSubmit={onImportProject} className="ai-form">
            <label>
              项目路径或 Git 地址
              <input
                placeholder="例如：C:\\Users\\fusheng\\Desktop\\暑假项目\\project"
                value={sourcePath}
                onChange={(event) => setSourcePath(event.target.value)}
              />
            </label>
            <label>
              项目别名（可选）
              <input
                placeholder="例如：暑假项目"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
              />
            </label>
            <button type="submit" disabled={busyAction === 'import'}>{busyAction === 'import' ? '导入中...' : '导入并解析'}</button>
          </form>
        </div>
      </div>

      <div className="market-grid ai-grid ai-main-grid">
        <div className="panel ai-project-panel">
          <h2><Bot size={16} /> 已导入项目</h2>
          {projects.length === 0 ? (
            <EmptyState compact title="暂无项目" description="先导入一个项目路径后即可生成知识地图。" />
          ) : (
            <div className="ai-project-list">
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  className={project.id === selectedId ? 'ai-project-item active' : 'ai-project-item'}
                  onClick={() => setSelectedId(project.id)}
                >
                  <strong>{project.name}</strong>
                  <span>{project.projectType} · {project.fileCount} 文件</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="panel ai-project-detail-panel">
          <div className="ai-summary-card">
            <div className="ai-summary-header">
              <div>
                <h2><Wand2 size={16} /> 知识摘要</h2>
                <p className="ai-summary-description">基于当前项目源代码生成高质量知识摘要，并支持后续项目问答。</p>
              </div>
                      <button
                        type="button"
                        className="button-link secondary"
                        onClick={onGenerateSummary}
                        disabled={!selectedProject || busyAction === 'generate'}
                      >
                {busyAction === 'generate' ? '生成中...' : '生成知识摘要'}
              </button>
            </div>
            {!selectedProject ? (
              <DataState tone="empty">请先选择项目。</DataState>
            ) : (
              <>
                {latestDocument ? (
                  <div className="ai-summary-preview">
                    <div className="ai-summary-preview-scroll">
                      <pre>{latestDocument.content}</pre>
                    </div>
                    <p className="ai-summary-meta">当前展示：{latestDocument.title}</p>
                  </div>
                ) : (
                  <p>{selectedProject.summary || '该项目尚未生成摘要，点击上方按钮开始生成。'}</p>
                )}
                {lastGeneration ? (
                  <>
                    <p className={lastGeneration.mode === 'llm' ? 'ai-mode-hint success' : 'ai-mode-hint warning'}>
                      本次摘要来源：{lastGeneration.mode === 'llm' ? 'LLM' : '本地回退'}
                      {lastGeneration.mode !== 'llm' && lastGeneration.fallbackMessage ? `；原因：${lastGeneration.fallbackMessage}` : ''}
                    </p>
                    {lastGeneration.mode !== 'llm' && lastGeneration.fallbackDetail ? (
                      <p className="ai-mode-debug">诊断：{lastGeneration.fallbackDetail}</p>
                    ) : null}
                  </>
                ) : null}
              </>
            )}
          </div>

          {projectFiles.length > 0 ? (
            <div className="ai-document-viewer">
              <aside className="ai-document-sidebar">
                <div className="ai-document-sidebar-head">
                  <h3>文件浏览</h3>
                  <p>选择一个文件查看内容预览。</p>
                </div>
                <div className="ai-document-list">
                  {projectFiles.map((file) => (
                    <button
                      key={file.path}
                      type="button"
                      className={file.path === selectedFilePath ? 'ai-document-item active' : 'ai-document-item'}
                      onClick={() => setSelectedFilePath(file.path)}
                    >
                      <strong>{file.title}</strong>
                      <small>{file.path}</small>
                    </button>
                  ))}
                </div>
              </aside>

              <section className="ai-document-content">
                {selectedFile ? (
                  <>
                    <div className="ai-document-content-header">
                      <div>
                        <h3>{selectedFile.title}</h3>
                        <p className="ai-document-meta">{selectedFile.path}</p>
                      </div>
                      <button type="button" className="button-link small" onClick={() => selectedFileContent && setOpenedDocument(selectedFileContent)}>
                        查看文档
                      </button>
                    </div>
                    {selectedFileContent ? (
                      <pre className="ai-markdown-preview">{selectedFileContent.content}</pre>
                    ) : (
                      <DataState tone="loading">正在加载文件内容...</DataState>
                    )}
                  </>
                ) : (
                  <DataState tone="empty">请选择要查看的文件。</DataState>
                )}
              </section>
            </div>
          ) : (
            <DataState tone="info">未发现可浏览的项目文档。</DataState>
          )}
        </div>
      </div>

      <div className="panel ai-qa-panel">
        <h2>项目问答</h2>
        <form onSubmit={onAskQuestion} className="ai-form">
          <label>
            输入问题
            <input
              placeholder="例如：这个项目如何启动？关键模块有哪些？"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
          </label>
          <button type="submit" disabled={!canAsk || busyAction === 'qa'}>{busyAction === 'qa' ? '回答中...' : '提问'}</button>
        </form>

        {conversations.length === 0 ? (
          <DataState tone="empty">暂无问答记录。</DataState>
        ) : (
          <div className="ai-conversation-list">
            {conversations.map((item) => (
              <article key={item.id} className="ai-conversation-item">
                <h3>Q: {item.question}</h3>
                {item.mode ? (
                  <>
                    <p className={item.mode === 'llm' ? 'ai-mode-hint success' : 'ai-mode-hint warning'}>
                      回答来源：{item.mode === 'llm' ? 'LLM' : '本地回退'}
                      {item.mode !== 'llm' && item.fallbackMessage ? `；原因：${item.fallbackMessage}` : ''}
                    </p>
                    {item.mode !== 'llm' && item.fallbackDetail ? (
                      <p className="ai-mode-debug">诊断：{item.fallbackDetail}</p>
                    ) : null}
                  </>
                ) : null}
                <p>A: {item.answer}</p>
                {item.citations && item.citations.length > 0 ? (
                  <ul>
                    {item.citations.map((citation, index) => (
                      <li key={`${item.id}-${index}`}>
                        [{index + 1}] {citation.title}: {citation.snippet}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>

      <AppModal
        open={Boolean(openedDocument)}
        title={openedDocument?.path ?? '文档详情'}
        description={openedDocument ? '在此查看完整文档内容。' : undefined}
        onClose={() => setOpenedDocument(null)}
      >
        {openedDocument ? <pre className="ai-markdown-preview">{openedDocument.content}</pre> : null}
      </AppModal>
    </section>
  );
}
