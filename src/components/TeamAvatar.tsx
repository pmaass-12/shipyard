/**
 * TeamAvatar — Build 040
 *
 * Colored initial avatar for a named team member.
 * Sizes: xs (20px), sm (28px), md (36px), lg (48px)
 */

import type { TeamMemberSlug } from '@/lib/team';
import { TEAM } from '@/lib/team';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_PX: Record<AvatarSize, number> = {
  xs:  20,
  sm:  28,
  md:  36,
  lg:  48,
};

const FONT_SIZE: Record<AvatarSize, number> = {
  xs:  9,
  sm:  11,
  md:  13,
  lg:  17,
};

interface TeamAvatarProps {
  member:    TeamMemberSlug;
  size?:     AvatarSize;
  showName?: boolean;       // append member name beside avatar
  className?: string;
}

export default function TeamAvatar({
  member,
  size = 'sm',
  showName = false,
  className = '',
}: TeamAvatarProps) {
  const tm = TEAM[member];
  const px = SIZE_PX[size];
  const fs = FONT_SIZE[size];

  const avatar = (
    <div
      data-testid={`team-avatar-${member}`}
      title={`${tm.name} — ${tm.role}`}
      style={{
        width:           px,
        height:          px,
        borderRadius:    '50%',
        backgroundColor: tm.color,
        color:           '#fff',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        fontSize:        fs,
        fontWeight:      700,
        flexShrink:      0,
        userSelect:      'none',
      }}
    >
      {tm.initials}
    </div>
  );

  if (!showName) return <div className={className}>{avatar}</div>;

  return (
    <div
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      {avatar}
      <span style={{ fontSize: fs + 1, fontWeight: 600, color: tm.color }}>
        {tm.name}
      </span>
    </div>
  );
}
