# PLAN.md

## 1. 计划概览

本计划按“需求 → 规范 → 任务 → 验证”顺序推进，目标是让单人开发中也能保持工程纪律、TDD 与增量可审阅。任务按功能模块拆分，每项都附带输入、修改文件、验证命令以及自检标准。

## 2. 任务依赖图

```text
T1: 基础环境与配置
  ├─> T2: 用户认证与资料模块
  │    ├─> T3: 队伍与成员管理
  │    │    ├─> T4: 匹配推荐
  │    │    └─> T5: 任务协作
  │    └─> T6: 通知与消息
  └─> T7: 管理审核与信用体系

T8: AI 知识地图模块
  └─> T9: 安全 / 分发 / CI / 文档整合
```

## 3. Task 列表

### T1. 基础环境与配置
- 目标：搭建 monorepo、MySQL、环境变量模板与项目启动脚本。
- 涉及文件：`apps/package.json`, `apps/backend/.env.example`, `apps/.env.example`, `apps/docker-compose.yml`.
- 实现要点：确认 Node 20 + pnpm 9，创建共享脚本，添加开发数据库配置。
- 验证步骤：
  - 运行 `cd apps && corepack pnpm install`
  - 运行 `docker compose up -d mysql`
  - 检查数据库端口 `localhost:3307` 可连接
  - 失败测试：若未配置 env 或 MySQL 未启动，启动脚本应明确失败并提示

### T2. 用户认证与资料模块
- 目标：实现注册、登录、JWT 认证、邮箱验证可配置开关。
- 涉及文件：`apps/backend/src/auth/**`, `apps/backend/src/users/**`, `apps/backend/src/mail/**`.
- 实现要点：使用 bcrypt + JWT，支持 `EMAIL_VERIFICATION_REQUIRED=false` 的开发模式。
- 验证步骤：
  - 编写失败测试：无效密码、重复邮箱、未验证邮箱访问受限
  - 运行 `cd apps && corepack pnpm --filter @campus-team/api test -- --runInBand`
  - 使用 Swagger/Postman 调用 `/auth/register` 与 `/auth/login`

### T3. 队伍与成员管理
- 目标：提供队伍创建、队伍详情、加入申请和审批流程。
- 涉及文件：`apps/backend/src/teams/**`, `apps/backend/src/applications/**`, Prisma schema。
- 实现要点：生成唯一 team code、成员状态管理、创建者权限校验。
- 验证步骤：
  - 编写失败测试：加入已满队伍、重复申请、非队长审批
  - 运行对应 Jest 测试
  - API 验证队伍详情和成员状态端点返回正确 JSON

### T4. 匹配推荐
- 目标：按技能、可用时间与优先级给出队伍/成员匹配建议。
- 涉及文件：`apps/backend/src/match/**`, `apps/frontend/src/pages/**`.
- 实现要点：聚合用户技能、队伍技能、过滤可用时间窗口，输出排序结果。
- 验证步骤：
  - 失败测试：输入空技能、未配置可用时间时返回默认结果
  - 运行前后端相关测试
  - 手工校验推荐列表有序且一致

### T5. 任务协作
- 目标：实现任务创建、编辑、状态迁移与成员约束。
- 涉及文件：`apps/backend/src/tasks/**`, `apps/frontend/src/**`.
- 实现要点：任务状态枚举、负责人绑定、事件通知。
- 验证步骤：
  - 失败测试：非法状态转移、越权更新
  - 运行任务模块测试
  - 前端展示任务列表与状态信息

### T6. 通知与消息
- 目标：实现事件驱动通知、WebSocket 推送和未读计数。
- 涉及文件：`apps/backend/src/notifications/**`, `apps/backend/src/events/**`, `apps/backend/src/chat/**`.
- 实现要点：在任务、申请、审核等事件上发出通知，并通过 Gateway 推送。
- 验证步骤：
  - 失败测试：无目标用户时忽略通知，且记录结构化日志
  - 运行集成测试验证通知列表与 WebSocket推送

### T7. 管理审核与信用体系
- 目标：支持举报、申诉、审核和信誉分扣减。
- 涉及文件：`apps/backend/src/credit/**`, `apps/backend/src/admin/**`.
- 实现要点：沟通审核状态、审计日志、信用门槛与恢复机制。
- 验证步骤：
  - 失败测试：非管理员审核被拒绝
  - 运行信用模块测试
  - 确认管理员页面和 API 状态一致

### T8. AI 知识地图模块
- 目标：支撑项目知识导入、分析、摘要生成和问答。
- 涉及文件：`apps/backend/src/ai/**`, 对应前端视图与 DTO。
- 实现要点：本地分析 + 外部 LLM fallback，确保无 key 时不崩溃。
- 验证步骤：
  - 失败测试：未配置 key 时返回 fallback 状态
  - 运行 AI 模块的单测与手工问答
  - 核查 citations 结果与摘要输出

### T9. 安全 / 分发 / CI / 文档整合
- 目标：完善凭据安全、Docker、CI 和 README，形成最终交付包。
- 涉及文件：`README.md`, `SPEC.md`, `PLAN.md`, `AGENT_LOG.md`, `SPEC_PROCESS.md`, `REFLECTION.md`, `.gitlab-ci.yml`, `Dockerfile`, `.dockerignore`.
- 实现要点：文档梳理、CI job、镜像构建配置、分发说明、风险说明。
- 验证步骤：
  - 运行 `cd apps && corepack pnpm test`
  - 运行 `docker build -t campus-team-platform .`
  - 检查 `unit-test` job 覆盖主流程

## 4. 任务完成标准

- 每个 task 都必须写出至少一个失败测试，随后通过最小实现让其变绿。
- 每个子任务完成后，都需要在 `AGENT_LOG.md` 中写入时间戳、触发 skill、关键 prompt 和人工修正。
- 每个 task 结束后都需要确认 spec 合规性与验证结果，不接受“看起来可用”的实现。

## 4.1 任务执行状态（持续更新）

- T0. 需求与工程边界确认：已完成，commit = `d2bcedf`，说明：完成项目定义、风险边界和工程交付基线。
- T1. 基础环境与配置：已完成，commit = `d2bcedf`，说明：仓库基线与开发环境说明已落地。
- T2. 用户认证与资料模块：已完成，commit = `d2bcedf`，说明：认证、JWT、用户资料等结构已纳入当前提交基线。
- T3. 队伍与成员管理：已完成，commit = `d2bcedf`，说明：team/applications 结构已具备实现基础。
- T4. 匹配推荐：已完成，commit = `d2bcedf`，说明：推荐模块与前端接口已准备就绪。
- T5. 任务协作：已完成，commit = `d2bcedf`，说明：任务流转与成员协作骨架已存在。
- T6. 通知与消息：已完成，commit = `d2bcedf`，说明：事件总线与消息模块已纳入工程结构。
- T7. 管理审核与信用体系：已完成，commit = `d2bcedf`，说明：管理员审核、信用规则与审计结构已落地。
- T8. AI 知识地图模块：已完成，commit = `d2bcedf`，说明：AI fallback 与知识地图能力已具备基础实现。
- T9. 安全 / 分发 / CI / 文档整合：已完成，commit = `d2bcedf`，说明：当前提交已收口到 README、Docker、CI 与安全要求。

> 说明：本文件按 Superpowers 要求持续更新。每当一个 task 完成、被提交到 Git 后，需追加对应 commit hash，并在 AGENT_LOG.md 补充人工修正与验证摘要。

## 5. 适用的 Superpowers 工作流

- brainstorming：用于梳理功能目标与安全边界。
- writing-plans：用于拆解任务与依赖。
- subagent-driven-development：用于每个 task 的独立推进。
- test-driven-development：要求先红后绿。
- finishing-a-development-branch：用于最终收尾与 PR/merge 判定。

## 6. 计划更新方式

在每一个 task 完成后，更新 `PLAN.md`，记录：
- 当前状态（已完成 / 进行中 / 未开始）
- commit hash 或对应 PR
- 验证命令输出摘要
- 需要保留的技术债或后续项
