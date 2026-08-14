# 后端项目说明

后端使用 NestJS + TypeScript，采用模块化单体和 Controller-Service-Repository 分层。

## 入口

- 应用入口：`src/main.ts`
- 根模块：`src/app.module.ts`
- Swagger：启动后访问 `/api/docs`
- Prisma schema：`prisma/schema.prisma`

## 启动

```bash
corepack pnpm --filter @campus-team/api dev
```

## 测试

```bash
corepack pnpm --filter @campus-team/api test
```

## 模块

已创建 `auth`、`users`、`teams`、`applications`、`tasks`、`match`、`credit`、`chat`、`notifications`、`admin`、`prisma`、`events` 和 `common`。
