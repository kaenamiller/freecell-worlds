// The art-direction spec the LLM writes for one variation, and the checks that turn it
// into something the game can trust. The spec mirrors a WORLDS entry in
// js/theme-expansion.js plus the prompts for every image and the music.
import { z } from 'zod';
import { THEMES, THEME_ORDER } from '../../../js/themes.js';

export const FONTS = ['Cormorant Garamond', 'Cinzel', 'Josefin Sans', 'Antonio', 'Fredoka'];
export const SURFACES = ['wood', 'marble', 'slate', 'paint', 'cloth', 'laminate', 'carbon', 'felt', 'ceramic', 'lacquer', 'glass'];
export const PARTICLES = ['motes', 'petals', 'bubbles', 'fireflies', 'stars', 'rain', 'champagne'];
// Built-in tables whose UI sounds and ambience a custom theme borrows.
export const SOUND_SETS = THEME_ORDER.map((id) => ({ id, name: THEMES[id].name, tagline: THEMES[id].tagline }));

const hex = z.string().describe('Hex colour, #rrggbb');

export const Moderation = z.object({
  allowed: z.boolean(),
  category: z.enum(['ok', 'sexual', 'minors', 'hate', 'harassment', 'violence', 'self_harm', 'illegal', 'real_person', 'trademark', 'copyrighted_character', 'spam', 'other']),
  reason: z.string().describe('One short sentence the player will see if the prompt is refused. Empty when allowed.'),
});

export const ThemeSpec = z.object({
  name: z.string().describe('Table name, 1-4 words, max 28 characters'),
  tagline: z.string().describe('One evocative line, max 70 characters, like "Cold stars, a radio dish and an amber window."'),
  palette: z.object({
    bg: hex.describe('Dark page background'),
    panel: hex.describe('UI panel colour, slightly lighter than bg'),
    accent: hex.describe('Main highlight; must read clearly on bg'),
    secondary: hex,
    paperLight: hex.describe('Card face, near white'),
    paperShade: hex.describe('Card face shadow tone, a little darker than paperLight'),
    ink: hex.describe('Black-suit ink; must contrast strongly with the paper'),
    red: hex.describe('Red-suit ink; clearly red, contrasting with the paper'),
    rail: hex.describe('Table rail colour'),
    inlay: hex.describe('Table inlay / card border colour'),
    keyLight: hex.describe('Main light colour, pale'),
    fillLight: hex.describe('Fill light colour, pale'),
    ambient: hex.describe('Floating particle colour'),
  }),
  font: z.enum(FONTS),
  surface: z.enum(SURFACES),
  particles: z.enum(PARTICLES),
  glow: z.number().describe('0 for none, up to 0.35 for neon or molten looks'),
  soundsLike: z.enum(THEME_ORDER).describe('Built-in table whose ambience and UI sounds fit best'),
  art: z.object({
    palette: z.string().describe('Comma-separated colour words shared by every image'),
    board: z.string().describe('Table surface seen from directly above. Quiet, even, low-contrast centre; any detail only at the outer rim.'),
    backdrop: z.string().describe('Wide environment behind the table, no people, no cards'),
    hero: z.string().describe('Title key art. Main subject in the right half, left third dark and open, a fan of face-down cards in the right foreground whose backs echo the card-back design'),
    back: z.string().describe('Point-symmetric card back pattern, full-bleed, a small central medallion'),
    jack: z.string().describe('Head-and-shoulders portrait for the Jack, a young figure'),
    queen: z.string().describe('Head-and-shoulders portrait for the Queen'),
    king: z.string().describe('Head-and-shoulders portrait for the King, an older figure'),
    portraitBackground: z.string().describe('Plain background shared by the three portraits'),
  }),
  music: z.string().describe('Instrumental music prompt: genre, instruments, tempo, mood. Loopable background for a calm card game. No artist or song names.'),
});

const HEX = /^#[0-9a-f]{6}$/i;
const clamp = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const luma = (h) => {
  const n = parseInt(h.slice(1), 16);
  const c = [16, 8, 0].map((s) => ((n >> s) & 255) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => {
  const [x, y] = [luma(a), luma(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const trim = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

// Fill gaps and enforce readability so a bad spec can't produce unplayable cards.
export function sanitizeSpec(spec) {
  const p = { ...spec.palette };
  const fallback = { bg: '#1e1a1c', panel: '#2c2629', accent: '#e0b870', secondary: '#9cc4c8', paperLight: '#fbf3e2', paperShade: '#e8dcc4', ink: '#231d1a', red: '#b0353c', rail: '#4a3a30', inlay: '#b8935a', keyLight: '#ffe8c8', fillLight: '#b8c8e0', ambient: '#e8d8b0' };
  for (const k of Object.keys(fallback)) if (!HEX.test(p[k] || '')) p[k] = fallback[k];
  if (luma(p.paperLight) < 0.6) [p.paperLight, p.paperShade] = [fallback.paperLight, fallback.paperShade];
  if (contrast(p.ink, p.paperShade) < 7) p.ink = fallback.ink;
  if (contrast(p.red, p.paperShade) < 3.5) p.red = fallback.red;
  if (luma(p.bg) > 0.12) p.bg = fallback.bg;
  return {
    ...spec,
    name: trim(spec.name, 28) || 'My Table',
    tagline: trim(spec.tagline, 70),
    palette: Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.toLowerCase()])),
    font: FONTS.includes(spec.font) ? spec.font : FONTS[0],
    surface: SURFACES.includes(spec.surface) ? spec.surface : 'wood',
    particles: PARTICLES.includes(spec.particles) ? spec.particles : 'motes',
    glow: clamp(spec.glow, 0, 0.35, 0),
    soundsLike: THEME_ORDER.includes(spec.soundsLike) ? spec.soundsLike : THEME_ORDER[0],
  };
}
