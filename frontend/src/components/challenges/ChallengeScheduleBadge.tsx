import { CalendarDays } from 'lucide-react';
import { Badge } from '../ui/Badge.tsx';

interface ChallengeScheduleBadgeProps {
  label: string;
  className?: string;
}

export function ChallengeScheduleBadge({ label, className = '' }: ChallengeScheduleBadgeProps) {
  return (
    <Badge variant="amber" icon={<CalendarDays size={12} />} className={className}>
      {label}
    </Badge>
  );
}
