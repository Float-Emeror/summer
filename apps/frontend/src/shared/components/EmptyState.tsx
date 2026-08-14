import { Inbox } from 'lucide-react';
import { ReactNode } from 'react';

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description: string;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  compact?: boolean;
  className?: string;
};

export function EmptyState({ icon, title, description, primaryAction, secondaryAction, compact, className }: EmptyStateProps) {
  return (
    <section className={['empty-state', compact && 'empty-state-compact', className].filter(Boolean).join(' ')}>
      <div className="empty-state__icon">{icon ?? <Inbox size={24} />}</div>
      <h2 className="empty-state__title">{title}</h2>
      <p className="empty-state__description">{description}</p>
      {(primaryAction || secondaryAction) && (
        <div className="empty-state__actions">
          {primaryAction}
          {secondaryAction}
        </div>
      )}
    </section>
  );
}
