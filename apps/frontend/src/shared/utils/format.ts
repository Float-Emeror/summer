export function formatDeadline(deadline?: string | null) {
  if (!deadline) {
    return '长期招募';
  }

  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) {
    return deadline;
  }

  return `${date.getMonth() + 1}月${date.getDate()}日截止`;
}
