function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function isSafeUrl(url: string) {
  return /^(https?:\/\/|mailto:|\/|#)/.test(url);
}

export function renderMarkdown(markdown: string) {
  let html = escapeHtml(markdown);
  html = html.replace(/\[([^\]]+)]\(([^)]+)\)/g, (_match, text: string, url: string) => {
    const safeUrl = isSafeUrl(url) ? url : '#';
    return `<a href="${safeUrl}" target="_blank" rel="noreferrer">${text}</a>`;
  });
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  return html.replace(/\n/g, '<br />');
}
