/**
 * Avatar — Build 045
 *
 * Semi-realistic SVG portrait avatars for the Shipyard team.
 * Supersedes Build 040 CSS circle avatars (TeamAvatar component is kept
 * for backward compatibility but should be migrated over time).
 *
 * Usage: <Avatar member="reeve" size="md" />
 * Sizes: xs(20) · sm(28) · md(40) · lg(56) · xl(96)
 */

import React from 'react';

export type AvatarMember = 'reeve' | 'morgan' | 'wren' | 'sage' | 'finn' | 'quinn';
export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_PX: Record<AvatarSize, number> = {
  xs: 20,
  sm: 28,
  md: 40,
  lg: 56,
  xl: 96,
};

/** Team background colors — used as fallback ring color */
const MEMBER_COLOR: Record<AvatarMember, string> = {
  reeve:  '#4338ca',
  morgan: '#64748b',
  wren:   '#f59e0b',
  sage:   '#65a30d',
  finn:   '#0d9488',
  quinn:  '#7c3aed',
};

export function Avatar({
  member,
  size = 'md',
  className,
  style,
}: {
  member: AvatarMember;
  size?: AvatarSize;
  className?: string;
  style?: React.CSSProperties;
}) {
  const px = SIZE_PX[size];
  return (
    <div
      data-testid={`team-avatar-${member}`}
      title={member.charAt(0).toUpperCase() + member.slice(1)}
      className={className}
      style={{
        width: px,
        height: px,
        borderRadius: '50%',
        overflow: 'hidden',
        flexShrink: 0,
        backgroundColor: MEMBER_COLOR[member],
        ...style,
      }}
    >
      <img
        src={`/avatars/${member}.svg`}
        alt={member}
        width={px}
        height={px}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  );
}

export default Avatar;
