import { ReactNode } from 'react';

type SectionCardProps = {
  title: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function SectionCard({ title, icon, actions, children, className }: SectionCardProps) {
  return (
    <section className={['section-card', className].filter(Boolean).join(' ')}>
      <header className="section-card-head">
        <div>
          {icon}
          <h2>{title}</h2>
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}
