import React from 'react';

import reeveSvg from './reeve.svg';
import morganSvg from './morgan.svg';
import wrenSvg from './wren.svg';
import sageSvg from './sage.svg';
import finnSvg from './finn.svg';
import quinnSvg from './quinn.svg';
// GTM team — Build 050
import sloaneSvg from './sloane.svg';
import reedSvg from './reed.svg';
import claireSvg from './claire.svg';
import grantSvg from './grant.svg';
import danaSvg from './dana.svg';

/** Build team + GTM team */
export type Member =
  | 'reeve' | 'morgan' | 'wren' | 'sage' | 'finn' | 'quinn'
  | 'sloane' | 'reed' | 'claire' | 'grant' | 'dana';

export type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const AVATAR_SRC: Record<Member, string> = {
  // Build team
  reeve: reeveSvg,
  morgan: morganSvg,
  wren: wrenSvg,
  sage: sageSvg,
  finn: finnSvg,
  quinn: quinnSvg,
  // GTM team
  sloane: sloaneSvg,
  reed: reedSvg,
  claire: claireSvg,
  grant: grantSvg,
  dana: danaSvg,
};

const SIZE_PX: Record<Size, number> = {
  xs: 20,
  sm: 28,
  md: 40,
  lg: 56,
  xl: 96,
};

/** Display name for each team member — for alt text / accessibility */
const MEMBER_NAME: Record<Member, string> = {
  reeve: 'Reeve',
  morgan: 'Morgan',
  wren: 'Wren',
  sage: 'Sage',
  finn: 'Finn',
  quinn: 'Quinn',
  sloane: 'Sloane',
  reed: 'Reed',
  claire: 'Claire',
  grant: 'Grant',
  dana: 'Dana',
};

/** Role label for each team member */
export const MEMBER_ROLE: Record<Member, string> = {
  // Build team
  reeve: 'Project Manager',
  morgan: 'Product Manager',
  wren: 'Designer',
  sage: 'Data Architect',
  finn: 'Engineer',
  quinn: 'QA Engineer',
  // GTM team
  sloane: 'GTM Lead',
  reed: 'Analyst',
  claire: 'Copywriter',
  grant: 'SEO / Growth',
  dana: 'Launch & Email',
};

/** Team color for each member */
export const MEMBER_COLOR: Record<Member, string> = {
  // Build team
  reeve: '#4338ca',
  morgan: '#64748b',
  wren: '#f59e0b',
  sage: '#65a30d',
  finn: '#0d9488',
  quinn: '#7c3aed',
  // GTM team
  sloane: '#e11d48',
  reed: '#ea580c',
  claire: '#db2777',
  grant: '#65a30d',
  dana: '#0284c7',
};

interface AvatarProps {
  member: Member;
  size?: Size;
  /** Override pixel size directly (bypasses Size enum) */
  px?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Avatar — renders a team member portrait SVG in a circular frame.
 *
 * Usage:
 *   <Avatar member="reeve" size="lg" />
 *   <Avatar member="morgan" size="md" />
 *   <Avatar member="wren" size="sm" />
 *
 * Sizes: xs=20px · sm=28px · md=40px · lg=56px · xl=96px
 *
 * Build team:
 *   Reeve  — Project Manager   — Indigo  #4338ca
 *   Morgan — Product Manager   — Slate   #64748b
 *   Wren   — Designer          — Amber   #f59e0b
 *   Sage   — Data Architect    — Green   #65a30d
 *   Finn   — Engineer          — Teal    #0d9488
 *   Quinn  — QA Engineer       — Violet  #7c3aed
 *
 * GTM team (Build 050):
 *   Sloane — GTM Lead          — Rose   #e11d48
 *   Reed   — Analyst           — Orange #ea580c
 *   Claire — Copywriter        — Pink   #db2777
 *   Grant  — SEO / Growth      — Lime   #65a30d
 *   Dana   — Launch & Email    — Sky    #0284c7
 */
export function Avatar({ member, size = 'md', px, className, style }: AvatarProps) {
  const dimension = px ?? SIZE_PX[size];
  const name = MEMBER_NAME[member];

  return (
    <img
      src={AVATAR_SRC[member]}
      alt={`${name} avatar`}
      width={dimension}
      height={dimension}
      className={className}
      style={{
        borderRadius: '50%',
        display: 'inline-block',
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

export default Avatar;
