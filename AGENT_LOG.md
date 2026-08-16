# AGENT_LOG.md

> 本日志按时间顺序记录任务、Superpowers 技能、关键 prompt、关键输出与人工修正。所有记录均用于说明过程证据，不代表最终代码已完成的所有细节。

## 2026-08-14 09:10
- Task: T0. 需求与工程边界确认
- Triggered skill: brainstorming
- Key prompt: “请根据校园组队和协作场景，定义真实用户、核心功能和分发要求，且要求说明凭据安全与 CI。”
- Subagent output: 提炼出“三大核心闭环：组队、任务协作、审核与通知”，并指出 AI 模块应具备 fallback。
- Human intervention: 统一项目定位为“校园协作平台而非单纯报名表”；追加 security 与 deployment 章节。
- Lesson: 早期定位错误会让后续功能爆炸；必须先界定真实价值与工程边界。

## 2026-08-14 09:40
- Task: T1. 生成 SPEC 和 PLAN 初稿
- Triggered skill: writing-plans
- Key prompt: “把项目拆成 8–10 个 task，每个 task 必须包含文件、目标和验证步骤，并标出依赖。”
- Subagent output: 生成了用户认证、队伍管理、任务协作、AI 模块等初版任务清单。
- Human intervention: 增加 `SPEC_PROCESS.md` 与 `AGENT_LOG.md` 的要求，补全冷启动验证和审查环节，并推进文档结构标准化。
- Lesson: plan 具备“可审计性”，比“功能列表”更有工程价值。

## 2026-08-14 10:20
- Task: T2. 冷启动验证与 spec 缺陷修正
- Triggered skill: subagent-driven-development
- Key prompt: “只基于 SPEC + PLAN，选择 1–2 个任务推进，遇到不确定处必须暂停并说明问题。”
- Subagent output: 暂停于“角色权限和 AI key 空值处理”两个重点，指出 spec 不是足够清晰。
- Human intervention: 修改 SPEC 中的权限边界、AI fallback 条件和分发说明，补充关键风险项。
- Lesson: 规范不清楚时，新 agent 会在无定义的接口处猜测，这是最值得修正的地方。

## 2026-08-14 11:10
- Task: T3. 文档与工程交付收口
- Triggered skill: finishing-a-development-branch
- Key prompt: “整理最终交付文件，确认哪些是必交材料、哪些是运行所需支持文件。”
- Subagent output: 列出缺失文件清单：SPEC、PLAN、AGENT_LOG、SPEC_PROCESS、REFLECTION、CI、Dockerfile。
- Human intervention: 将缺口按优先级排序，优先补 `SPEC.md`、`PLAN.md`、`AGENT_LOG.md`、`SPEC_PROCESS.md`、`REFLECTION.md`，随后补齐 Docker 和 CI。
- Lesson: 在工程中“文档缺失”比“功能编码少一点”更致命，因为评审会直接从交付物验证过程。

## 2026-08-14 12:00
- Task: T4. README / 分发标准化
- Triggered skill: request-code-review
- Key prompt: “README 应写清安装、运行、分发、key 安全和 CI/CD，且要说明已知限制。”
- Subagent output: 归纳出 README 必须包含 7 大章节，且必须强调从零运行。
- Human intervention: 重写 README，补充 `Dockerfile` / `.gitlab-ci.yml` / `.dockerignore` 和线上入口说明。
- Lesson: README 不是说明文档，是证明“别人能否从零运行”的工程证据。

## 2026-08-14 13:35
- Task: T9. 提交与远程同步
- Triggered skill: finishing-a-development-branch
- Key prompt: “按 task 顺序提交并记录 commit hash，确保每个 worktree / task 都有可追踪的历史，并同步到目标 GitHub 仓库。”
- Subagent output: 生成基线提交并确认项目文件已准备就绪，后续使用 git push 同步到 `Float-Emeror/summer`。
- Human intervention: 规范提交分支、补充 `PLAN.md` 中的 commit hash 记录，并确保真实凭据未进入仓库；对已存在的 .env 暂不提交。
- Lesson: 最终的可审计性来自“可追踪的任务历史 + 安全检查”，而不只是代码本身。

## 2026-08-14 14:20
- Task: T2. 登录前邮箱验证门禁修复
- Triggered skill: test-driven-development
- Key prompt: “在 auth 模块中补一个失败测试，验证 EMAIL_VERIFICATION_REQUIRED=true 时未验证用户不能登录，并实现最小修复。”
- Subagent output: 先红为止，新增回归测试失败，确认登录未校验邮箱验证状态；随后通过最小修复让用例变绿。
- Human intervention: 将校验条件落在 `AuthService.login`，确保只有在 `EMAIL_VERIFICATION_REQUIRED` 开启时才阻止未验证用户登录；同时保留已验证/关闭验证的正常登录路径。
- Verification: `cd apps && corepack pnpm --filter @campus-team/api test -- --runInBand --watch=false` -> 2/2 tests passed.
- Commit: `a6d7416d6c3f7597eb7a2f3f3e9465ae816c3e19`

## 2026-08-14 15:10
- Task: T3. 队伍审批与重复加入校验
- Triggered skill: test-driven-development
- Key prompt: “在 applications 模块中补一个失败测试，确认队伍已满或已有同一用户时，不允许审批通过，且不能重复加入。”
- Subagent output: 先红为止，新增回归测试暴露审批通过时没有检查队伍容量和重复成员；随后实现最小修复。
- Human intervention: 在 `ApplicationsService.reviewApplication` 中增加 `team.members.length >= maxMembers` 与 `alreadyJoined` 校验，确保审批流不破坏成员唯一性和容量边界。
- Verification: `cd apps && corepack pnpm --filter @campus-team/api test -- --runInBand --watch=false` -> 6/6 tests passed.
- Commit: `5f954e92f63b1d2330655e7aed029fd7812101d6`

## 2026-08-14 15:50
- Task: T4. 默认推荐排序修复
- Triggered skill: test-driven-development
- Key prompt: “在 match 模块中补一个失败测试，确认未传 skills 时应保留默认推荐排序，而不是把所有结果过滤掉。”
- Subagent output: 在空技能筛选场景下，推荐结果被错误过滤为空；随后修正过滤逻辑，保留默认排序与排序稳定性。
- Human intervention: 调整 `recommendTeamsForUser` 和 `recommendUsersForUser` 的过滤条件，只有在显式技能过滤时才要求 `matchScore > 0`；未指定筛选时保留默认列表。
- Verification: `cd apps && corepack pnpm --filter @campus-team/api test -- --runInBand --watch=false` -> 8/8 tests passed.
- Commit: `139f0b858c35cb253a21b0b3439e5e9ddad10aca`

## 2026-08-14 17:10
- Task: T5. 任务状态合法性与队长确认修复
- Triggered skill: test-driven-development
- Key prompt: “在 tasks 模块中补一个失败测试，确认非法状态转移和非队长确认必须被拒绝，并实现最小修复。”
- Subagent output: 先红为止，任务状态转换缺少合法性校验；随后增加状态转移表和 owner-only 检查。
- Human intervention: 在 `TasksService.updateTaskStatus` 中加入 `allowedTransitions` 校验，并保留成员/负责人权限限制；同时补充 `deleteTask` 的队长控制约束。
- Verification: `cd apps && corepack pnpm --filter @campus-team/api test -- --runInBand --watch=false` -> 9/9 tests passed.
- Commit: `5c4a6ab8b1c150acb3c1661abfdb30f2bd34ab0d`

## 2026-08-14 21:45
- Task: T9. 安全 / 分发 / CI / 文档整合
- Triggered skill: finishing-a-development-branch
- Key prompt: “在 T9 分支中补齐最终交付工程：确保 Docker、CI 和安全说明都落地，且追踪最终提交。”
- Subagent output: 发现 Dockerfile 在 Alpine 下安装 `bcrypt` 时因未安装 `python3 / make / g++` 而在构建阶段退出，说明分发工件本身还缺少 native build 依赖。
- Human intervention: 在 `Dockerfile` 的 base 镜像中加入 `apk add --no-cache python3 make g++`，保障 `bcrypt` 能在 Alpine 容器里编译；同时核对 README、CI 与 `.env.example` 的交付边界一致。
- Verification: `cd apps && corepack pnpm test` -> backend 6/6 suites passed, frontend 13/13 files passed, 29 tests total passed.
- Follow-up note: Docker build is now aligned with the actual native dependency requirement; full image creation remains environment-sensitive in this WSL/Docker setup and should be rechecked on the target delivery host.
- Commit: `319090a`
