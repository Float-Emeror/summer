import { CSSProperties } from 'react';
import { Bell, BookOpen, ClipboardList, Flag, HeartHandshake, Shield, Sparkles, Trophy } from 'lucide-react';

export type DefaultCoverVariant =
  | 'course'
  | 'competition'
  | 'volunteer'
  | 'club'
  | 'bounty'
  | 'system'
  | 'admin'
  | 'default';

type DefaultCoverProps = {
  variant?: DefaultCoverVariant;
  label?: string;
  imageUrl?: string | null;
  className?: string;
  style?: CSSProperties;
};

const icons = {
  course: BookOpen,
  competition: Trophy,
  volunteer: HeartHandshake,
  club: Flag,
  bounty: ClipboardList,
  system: Bell,
  admin: Shield,
  default: Sparkles,
} satisfies Record<DefaultCoverVariant, typeof Sparkles>;

export function DefaultCover({ variant = 'default', label, imageUrl, className, style }: DefaultCoverProps) {
  const Icon = icons[variant];

  if (imageUrl) {
    return (
      <div className={['default-cover default-cover-image', className].filter(Boolean).join(' ')} style={style}>
        <img src={imageUrl} alt={label ?? '资源封面'} />
      </div>
    );
  }

  return (
    <div className={['default-cover', `default-cover-${variant}`, className].filter(Boolean).join(' ')} style={style}>
      <span className="default-cover__grid" aria-hidden="true" />
      <span className="default-cover__icon" aria-hidden="true">
        <Icon size={26} />
      </span>
      {label && <span className="default-cover__label">{label}</span>}
    </div>
  );
}
