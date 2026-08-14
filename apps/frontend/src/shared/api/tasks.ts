import { Task, TaskStatus } from '../types/domain';
import { apiRequest } from './client';

export type CreateTaskPayload = {
  title: string;
  description?: string;
  deadline?: string;
  assigneeIds?: string[];
};

export type UpdateTaskPayload = {
  title?: string;
  description?: string;
  deadline?: string;
};

function normalizeAssigneeIds(task: any) {
  if (Array.isArray(task.assigneeIds)) {
    return task.assigneeIds.filter(Boolean);
  }

  if (Array.isArray(task.assignments)) {
    return task.assignments
      .map((assignment: any) => assignment.userId ?? assignment.user?.id)
      .filter(Boolean);
  }

  return [];
}

function normalizeTask(task: any): Task {
  return {
    id: task.id ?? '',
    teamId: task.teamId ?? '',
    title: task.title ?? '',
    description: task.description ?? null,
    status: (task.status ?? 'TODO') as TaskStatus,
    deadline: task.deadline ?? null,
    createdAt: task.createdAt,
    assigneeIds: normalizeAssigneeIds(task),
  };
}

export const tasksApi = {
  board: (teamId: string) =>
    apiRequest<any[]>(`/teams/${teamId}/tasks`).then((items) => (items ?? []).map(normalizeTask)),

  create: (teamId: string, payload: CreateTaskPayload) =>
    apiRequest<any>(`/teams/${teamId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then(normalizeTask),

  update: (id: string, payload: UpdateTaskPayload) =>
    apiRequest<any>(`/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }).then(normalizeTask),

  updateStatus: (id: string, status: TaskStatus) =>
    apiRequest<any>(`/tasks/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }).then(normalizeTask),

  confirm: (id: string) =>
    apiRequest<any>(`/tasks/${id}/confirm`, { method: 'POST' }).then(normalizeTask),

  updateAssignees: (id: string, assigneeIds: string[]) =>
    apiRequest<any>(`/tasks/${id}/assignees`, {
      method: 'PATCH',
      body: JSON.stringify({ assigneeIds }),
    }).then(normalizeTask),

  remove: (id: string) => apiRequest<any>(`/tasks/${id}`, { method: 'DELETE' }),
};
