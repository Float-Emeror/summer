import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync, spawnSync } from 'child_process';

type AnalysisResult = {
  name: string;
  sourceType: 'local' | 'git';
  sourcePath: string;
  projectType: string;
  summary: string;
  readmeSummary: string;
  fileCount: number;
  moduleCount: number;
  topLevelDirs: string[];
  keyFiles: string[];
  configFiles: string[];
  mainEntryPoints: string[];
  techStack: string[];
  onboardingSteps: string[];
};

type AiGenerationOutcome = {
  content: string;
  mode: 'llm' | 'local-fallback';
  fallbackReason: string | null;
  fallbackDetail: string | null;
};

type SecureCredentialRecord = {
  provider: string;
  keyHint: string;
  status: string;
  updatedAt: string;
  ciphertext: string;
  scheme: 'windows-dpapi' | 'master-key-file';
};

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private static readonly FALLBACK_REASON_MESSAGES: Record<string, string> = {
    no_api_key: '未配置可用的 API Key',
    upstream_non_200: '上游模型服务返回非 200 状态',
    empty_content: '上游模型返回空内容',
    request_error: '上游模型服务当前不可达，已使用本地回退结果',
  };

  async importProject(userId: string, sourcePath: string, projectName?: string) {
    const analysis = this.analyzeProject(sourcePath, projectName);
    const project = await this.prisma.aiProject.create({
      data: {
        ownerId: userId,
        name: analysis.name,
        sourceType: analysis.sourceType,
        sourcePath: analysis.sourcePath,
        projectType: analysis.projectType,
        summary: analysis.summary,
        readmeSummary: analysis.readmeSummary,
        fileCount: analysis.fileCount,
        moduleCount: analysis.moduleCount,
        topLevelDirs: analysis.topLevelDirs,
        keyFiles: analysis.keyFiles,
        configFiles: analysis.configFiles,
        mainEntryPoints: analysis.mainEntryPoints,
        techStack: analysis.techStack,
        onboardingSteps: analysis.onboardingSteps,
      },
    });

    return project;
  }

  async listProjects(userId: string) {
    return this.prisma.aiProject.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        sourceType: true,
        sourcePath: true,
        projectType: true,
        summary: true,
        fileCount: true,
        moduleCount: true,
        techStack: true,
        createdAt: true,
      },
    });
  }

  async getProject(userId: string, id: string) {
    const project = await this.prisma.aiProject.findFirst({
      where: { id, ownerId: userId },
    });
    if (!project) {
      throw new NotFoundException('项目不存在');
    }
    return project;
  }

  async generateKnowledge(userId: string, projectId: string, provider: string) {
    const project = await this.ensureProject(userId, projectId);
    const codeContext = this.collectCodeContext(project.sourcePath);
    const prompt = this.buildSummaryPrompt(project, codeContext);
    const fallback = this.localKnowledgeSummary(project, codeContext);
    const generated = await this.generateWithFallback(provider, prompt, fallback);

    const doc = await this.prisma.aiDocument.create({
      data: {
        projectId,
        title: `Knowledge Summary - ${project.name}`,
        docType: 'knowledge',
        content: generated.content,
      },
    });

    return {
      document: doc,
      provider,
      mode: generated.mode,
      fallbackReason: generated.fallbackReason,
      fallbackDetail: generated.fallbackDetail,
      fallbackMessage: generated.fallbackReason
        ? AiService.FALLBACK_REASON_MESSAGES[generated.fallbackReason] || '已触发本地回退'
        : null,
    };
  }

  async askQuestion(userId: string, projectId: string, question: string, provider: string) {
    const project = await this.ensureProject(userId, projectId);
    const docs = await this.prisma.aiDocument.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const codeContext = this.collectCodeContext(project.sourcePath, question);

    const ranked = this.rankDocuments(question, docs).slice(0, 3);
    const citations = ranked.map((doc) => ({
      documentId: doc.id,
      title: doc.title,
      snippet: this.buildSnippet(doc.content, question),
    }));

    const prompt = this.buildQaPrompt(question, citations, codeContext);
    const fallback = this.localQaAnswer(question, citations, project.name, codeContext);
    const generated = await this.generateWithFallback(provider, prompt, fallback);

    const conversation = await this.prisma.aiConversation.create({
      data: {
        projectId,
        question,
        answer: generated.content,
        citations,
      },
    });

    return {
      projectId,
      question,
      answer: generated.content,
      citations,
      conversationId: conversation.id,
      provider,
      mode: generated.mode,
      fallbackReason: generated.fallbackReason,
      fallbackDetail: generated.fallbackDetail,
      fallbackMessage: generated.fallbackReason
        ? AiService.FALLBACK_REASON_MESSAGES[generated.fallbackReason] || '已触发本地回退'
        : null,
    };
  }

  async listDocuments(userId: string, projectId: string) {
    await this.ensureProject(userId, projectId);
    return this.prisma.aiDocument.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } });
  }

  async listProjectFiles(userId: string, projectId: string) {
    const project = await this.ensureProject(userId, projectId);
    return this.withProjectRoot(project.sourcePath, (root) => {
      const ignoredDirs = new Set(['.git', 'node_modules', '.venv', 'venv', 'dist', 'build', '.next', '.idea', '.local']);
      const docExtensions = new Set(['.md', '.markdown', '.txt']);
      const files: Array<{ path: string; title: string; docType: string }> = [];
      const stack = [root];

      while (stack.length > 0 && files.length < 300) {
        const current = stack.pop();
        if (!current) break;

        let entries: fs.Dirent[] = [];
        try {
          entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
          continue;
        }

        for (const entry of entries) {
          const full = path.join(current, entry.name);
          if (entry.isDirectory()) {
            if (!ignoredDirs.has(entry.name)) {
              stack.push(full);
            }
            continue;
          }
          const ext = path.extname(entry.name).toLowerCase();
          const relativePath = path.relative(root, full).replace(/\\/g, '/');
          if (docExtensions.has(ext) || /^readme/i.test(entry.name)) {
            files.push({
              path: relativePath,
              title: entry.name,
              docType: ext === '.txt' ? 'text' : 'markdown',
            });
          }
        }
      }

      return files.sort((left, right) => left.path.localeCompare(right.path));
    });
  }

  async getProjectFileContent(userId: string, projectId: string, filePath: string) {
    const project = await this.ensureProject(userId, projectId);
    if (!filePath || !filePath.trim()) {
      throw new BadRequestException('文件路径不能为空');
    }

    return this.withProjectRoot(project.sourcePath, (root) => {
      const normalized = path.normalize(filePath).replace(/\\/g, '/');
      if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
        throw new BadRequestException('禁止读取项目外部文件');
      }

      const fullPath = path.join(root, normalized);
      if (!fullPath.startsWith(root)) {
        throw new BadRequestException('禁止读取项目外部文件');
      }
      if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
        throw new NotFoundException('文件不存在');
      }

      const content = fs.readFileSync(fullPath, 'utf8');
      return { path: normalized.replace(/\\/g, '/'), content };
    });
  }

  async listConversations(userId: string, projectId: string) {
    await this.ensureProject(userId, projectId);
    return this.prisma.aiConversation.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } });
  }

  async getConfigStatus(provider: string) {
    const normalized = provider.toLowerCase();
    const envKey = this.getProviderEnvKey(normalized);
    const envValue = this.config.get<string>(envKey)?.trim();
    const fromEnv = Boolean(envValue);
    const secureRecord = this.readSecureStoreRecord(normalized);

    const stored = await this.prisma.aiConfig.findUnique({ where: { provider: normalized } });
    const configured = fromEnv || Boolean(secureRecord) || Boolean(stored?.keyCiphertext);

    return {
      provider: normalized,
      configured,
      source: fromEnv ? 'env' : secureRecord ? 'secure_store' : stored ? 'db' : 'none',
      keyHint: secureRecord?.keyHint || stored?.keyHint || (fromEnv && envValue ? `****${envValue.slice(-4)}` : null),
      status: secureRecord?.status || stored?.status || (fromEnv ? 'configured' : 'not_configured'),
      updatedAt: secureRecord?.updatedAt || stored?.updatedAt?.toISOString() || null,
    };
  }

  async upsertConfig(provider: string, apiKey: string, status: string) {
    const normalized = provider.toLowerCase();
    const saved = this.writeSecureStoreRecord(normalized, apiKey, status);
    await this.prisma.aiConfig.deleteMany({ where: { provider: normalized } });

    return {
      provider: saved.provider,
      configured: true,
      keyHint: saved.keyHint,
      status: saved.status,
      updatedAt: saved.updatedAt,
    };
  }

  async clearConfig(provider: string) {
    const normalized = provider.toLowerCase();
    this.deleteSecureStoreRecord(normalized);
    await this.prisma.aiConfig.deleteMany({ where: { provider: normalized } });
    return { provider: normalized, configured: false, status: 'cleared' };
  }

  private analyzeProject(inputPath: string, projectName?: string): AnalysisResult {
    const isGit = /^https?:\/\/|^git@/i.test(inputPath);
    let root = inputPath;
    let tempRoot: string | null = null;

    if (isGit) {
      tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-map-'));
      try {
        execFileSync('git', ['clone', '--depth', '1', inputPath, tempRoot], { stdio: 'ignore' });
      } catch {
        throw new BadRequestException('Git 仓库克隆失败，请检查地址与网络。');
      }
      root = tempRoot;
    }

    const stat = fs.existsSync(root) ? fs.statSync(root) : null;
    if (!stat || !stat.isDirectory()) {
      throw new BadRequestException('项目路径不存在或不是目录');
    }

    try {
      const ignoredDirs = new Set(['.git', 'node_modules', '.venv', 'venv', 'dist', 'build', '.next', '.idea', '.cache', '.gradle']);
      const sourceExtensions = new Set([
        '.py', '.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.yml', '.yaml', '.toml', '.ini', '.java',
        '.c', '.cpp', '.cc', '.h', '.hpp', '.cs', '.go', '.rs', '.swift', '.kt', '.kts', '.php',
        '.sh', '.bash', '.zsh', '.ps1', '.bat', '.gradle', '.groovy', '.scala', '.m', '.sql', '.xml'
      ]);
      const knownConfigs = new Set([
        'package.json', 'pyproject.toml', 'requirements.txt', 'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
        'README.md', 'README', 'pom.xml', 'build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts',
        'Makefile', 'tsconfig.json', 'vite.config.ts', 'vite.config.js', 'webpack.config.js', '.env', '.env.example'
      ]);

      const topLevel = fs.readdirSync(root, { withFileTypes: true });
      const topLevelDirs = topLevel.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();

      const relevantFiles: string[] = [];
      const stack = [root];

      while (stack.length > 0) {
        const current = stack.pop();
        if (!current) break;
        let entries: fs.Dirent[] = [];
        try {
          entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
          continue;
        }

        for (const entry of entries) {
          const full = path.join(current, entry.name);
          if (entry.isDirectory()) {
            if (!ignoredDirs.has(entry.name)) {
              stack.push(full);
            }
            continue;
          }
          const ext = path.extname(entry.name).toLowerCase();
          if (knownConfigs.has(entry.name) || sourceExtensions.has(ext) || entry.name.toLowerCase() === 'dockerfile') {
            relevantFiles.push(path.relative(root, full).replace(/\\/g, '/'));
          }
        }
      }

      const readmeFile = relevantFiles.find((file) => file.toLowerCase().startsWith('readme')) || this.findReadme(root);
      const readmeSummary = readmeFile ? this.extractReadmeSummary(path.join(root, readmeFile)) : '';
      const packageInfo = this.readPackageJson(path.join(root, 'package.json'));
      const projectType = this.detectProjectType(relevantFiles, packageInfo);
      const techStack = this.detectTechStack(relevantFiles, packageInfo);
      const configFiles = relevantFiles.filter((file) => knownConfigs.has(path.basename(file)));
      const mainEntryPoints = this.detectEntrypoints(root, packageInfo, relevantFiles);
      const keyFiles = [
        ...(readmeFile ? [readmeFile] : []),
        ...configFiles,
        ...relevantFiles.filter((f) => f.startsWith('src/')).slice(0, 8),
      ].filter((value, index, arr) => arr.indexOf(value) === index).slice(0, 12);

      const onboardingSteps = this.buildOnboardingSteps(projectType, mainEntryPoints, configFiles);
      const summary = `该项目被识别为 ${projectType} 类型，包含约 ${relevantFiles.length} 个关键文件、${topLevelDirs.length} 个顶层目录。技术栈：${techStack.join('、') || '待识别'}。`;

      return {
        name: projectName?.trim() || path.basename(root),
        sourceType: isGit ? 'git' : 'local',
        sourcePath: inputPath,
        projectType,
        summary,
        readmeSummary,
        fileCount: relevantFiles.length,
        moduleCount: topLevelDirs.length,
        topLevelDirs,
        keyFiles,
        configFiles,
        mainEntryPoints,
        techStack,
        onboardingSteps,
      };
    } finally {
      if (tempRoot) {
        try {
          fs.rmSync(tempRoot, { recursive: true, force: true });
        } catch {
          // ignore cleanup errors
        }
      }
    }
  }

  private findReadme(root: string) {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const lower = entry.name.toLowerCase();
      if (lower === 'readme.md' || lower === 'readme') {
        return entry.name;
      }
    }
    return '';
  }

  private extractReadmeSummary(readmePath: string) {
    try {
      const content = fs.readFileSync(readmePath, 'utf-8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      if (content.length === 0) return '';
      return content.slice(0, 3).join(' ').slice(0, 280);
    } catch {
      return '';
    }
  }

  private readPackageJson(packagePath: string) {
    if (!fs.existsSync(packagePath)) return {} as Record<string, unknown>;
    try {
      return JSON.parse(fs.readFileSync(packagePath, 'utf-8')) as Record<string, unknown>;
    } catch {
      return {} as Record<string, unknown>;
    }
  }

  private detectProjectType(files: string[], packageInfo: Record<string, unknown>) {
    const suffixes = new Set(files.map((file) => path.extname(file).toLowerCase()));
    const deps = this.collectDeps(packageInfo);
    const hasFrontend = ['react', 'vue', 'next', 'svelte', '@angular/core'].some((name) => deps.includes(name));
    const hasBackend = suffixes.has('.py') || suffixes.has('.java') || deps.includes('express') || deps.includes('@nestjs/core') || deps.includes('fastapi');

    if (hasFrontend && hasBackend) return 'fullstack';
    if (hasFrontend) return 'frontend';
    if (hasBackend) return 'backend';
    return 'tooling';
  }

  private detectTechStack(files: string[], packageInfo: Record<string, unknown>) {
    const stack = new Set<string>();
    const suffixes = new Set(files.map((file) => path.extname(file).toLowerCase()));
    const deps = this.collectDeps(packageInfo);

    if (suffixes.has('.py')) stack.add('Python');
    if (suffixes.has('.ts') || suffixes.has('.tsx')) stack.add('TypeScript');
    if (suffixes.has('.js') || suffixes.has('.jsx')) stack.add('JavaScript');
    if (deps.includes('react')) stack.add('React');
    if (deps.includes('@nestjs/core')) stack.add('NestJS');
    if (deps.includes('fastapi')) stack.add('FastAPI');
    if (files.some((file) => file.toLowerCase().includes('docker-compose') || file.toLowerCase() === 'dockerfile')) stack.add('Docker');
    if (files.some((file) => file.includes('prisma'))) stack.add('Prisma');

    return Array.from(stack);
  }

  private detectEntrypoints(root: string, packageInfo: Record<string, unknown>, files: string[]) {
    const entries: string[] = [];
    const scripts = packageInfo.scripts;
    if (scripts && typeof scripts === 'object') {
      const object = scripts as Record<string, string>;
      for (const key of ['dev', 'start', 'build', 'test']) {
        if (object[key]) entries.push(`npm run ${key}`);
      }
    }

    const candidates = ['src/main.ts', 'src/main.js', 'main.py', 'app.py', 'server.py', 'index.js'];
    for (const candidate of candidates) {
      if (fs.existsSync(path.join(root, candidate)) || files.includes(candidate)) {
        entries.push(candidate);
      }
    }

    return Array.from(new Set(entries)).slice(0, 8);
  }

  private buildOnboardingSteps(projectType: string, entries: string[], configs: string[]) {
    const steps = ['先阅读 README，确认项目目标与运行方式。'];
    if (projectType === 'fullstack') {
      steps.push('准备数据库与后端配置，先启动 API，再启动前端。');
    } else if (projectType === 'frontend') {
      steps.push('安装前端依赖并运行开发服务器，检查页面路由。');
    } else if (projectType === 'backend') {
      steps.push('安装后端依赖并执行迁移，验证核心接口。');
    }
    if (entries.length > 0) {
      steps.push(`建议入口：${entries.join('；')}`);
    }
    if (configs.length > 0) {
      steps.push(`重点配置文件：${configs.slice(0, 4).join('、')}`);
    }
    return steps;
  }

  private collectDeps(packageInfo: Record<string, unknown>) {
    const deps: string[] = [];
    for (const key of ['dependencies', 'devDependencies', 'peerDependencies']) {
      const section = packageInfo[key];
      if (section && typeof section === 'object') {
        deps.push(...Object.keys(section as Record<string, string>).map((name) => name.toLowerCase()));
      }
    }
    return deps;
  }

  private async ensureProject(userId: string, projectId: string) {
    const project = await this.prisma.aiProject.findFirst({ where: { id: projectId, ownerId: userId } });
    if (!project) {
      throw new NotFoundException('项目不存在或无权限访问');
    }
    return project;
  }

  private buildSummaryPrompt(project: {
    name: string;
    summary: string;
    readmeSummary: string | null;
    keyFiles: unknown;
    techStack: unknown;
    mainEntryPoints: unknown;
    onboardingSteps: unknown;
  }, codeContext: string[]) {
    return [
      '你是一个代码仓库知识地图助手，请仅基于提供的结构化信息生成中文 Markdown。',
      `项目名：${project.name}`,
      `项目摘要：${project.summary}`,
      `源码扫描摘要：${codeContext.length > 0 ? `\n${codeContext.join('\n')}` : '无'}`,
      `README 摘要：${project.readmeSummary || '无'}`,
      `技术栈：${this.listToLine(project.techStack)}`,
      `关键文件：${this.listToLine(project.keyFiles)}`,
      `入口信息：${this.listToLine(project.mainEntryPoints)}`,
      `上手步骤：${this.listToLine(project.onboardingSteps)}`,
      '请输出：1) 项目概览 2) 模块职责 3) 新人上手命令 4) 风险与约束。不要编造未给出的事实。',
    ].join('\n');
  }

  private buildQaPrompt(question: string, citations: Array<{ documentId: string; title: string; snippet: string }>, codeContext: string[]) {
    const startupQuestion = this.isStartupQuestion(question);
    const context = citations.length > 0
      ? citations
          .map((item, index) => `[${index + 1}] ${item.title}\n${item.snippet}\n(document_id=${item.documentId})`)
          .join('\n\n')
      : '无上下文';

    const startupSignals = startupQuestion
      ? codeContext.filter((line) => /启动信号|启动脚本|后端脚本|前端脚本|start-dev|package\.json|docker-compose|Dockerfile|npm run|pnpm|nest start|vite|node dist/i.test(line)).slice(0, 8)
      : [];

    return [
      '你是项目问答助手，只能根据给定上下文作答。不要凭空编造内容。',
      `问题：${question}`,
      startupQuestion
        ? '这是启动/运行类问题。你必须优先回答“可执行命令 → 入口文件 → 必要环境变量/端口”。如果上下文里存在启动脚本或入口文件，不要先讲项目概览，也不要先引用 README。'
        : '优先使用源码扫描摘要和上下文，README 只作为补充。',
      startupSignals.length > 0 ? `启动信号：\n${startupSignals.join('\n')}` : '启动信号：无',
      '源码证据优先级最高。源码证据中的命令、脚本和代码行为高于知识文档中的概括；如果源码证据没有相关信息，再使用资料上下文。',
      '源码证据：',
      codeContext.length > 0 ? codeContext.join('\n') : '无代码摘要',
      '资料上下文：',
      context,
      startupQuestion
        ? '要求：先给 1 条最可能可执行的启动命令，再给对应入口文件或脚本路径，最后才补充解释。若存在多个启动方式，优先给开发环境启动方式。'
        : '要求：回答简洁；如果上下文不足，明确指出缺失信息。',
      '请仅使用以上上下文回答。如果答案来自资料内容，回答末尾必须按 [编号] 标注来源；不要给出未在上下文中出现的编号。',
      '如果上下文不足以确定答案，直接说明“上下文不足，无法确定答案”。',
    ].join('\n\n');
  }

  private localKnowledgeSummary(project: {
    name: string;
    summary: string;
    techStack: unknown;
    mainEntryPoints: unknown;
    keyFiles: unknown;
    onboardingSteps: unknown;
  }, codeContext: string[]) {
    return [
      `# ${project.name} 知识地图`,
      '',
      '## 项目概览',
      project.summary,
      '',
      '## 源码扫描摘要',
      this.listToBullets(codeContext),
      '',
      '## 技术栈',
      this.listToBullets(project.techStack),
      '',
      '## 关键入口',
      this.listToBullets(project.mainEntryPoints),
      '',
      '## 关键文件',
      this.listToBullets(project.keyFiles),
      '',
      '## 新人上手建议',
      this.listToBullets(project.onboardingSteps),
    ].join('\n');
  }

  private localQaAnswer(question: string, citations: Array<{ title: string; snippet: string }>, projectName: string, codeContext: string[]) {
    if (citations.length === 0 && codeContext.length === 0) {
      return `在 ${projectName} 中暂未找到可用于回答“${question}”的知识文档或代码摘要，请先生成知识摘要文档。`;
    }

    const lines = [`基于当前知识文档，关于“${question}”可参考：`];
    if (this.isStartupQuestion(question) && codeContext.length > 0) {
      const startupLines = codeContext.filter((line) => /启动信号|启动脚本|后端脚本|前端脚本|start-dev|package\.json|docker-compose|Dockerfile|npm run|pnpm|nest start|vite|node dist/i.test(line));
      lines.push('可执行启动信息：');
      lines.push(...(startupLines.length > 0 ? startupLines.slice(0, 5) : codeContext.slice(0, 5)));
    }
    for (let i = 0; i < citations.length; i += 1) {
      lines.push(`[${i + 1}] ${citations[i].title}：${citations[i].snippet || '（无可用片段）'}`);
    }
    if (!this.isStartupQuestion(question) && codeContext.length > 0) {
      lines.push('代码扫描摘要：');
      lines.push(...codeContext.slice(0, 6));
    }
    lines.push('如果答案来自引用资料，请在文本中使用 [编号] 标注来源。');
    return lines.join('\n');
  }

  private collectCodeContext(inputPath: string, question?: string) {
    return this.withProjectRoot(inputPath, (root) => {
      const startupContext = question && this.isStartupQuestion(question) ? this.extractStartupContext(root) : [];
      const files = this.findRelevantCodeFiles(root, question);
      const summaries: string[] = [];
      for (const relativeFile of files) {
        const summary = this.summarizeCodeFile(path.join(root, relativeFile), relativeFile);
        if (summary) {
          summaries.push(summary);
        }
      }
      const prefixedStartup = startupContext.map((line) => `启动信号: ${line}`);
      const sourceEvidence = question ? this.extractSourceEvidence(root, files, question) : [];
      return [...prefixedStartup, ...sourceEvidence, ...summaries].slice(0, 20);
    });
  }

  private extractSourceEvidence(root: string, files: string[], question: string) {
    const startupQuestion = this.isStartupQuestion(question);
    const priorityFiles = startupQuestion
      ? [
          'package.json',
          'apps/package.json',
          'backend/package.json',
          'frontend/package.json',
          'scripts/start-dev.ps1',
          'apps/scripts/start-dev.ps1',
          'docker-compose.yml',
          'apps/docker-compose.yml',
          'Dockerfile',
        ]
      : files;
    const orderedFiles = Array.from(new Set([...priorityFiles, ...files])).filter((relativePath) =>
      fs.existsSync(path.join(root, relativePath)),
    );
    const tokens = this.extractTokens(question);
    const evidence: string[] = [];

    for (const relativePath of orderedFiles.slice(0, startupQuestion ? 9 : 10)) {
      let lines: string[];
      try {
        lines = fs.readFileSync(path.join(root, relativePath), 'utf8').split(/\r?\n/);
      } catch {
        continue;
      }

      const selected = lines
        .map((line, index) => ({ line: line.trim(), index: index + 1 }))
        .filter(({ line }) => line.length > 0)
        .filter(({ line }) => {
          if (startupQuestion) {
            return /scripts|pnpm|npm|yarn|docker|compose|nest|vite|node|mysql|prisma|port|start|dev|build|listen|app\.listen/i.test(line);
          }
          const normalized = line.toLowerCase();
          return tokens.some((token) => normalized.includes(token));
        })
        .slice(0, startupQuestion ? 12 : 8);

      if (selected.length > 0) {
        evidence.push(`源码 ${relativePath}: ${selected.map(({ line, index }) => `[L${index}] ${line.slice(0, 220)}`).join(' | ')}`);
      }
      if (evidence.length >= 12) break;
    }

    return evidence;
  }

  private isStartupQuestion(question: string) {
    return /启动|怎么起|如何起|如何运行|如何启动|运行|启动项目|run|start|launch|dev|docker compose|docker-compose|docker/.test(question.toLowerCase());
  }

  private extractStartupContext(root: string) {
    const snippets: string[] = [];

    const readJsonScripts = (relativePath: string, label: string) => {
      const fullPath = path.join(root, relativePath);
      if (!fs.existsSync(fullPath)) return;
      try {
        const packageInfo = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as { scripts?: Record<string, string> };
        const scripts = packageInfo.scripts && typeof packageInfo.scripts === 'object' ? packageInfo.scripts : {};
        const entries = Object.entries(scripts).slice(0, 6).map(([name, command]) => `${name}: ${command}`);
        if (entries.length > 0) {
          snippets.push(`- ${label} ${relativePath}: ${entries.join(' | ')}`);
        }
      } catch {
        // ignore malformed package files during context extraction
      }
    };

    readJsonScripts('package.json', '启动脚本');
    readJsonScripts(path.join('backend', 'package.json'), '后端脚本');
    readJsonScripts(path.join('frontend', 'package.json'), '前端脚本');

    const rootPackagePath = path.join(root, 'package.json');
    if (fs.existsSync(rootPackagePath)) {
      try {
        const packageInfo = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8')) as { scripts?: Record<string, string> };
        const scripts = packageInfo.scripts && typeof packageInfo.scripts === 'object' ? packageInfo.scripts : {};
        const ordered = ['start:dev', 'dev', 'start', 'build'];
        const preferred = ordered
          .filter((name) => scripts[name])
          .map((name) => `${name}: ${scripts[name]}`);
        if (preferred.length > 0) {
          snippets.unshift(`- 启动脚本 package.json: ${preferred.join(' | ')}`);
        }
      } catch {
        // ignore malformed root package during context extraction
      }
    }

    for (const relativePath of ['scripts/start-dev.ps1', 'docker-compose.yml', 'docker-compose.yaml', 'Dockerfile', path.join('backend', 'Dockerfile'), path.join('frontend', 'Dockerfile')]) {
      const fullPath = path.join(root, relativePath);
      if (!fs.existsSync(fullPath)) continue;
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const compact = content
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
          .filter((line) => !line.startsWith('#') && !line.startsWith('//') && !line.startsWith(';'))
          .filter((line) => /pnpm|npm|yarn|docker|compose|nest|vite|node dist|start|dev|build|mysql|prisma|port|docker-compose/i.test(line))
          .slice(0, 6)
          .join(' | ');
        if (compact) {
          snippets.push(`- ${relativePath}: ${compact.slice(0, 240)}`);
        }
      } catch {
        // ignore unreadable startup files
      }
    }

    return Array.from(new Set(snippets)).slice(0, 6);
  }

  private withProjectRoot<T>(inputPath: string, work: (root: string) => T): T {
    const isGit = /^https?:\/\/|^git@/i.test(inputPath);
    let root = inputPath;
    let tempRoot: string | null = null;

    if (isGit) {
      tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-map-'));
      try {
        execFileSync('git', ['clone', '--depth', '1', inputPath, tempRoot], { stdio: 'ignore' });
      } catch {
        throw new BadRequestException('Git 仓库克隆失败，请检查地址与网络。');
      }
      root = tempRoot;
    }

    try {
      return work(root);
    } finally {
      if (tempRoot) {
        try {
          fs.rmSync(tempRoot, { recursive: true, force: true });
        } catch {
          // ignore cleanup errors
        }
      }
    }
  }

  private findRelevantCodeFiles(root: string, question?: string) {
    const ignoredDirs = new Set(['.git', 'node_modules', '.venv', 'venv', 'dist', 'build', '.next', '.idea', '.local', '.cache', '.gradle']);
    const allowedExtensions = new Set([
      '.py', '.js', '.jsx', '.ts', '.tsx', '.java', '.c', '.cpp', '.cc', '.h', '.hpp', '.cs', '.go', '.rs',
      '.swift', '.kt', '.kts', '.php', '.sh', '.bash', '.zsh', '.ps1', '.bat', '.gradle', '.groovy', '.scala', '.m', '.sql',
      '.json', '.yml', '.yaml', '.toml', '.ini', '.xml'
    ]);
    const focusTokens = question ? this.extractTokens(question) : [];
    const candidates: Array<{ relativePath: string; score: number }> = [];
    const stack = [root];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) break;

      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          if (!ignoredDirs.has(entry.name)) {
            stack.push(full);
          }
          continue;
        }

        const ext = path.extname(entry.name).toLowerCase();
        if (!allowedExtensions.has(ext)) {
          continue;
        }

        const relativePath = path.relative(root, full).replace(/\\/g, '/');
        let score = 0;
        if (/^src\//i.test(relativePath)) score += 8;
        if (/(^|\/)(backend|frontend|server|client|app|lib|src|pages|components|controllers|services|routes|api|scripts|config|database|migrations|infra|ops)\//i.test(relativePath)) score += 5;
        if (/(main|app|server|index|router|route|controller|service|page|component|api|cli|script|config|schema|model|database|setup|bootstrap|entry|handler|middleware)/i.test(relativePath)) score += 6;
        if (/\b(package\.json|pom\.xml|build\.gradle|build\.gradle\.kts|vite\.config\.ts|vite\.config\.js|webpack\.config\.js|tsconfig\.json|docker-compose\.yml|docker-compose\.yaml|dockerfile|README(?:\.md)?|\.env|\.env\.example)\b/i.test(relativePath)) score += 10;
        if (/docker|compose|env|config|routes|router|schema|migration/.test(relativePath.toLowerCase())) score += 4;

        const lowerPath = relativePath.toLowerCase();
        const fileName = path.basename(relativePath).toLowerCase();
        for (const token of focusTokens) {
          if (lowerPath.includes(token)) score += 8;
          if (fileName.includes(token)) score += 6;
        }

        if (score === 0) score = 1;
        candidates.push({ relativePath, score });
      }
    }

    return candidates
      .sort((left, right) => right.score - left.score || left.relativePath.localeCompare(right.relativePath))
      .slice(0, 24)
      .map((item) => item.relativePath);
  }

  private summarizeCodeFile(filePath: string, relativePath: string) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const highlights = this.extractCodeHighlights(content, relativePath);
      if (highlights.length === 0) {
        return '';
      }

      return `- ${relativePath}: ${highlights.join(' | ')}`;
    } catch {
      return '';
    }
  }

  private extractCodeHighlights(content: string, relativePath: string) {
    const highlights = new Set<string>();
    const lowerPath = relativePath.toLowerCase();
    const ext = path.extname(relativePath).toLowerCase();

    const addMatch = (regex: RegExp, formatter: (match: RegExpExecArray) => string) => {
      let match: RegExpExecArray | null = null;
      while ((match = regex.exec(content)) !== null && highlights.size < 8) {
        const value = formatter(match).trim();
        if (value) highlights.add(value);
      }
    };

    if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
      addMatch(/export\s+(?:default\s+)?function\s+([A-Za-z0-9_]+)/g, (match) => `function ${match[1]}`);
      addMatch(/(?:export\s+)?class\s+([A-Za-z0-9_]+)/g, (match) => `class ${match[1]}`);
      addMatch(/(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\(/g, (match) => `fn ${match[1]}`);
      addMatch(/@(?:Controller|Get|Post|Put|Patch|Delete|UseGuards|ApiOperation)\(([^)]{0,80})\)/g, (match) => `${match[0].replace(/\s+/g, ' ')}`);
      addMatch(/(?:router|app)\.(?:get|post|put|patch|delete)\(([^)]{0,80})\)/gi, (match) => `${match[0].replace(/\s+/g, ' ')}`);
      if (lowerPath.includes('page') || lowerPath.includes('component')) {
        addMatch(/const\s+([A-Z][A-Za-z0-9_]+)\s*=\s*\(/g, (match) => `component ${match[1]}`);
      }
    } else if (ext === '.py') {
      addMatch(/^class\s+([A-Za-z0-9_]+)/gm, (match) => `class ${match[1]}`);
      addMatch(/^def\s+([A-Za-z0-9_]+)/gm, (match) => `def ${match[1]}`);
      addMatch(/^@(?:app|router)\.(?:get|post|put|patch|delete)\(([^)]{0,80})\)/gm, (match) => `${match[0].replace(/\s+/g, ' ')}`);
      addMatch(/^@app\.route\(([^)]{0,80})\)/gm, (match) => `${match[0].replace(/\s+/g, ' ')}`);
    } else if (ext === '.java') {
      addMatch(/class\s+([A-Za-z0-9_]+)/g, (match) => `class ${match[1]}`);
      addMatch(/(?:public|private|protected)?\s*(?:static\s+)?[A-Za-z0-9_<>,\[\]\s?]+\s+([A-Za-z0-9_]+)\s*\(/g, (match) => `method ${match[1]}`);
      addMatch(/@(?:GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping|RequestMapping)\(([^)]{0,80})\)/g, (match) => `${match[0].replace(/\s+/g, ' ')}`);
    }

    if (highlights.size === 0) {
      const lines = content.split(/\r?\n/);
      const interestingLines = lines
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .filter((line) => /class |function |def |interface |type |const |let |var |async |@Controller|@Get|@Post|@Put|@Delete|FastAPI|Router|Blueprint/i.test(line))
        .slice(0, 4)
        .map((line) => line.replace(/\s+/g, ' ').slice(0, 140));

      for (const line of interestingLines) {
        highlights.add(line);
      }
    }

    return Array.from(highlights).slice(0, 8);
  }

  private rankDocuments(question: string, docs: Array<{ id: string; title: string; content: string }>) {
    const tokens = this.extractTokens(question);
    return docs
      .map((doc) => {
        const title = (doc.title || '').toLowerCase();
        const content = (doc.content || '').toLowerCase();
        let score = 0;
        if (title.includes(question.toLowerCase())) score += 20;
        if (content.includes(question.toLowerCase())) score += 12;
        for (const token of tokens) {
          if (title.includes(token)) score += 6;
          if (content.includes(token)) score += 3;
        }
        if (title.startsWith('readme') || title.startsWith('knowledge')) score += 2;
        return { ...doc, score };
      })
      .sort((a, b) => b.score - a.score);
  }

  private buildSnippet(content: string, question: string) {
    const normalized = (content || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return '';

    const lowerContent = normalized.toLowerCase();
    const lowerQuestion = question.toLowerCase();
    const index = lowerContent.indexOf(lowerQuestion);
    if (index >= 0) {
      const start = Math.max(0, index - 80);
      const end = Math.min(normalized.length, index + lowerQuestion.length + 140);
      return `${normalized.slice(start, end).trim()} ...`;
    }

    const tokens = this.extractTokens(question);
    for (const token of tokens) {
      const tokenIndex = lowerContent.indexOf(token);
      if (tokenIndex >= 0) {
        const start = Math.max(0, tokenIndex - 60);
        const end = Math.min(normalized.length, tokenIndex + token.length + 140);
        return `${normalized.slice(start, end).trim()} ...`;
      }
    }

    const sentenceMatch = normalized.match(/[^。.!?]{60,220}[。.!?]/u);
    if (sentenceMatch) {
      return `${sentenceMatch[0].trim()} ...`;
    }

    return `${normalized.slice(0, 220).trim()} ...`;
  }

  private extractTokens(value: string) {
    return Array.from(new Set(value.toLowerCase().match(/[\p{L}\p{N}_-]+/gu) || [])).filter((token) => token.length >= 2);
  }

  private listToLine(value: unknown) {
    if (!Array.isArray(value) || value.length === 0) return '无';
    return value.map((item) => String(item)).join('、');
  }

  private listToBullets(value: unknown) {
    if (!Array.isArray(value) || value.length === 0) return '- 无';
    return value.map((item) => `- ${String(item)}`).join('\n');
  }

  private getProviderEnvKey(provider: string) {
    const normalized = provider.replace(/[^a-z0-9]/gi, '_').toUpperCase();
    return `${normalized}_API_KEY`;
  }

  private getSecureStoreRoot() {
    return path.resolve(__dirname, '..', '..', '.local', 'ai-credentials');
  }

  private getSecureStoreFile(provider: string) {
    return path.join(this.getSecureStoreRoot(), `${provider}.json`);
  }

  private readSecureStoreRecord(provider: string): SecureCredentialRecord | null {
    const file = this.getSecureStoreFile(provider);
    if (!fs.existsSync(file)) {
      return null;
    }

    try {
      const raw = fs.readFileSync(file, 'utf8');
      const parsed = JSON.parse(raw) as Partial<SecureCredentialRecord>;
      if (!parsed.ciphertext || !parsed.keyHint || !parsed.provider || !parsed.scheme || !parsed.updatedAt) {
        return null;
      }

      return {
        provider: parsed.provider,
        keyHint: parsed.keyHint,
        status: parsed.status || 'configured',
        updatedAt: parsed.updatedAt,
        ciphertext: parsed.ciphertext,
        scheme: parsed.scheme,
      };
    } catch {
      return null;
    }
  }

  private writeSecureStoreRecord(provider: string, plainText: string, status: string): SecureCredentialRecord {
    const keyHint = plainText.length >= 4 ? `****${plainText.slice(-4)}` : '****';
    const record: SecureCredentialRecord = {
      provider,
      keyHint,
      status,
      updatedAt: new Date().toISOString(),
      ciphertext: this.protectSecretForLocalStore(plainText),
      scheme: process.platform === 'win32' ? 'windows-dpapi' : 'master-key-file',
    };

    fs.mkdirSync(this.getSecureStoreRoot(), { recursive: true });
    fs.writeFileSync(this.getSecureStoreFile(provider), JSON.stringify(record, null, 2), 'utf8');
    return record;
  }

  private deleteSecureStoreRecord(provider: string) {
    const file = this.getSecureStoreFile(provider);
    if (!fs.existsSync(file)) {
      return;
    }

    try {
      fs.rmSync(file, { force: true });
    } catch {
      // ignore cleanup errors
    }
  }

  private getEncryptionSecret() {
    return this.config.get<string>('AI_CONFIG_MASTER_KEY') || this.config.get<string>('JWT_SECRET') || '';
  }

  private protectSecretForLocalStore(plainText: string) {
    if (process.platform === 'win32') {
      return this.protectForWindowsCurrentUser(plainText);
    }

    return this.encryptSecret(plainText);
  }

  private unprotectSecretFromLocalStore(cipherText: string) {
    if (process.platform === 'win32') {
      return this.unprotectForWindowsCurrentUser(cipherText);
    }

    return this.decryptSecret(cipherText);
  }

  private protectForWindowsCurrentUser(plainText: string) {
    const script = [
      '$inputData = [Console]::In.ReadToEnd()',
      '$secure = ConvertTo-SecureString -String $inputData -AsPlainText -Force',
      'ConvertFrom-SecureString -SecureString $secure',
    ].join('; ');

    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      input: plainText,
      encoding: 'utf8',
    });

    if (result.status !== 0 || result.error || !result.stdout.trim()) {
      throw new BadRequestException('Windows 凭据保护写入失败');
    }

    return result.stdout.trim();
  }

  private unprotectForWindowsCurrentUser(cipherText: string) {
    const script = [
      '$inputData = [Console]::In.ReadToEnd()',
      '$secure = ConvertTo-SecureString -String $inputData',
      '$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)',
      'try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }',
    ].join('; ');

    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      input: cipherText,
      encoding: 'utf8',
    });

    if (result.status !== 0 || result.error) {
      return '';
    }

    return result.stdout;
  }

  private encryptSecret(plainText: string) {
    const secret = this.getEncryptionSecret();
    if (!secret) {
      throw new BadRequestException('缺少 AI_CONFIG_MASTER_KEY 或 JWT_SECRET，无法加密保存密钥');
    }

    const key = crypto.createHash('sha256').update(secret).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
  }

  private decryptSecret(cipherText: string) {
    const secret = this.getEncryptionSecret();
    if (!secret) return '';

    const [ivText, tagText, dataText] = cipherText.split('.');
    if (!ivText || !tagText || !dataText) return '';

    try {
      const key = crypto.createHash('sha256').update(secret).digest();
      const iv = Buffer.from(ivText, 'base64');
      const tag = Buffer.from(tagText, 'base64');
      const data = Buffer.from(dataText, 'base64');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const plain = Buffer.concat([decipher.update(data), decipher.final()]);
      return plain.toString('utf8');
    } catch {
      return '';
    }
  }

  private async resolveProviderKey(provider: string) {
    const envKey = this.getProviderEnvKey(provider);
    const envValue = this.config.get<string>(envKey)?.trim();
    if (envValue) {
      return envValue;
    }

    const secureRecord = this.readSecureStoreRecord(provider);
    if (secureRecord?.ciphertext) {
      const unprotected = this.unprotectSecretFromLocalStore(secureRecord.ciphertext).trim();
      if (unprotected) {
        return unprotected;
      }
    }

    const stored = await this.prisma.aiConfig.findUnique({ where: { provider } });
    if (!stored?.keyCiphertext) {
      return '';
    }

    return this.decryptSecret(stored.keyCiphertext);
  }

  private async generateWithFallback(provider: string, prompt: string, fallback: string): Promise<AiGenerationOutcome> {
    const normalized = (provider || '').trim().toLowerCase() || 'unknown';
    const apiKey = await this.resolveProviderKey(normalized);
    if (!apiKey) {
      return {
        content: fallback,
        mode: 'local-fallback',
        fallbackReason: 'no_api_key',
        fallbackDetail: `provider=${normalized}; endpoint=not_called; reason=no_api_key`,
      };
    }

    const model = this.config.get<string>('AI_MODEL') || 'gpt-4o-mini';
    const endpoint = this.config.get<string>('AI_GATEWAY_URL') || 'https://api.openai.com/v1/chat/completions';
    const configuredTimeoutMs = Number(this.config.get<string>('AI_REQUEST_TIMEOUT_MS') || 60000);
    const timeoutMs = Number.isFinite(configuredTimeoutMs) && configuredTimeoutMs > 0 ? configuredTimeoutMs : 60000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 3000,
          messages: [
            { role: 'system', content: '你是可靠的软件工程知识助手。' },
            { role: 'user', content: prompt },
          ],
        }),
      });

      if (!response.ok) {
        return {
          content: fallback,
          mode: 'local-fallback',
          fallbackReason: 'upstream_non_200',
          fallbackDetail: `provider=${normalized}; endpoint=${endpoint}; model=${model}; status=${response.status}`,
        };
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const text = payload.choices?.[0]?.message?.content?.trim();
      if (!text) {
        return {
          content: fallback,
          mode: 'local-fallback',
          fallbackReason: 'empty_content',
          fallbackDetail: `provider=${normalized}; endpoint=${endpoint}; model=${model}; reason=empty_content`,
        };
      }

      return {
        content: text,
        mode: 'llm',
        fallbackReason: null,
        fallbackDetail: null,
      };
    } catch (error) {
      return {
        content: fallback,
        mode: 'local-fallback',
        fallbackReason: 'request_error',
        fallbackDetail: `provider=${normalized}; endpoint=${endpoint}; model=${model}; reason=${
          error instanceof DOMException && error.name === 'AbortError' ? 'timeout' : 'upstream_unreachable'
        }`,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
