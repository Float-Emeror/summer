# SEC-II-2026 校园组队与协作平台

## 项目简介

本项目是一个面向校园场景的“组队 + 协作 + 审核 + AI 知识支持”平台，适用于学生项目招募、队伍管理、任务协作、通知提醒和后台审核。它解决的是校园中“人找人、队伍管理、任务推进、信息不集中”的现实问题。

核心功能包括：
- 用户注册、登录与邮箱验证
- 个人资料和技能标签管理
- 队伍创建、加入申请与审批
- 队伍大厅与匹配推荐
- 任务创建、状态流转与成员协作
- 通知推送与 WebSocket 实时更新
- 管理员审核、信用体系与申诉处理
- AI 项目知识地图生成与问答（无 key 时自动 fallback）

## 安装与运行

### 1) 环境要求

- Node.js 20+
- pnpm 9+
- Docker Desktop / Docker Engine
- MySQL 8（由 Docker Compose 提供）

### 2) 从零启动


...（开启docker后）快速启动：
cd apps
corepack pnpm install
docker compose up -d mysql
corepack pnpm dev


在仓库根目录执行：

```bash
cd apps
corepack enable
corepack pnpm install
cp .env.example .env
cp backend/.env.example backend/.env
```

启动本地数据库：

```bash
docker compose up -d mysql
```

同步 Prisma schema 并初始化测试账号：

```bash
corepack pnpm prisma:push
corepack pnpm seed:test-user
```

启动前后端：

```bash
corepack pnpm dev
```

默认访问地址：
- 前端：http://localhost:5173
- 后端 API：http://localhost:3000
- MySQL：localhost:3307
- WebSocket：ws://localhost:3000

### 3) 单独启动服务

```bash
cd apps
corepack pnpm --filter @campus-team/api dev
corepack pnpm --filter @campus-team/web dev
```

### 4) 测试命令

```bash
cd apps
corepack pnpm test
corepack pnpm build
corepack pnpm lint
```

## 分发方式

本项目采用 Docker 分发方案，适合在新机器或演示环境中从零运行。

### Docker 构建

```bash
docker build -t campus-team-platform .
```

### Docker 运行

```bash
docker run -p 3000:3000 -p 5173:5173 --env-file apps/.env campus-team-platform
```

> 说明：对于本地开发和演示环境，优先使用 `docker compose`；对于交付分发，优先使用 Dockerfile 进行镜像构造。

## Key 安全配置

### 安全原则

- API Key、JWT secret、SMTP 密码、AI 密钥绝不写入源码或提交到 Git。
- 运行前通过 `.env` 文件加载。
- `.env` 是明文配置，存在泄露风险；因此仅用于本地开发或受控部署环境。
- 在生产环境里，请优先使用系统凭据管理器或密钥服务，而不是直接放在环境变量中。

### 示例配置

```env
JWT_SECRET="replace-with-a-local-development-secret"
OPENAI_API_KEY="在智能软件教学科研 GAI Token Hub 创建的 API Key"
AI_GATEWAY_URL="https://njusehub.info/v1/chat/completions"
AI_MODEL="kimi-k2.7-code"
AI_CONFIG_MASTER_KEY="replace-with-a-long-random-secret"
MAIL_PASS="your-smtp-password"
```

### 必须遵守

- 不要在终端命令行中直接执行 `export OPENAI_API_KEY=...`
- 不要将真实 key 提交到 Git 历史中
- 日志中不输出明文密钥，API 返回前也需进行脱敏
- AI 默认使用智能软件教学科研 GAI Token Hub；请先在 https://njusehub.info/keys 创建 API Key

## 已知限制

- 需要 Docker 与 Node 20+ 环境支持
- MySQL 依赖和 Prisma schema 必须同步后才能启动
- AI 模块在未配置 API Key 时会进入 local fallback，不会直接崩溃
- 邮件验证需要真实 SMTP 账号，默认开发模式可关闭验证
- 该项目主要面向校园场景，面向大规模企业级部署的能力仍有限

## 目录结构

```text
.
├── README.md
├── SPEC.md
├── PLAN.md
├── SPEC_PROCESS.md
├── AGENT_LOG.md
├── REFLECTION.md
├── .gitlab-ci.yml
├── Dockerfile
├── .dockerignore
├── apps/
│   ├── .env.example
│   ├── docker-compose.yml
│   ├── package.json
│   ├── frontend/
│   ├── backend/
│   ├── ui-config/
│   └── scripts/
├── 架构企划书.md
├── 项目企划书.md
├── 通用要求.md
├── AI4SE_Final_Project_B_应用类项目.md
└── LICENSE
```

## 安全边界说明

本项目的安全边界包括：
- 所有敏感配置通过 `.env` 或托管环境注入
- JWT 仅用于鉴权，密码使用 bcrypt 哈希
- 不对外暴露明文密钥、SMTP 信息或 AI provider secret
- 管理员功能与申请审核均有权限校验
- AI 生成与问答均对本地代码上下文进行限制，避免越界读取

## CI/CD 说明

CI 配置位于 `.gitlab-ci.yml`，其中必须包括一个名为 `unit-test` 的 job。当前示例流程如下：

```yaml
stages:
  - install
  - test
  - package
```

执行顺序：
1. 安装依赖
2. 执行 unit-test
3. 若 main/master 分支触发，则构建 Docker 镜像

这保证了每次 push 都能进行最小可验证的质量门禁。

## 线上部署 / 可访问入口

当前仓库中给出的是本地开发入口；若要部署到线上，建议：
- 通过 Docker 镜像部署到大陆/海外云容器平台
- 使用容器运行 MySQL 与 API 服务
- 前端可以托管到静态站点或在同一容器中通过 Node 预览

示例线上入口说明：
- WebUI: http://localhost:5173（本地开发）
- API: http://localhost:3000/api（本地开发）
- 生产部署 URL 需按实际发布环境替换并在部署后更新

## 其余工作进程的分支
-可以切换分支查看

## 账号初始化

开发环境默认可使用：

```text
admin@example.edu / AdminProfile123!
testprofile@example.edu / TestProfile123!
123456@example.edu / 12345678
```

> 这些账号仅用于本地开发测试，不适合生产环境使用。

## 结论

该项目已经具备真实应用类项目的工程特征：具有明确的用户价值、清晰的功能模块、可运行的测试流程、分发方案和凭据安全策略。它既能作为校园组队平台演示，又符合 Superpowers 要求的“规范 + 计划 + 过程证据 + 反思”的完整交付标准。
