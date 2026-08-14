import { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

type PageHeroProps = {
  icon: ReactNode;
  eyebrow: ReactNode;
  title: ReactNode;
  description: ReactNode;
  actions?: ReactNode;
  className?: string;
  backTo?: string;
};

export function PageHero({ icon, eyebrow, title, description, actions, className, backTo }: PageHeroProps) {
  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.assign(backTo ?? '/teams');
    }
  }

  return (
    <header className={['page-hero compact compact-page-header', className].filter(Boolean).join(' ')}>
      <div>
        <span className="eyebrow compact-page-header__eyebrow">
          {icon}
          {eyebrow}
        </span>
        <h1 className="compact-page-header__title">{title}</h1>
        <p className="compact-page-header__description">{description}</p>
      </div>
      <div className="page-hero-actions">
        {actions}
        {backTo && (
          <button type="button" className="icon-button page-hero-back" onClick={goBack} aria-label="返回上一步">
            <ArrowLeft size={18} />
          </button>
        )}
      </div>
    </header>
  );
}
