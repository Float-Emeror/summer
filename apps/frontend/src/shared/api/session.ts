// 会话辅助：旧版本可能在 localStorage 中留下 `demo.xxx` token。
// 当前前端只支持真实后端 JWT；写操作需要拒绝旧演示 token 并提示重新登录。

export function getAccessToken() {
  return localStorage.getItem('accessToken');
}

export function isDemoSession() {
  return getAccessToken()?.startsWith('demo.') ?? false;
}
