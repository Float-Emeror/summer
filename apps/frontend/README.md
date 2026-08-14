# 前端项目说明

前端使用 Vite + React + TypeScript，页面先以 MVP 骨架和 mock 数据为主，接口调用集中封装在 `src/shared/api`。

## 入口

- 页面入口：`src/main.tsx`
- 路由：`src/app/router.tsx`
- 全局样式：`src/styles.css`
- API client：`src/shared/api/client.ts`

## 启动

```bash
corepack pnpm --filter @campus-team/web dev
```

## 测试

```bash
corepack pnpm --filter @campus-team/web test
```

## 页面

已创建登录、注册、个人资料、队伍列表、队伍详情、发布组队、推荐搜索、任务看板、群聊、通知中心和管理员处理页面。
