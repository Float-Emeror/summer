import { Award, BookOpen, Gift, HeartHandshake, Shapes, Trophy } from 'lucide-react';
import type { ReactNode } from 'react';
import { teamTypeLabels } from './team';
import type { TeamType } from '../types/domain';

export type TeamFilter = 'ALL' | TeamType;

export function createTeamTypeTabs(allLabel: string): Array<{ value: TeamFilter; label: string }> {
  return [
    { value: 'ALL', label: allLabel },
    { value: 'COURSE', label: teamTypeLabels.COURSE },
    { value: 'COMPETITION', label: teamTypeLabels.COMPETITION },
    { value: 'VOLUNTEER', label: teamTypeLabels.VOLUNTEER },
    { value: 'CLUB', label: teamTypeLabels.CLUB },
    { value: 'BOUNTY', label: teamTypeLabels.BOUNTY },
  ];
}

export function teamTypeIcon(type: TeamType, size = 18, competitionIcon: 'award' | 'trophy' = 'award'): ReactNode {
  const icons: Record<TeamType, ReactNode> = {
    COURSE: <BookOpen size={size} />,
    COMPETITION: competitionIcon === 'trophy' ? <Trophy size={size} /> : <Award size={size} />,
    VOLUNTEER: <HeartHandshake size={size} />,
    CLUB: <Shapes size={size} />,
    BOUNTY: <Gift size={size} />,
  };

  return icons[type];
}
