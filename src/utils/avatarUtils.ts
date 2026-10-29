/**
 * Deterministic pastel avatar palettes for members.
 * Produces readable, warm, gentle avatar initials.
 */

export interface AvatarPalette {
  bg: string;
  text: string;
  border: string;
}

const PASTEL_PALETTES: AvatarPalette[] = [
  { bg: '#EDE9FE', text: '#6D28D9', border: '#DDD6FE' }, // Soft Lavender / Violet
  { bg: '#FEE2E2', text: '#B91C1C', border: '#FECACA' }, // Warm Rose
  { bg: '#DCFCE7', text: '#15803D', border: '#BBF7D0' }, // Soft Sage / Meadow
  { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' }, // Warm Butter / Amber
  { bg: '#E0F2FE', text: '#0369A1', border: '#BAE6FD' }, // Soft Sky
  { bg: '#FFEDD5', text: '#C2410C', border: '#FED7AA' }, // Warm Peach
  { bg: '#F3E8FF', text: '#7E22CE', border: '#E9D5FF' }, // Soft Orchid
  { bg: '#CCFBF1', text: '#0F766E', border: '#99F6E4' }  // Soft Mint
];

export function getMemberAvatarPalette(nameOrId: string = ''): AvatarPalette {
  if (!nameOrId) return PASTEL_PALETTES[0];
  let hash = 0;
  for (let i = 0; i < nameOrId.length; i++) {
    hash = (hash << 5) - hash + nameOrId.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % PASTEL_PALETTES.length;
  return PASTEL_PALETTES[index];
}
