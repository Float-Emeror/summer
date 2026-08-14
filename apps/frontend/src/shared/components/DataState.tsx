import { AlertCircle, Check, Info, Inbox, Loader2 } from 'lucide-react';
import { ReactNode } from 'react';

type DataStateProps = {
  tone: 'loading' | 'error' | 'empty' | 'success' | 'info';
  children: ReactNode;
  className?: string;
};

const icons = {
  loading: <Loader2 size={16} className="spin-icon" />,
  error: <AlertCircle size={16} />,
  empty: <Inbox size={16} />,
  success: <Check size={16} />,
  info: <Info size={16} />,
};

export function DataState({ tone, children, className }: DataStateProps) {
  return (
    <div className={['data-state', `data-state-${tone}`, className].filter(Boolean).join(' ')}>
      {icons[tone]}
      <span>{children}</span>
    </div>
  );
}
