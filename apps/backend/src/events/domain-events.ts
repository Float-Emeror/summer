
export const EventNames = {
  NOTIFICATION_CREATE: 'notification.create',
};

export class NotificationCreateEvent {
  constructor(
    public readonly userId: string,
    public readonly type: string,
    public readonly title: string,
    public readonly content: string,
  ) {}
}