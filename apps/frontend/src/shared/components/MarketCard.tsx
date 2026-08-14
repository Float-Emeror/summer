import { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { DefaultCover, type DefaultCoverVariant } from './DefaultCover';

export type MarketCardStat = {
  label: string;
  icon?: ReactNode;
};

export type MarketCardMeta = {
  label: string;
  icon?: ReactNode;
};

export type MarketCardDisplayVariant = 'compact' | 'standard' | 'tall' | 'feature';

type MarketCardProps = {
  to?: string;
  state?: unknown;
  className?: string;
  style?: CSSProperties;
  dataVariant?: string;
  displayVariant?: MarketCardDisplayVariant;
  cover?: {
    label?: string;
    tone?: string;
    height?: number;
    icon?: ReactNode;
    imageUrl?: string | null;
    variant?: DefaultCoverVariant;
  };
  category: string;
  statusLabel: string;
  title: string;
  description: string;
  stats: MarketCardStat[];
  meta: MarketCardMeta[];
  progress: number;
  progressLabel: string;
  owner: string;
  supportText: string;
  highlight: string;
  tags: string[];
};

export function MarketCard({
  to,
  state,
  className,
  style,
  dataVariant,
  displayVariant,
  cover,
  category,
  statusLabel,
  title,
  description,
  stats,
  meta,
  progress,
  progressLabel,
  owner,
  supportText,
  highlight,
  tags,
}: MarketCardProps) {
  const variant = displayVariant ?? normalizeDisplayVariant(dataVariant);
  const coverVariant = cover?.variant ?? toneToCoverVariant(cover?.tone);
  const visibleTags = variant === 'compact' ? tags.slice(0, 2) : tags;
  const hiddenTagCount = tags.length - visibleTags.length;
  const coverStyle = cover?.height
    ? ({ '--cover-height': `${cover.height}px` } as CSSProperties)
    : undefined;
  const content = (
    <>
      <div className="market-card-topline">
        <span className="team-type">{category}</span>
        <span className="team-status">{statusLabel}</span>
      </div>

      <div className="market-card-body">
        <h2>{title}</h2>
        {cover && (
          <DefaultCover
            className="market-card-cover resource-card__cover"
            imageUrl={cover.imageUrl}
            label={cover.label}
            style={coverStyle}
            variant={coverVariant}
          />
        )}
        <p>{description}</p>
      </div>

      <div className="market-card-stats">
        {stats.map((stat) => (
          <span key={stat.label}>
            {stat.icon}
            {stat.label}
          </span>
        ))}
      </div>

      <div className="market-card-divider" />

      <div className="team-meta-grid market-meta-grid">
        {meta.map((item) => (
          <span key={item.label}>
            {item.icon}
            {item.label}
          </span>
        ))}
      </div>

      <div className="team-progress market-progress" aria-label={progressLabel}>
        <span style={{ width: `${progress}%` }} />
      </div>

      <div className="market-card-footer">
        <div>
          <span className="market-owner">{owner}</span>
          <span className="market-support">{supportText}</span>
        </div>
        <span className="team-highlight">{highlight}</span>
      </div>

      <div className="tags market-tags">
        {visibleTags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
        {hiddenTagCount > 0 && <span>+{hiddenTagCount}</span>}
      </div>
    </>
  );

  const cardClassName = ['market-card', !to && 'market-card-static', className].filter(Boolean).join(' ');

  if (to) {
    return (
      <Link className={cardClassName} data-variant={variant} style={style} state={state} to={to}>
        {content}
      </Link>
    );
  }

  return (
    <article className={cardClassName} data-variant={variant} style={style}>
      {content}
    </article>
  );
}

function normalizeDisplayVariant(value?: string): MarketCardDisplayVariant {
  if (value === 'compact' || value === 'standard' || value === 'tall' || value === 'feature') return value;
  return 'standard';
}

function toneToCoverVariant(tone?: string): DefaultCoverVariant {
  if (tone === 'indigo') return 'competition';
  if (tone === 'rose') return 'volunteer';
  if (tone === 'sky') return 'club';
  if (tone === 'amber') return 'bounty';
  if (tone === 'violet') return 'course';
  return 'default';
}
