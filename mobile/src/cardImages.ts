import { Image } from 'react-native';

export type CardCategoryKey = 'All' | 'fruit' | 'vegetable' | 'food' | 'animal' | 'object';

const CARD_PLACEHOLDER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 320" fill="none">
  <defs>
    <linearGradient id="bg" x1="24" y1="16" x2="232" y2="304" gradientUnits="userSpaceOnUse">
      <stop stop-color="#1A202A"/>
      <stop offset="1" stop-color="#0A0E16"/>
    </linearGradient>
    <linearGradient id="ring" x1="48" y1="40" x2="208" y2="280" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FFB22B"/>
      <stop offset="1" stop-color="#FF70DA"/>
    </linearGradient>
  </defs>
  <rect x="8" y="8" width="240" height="304" rx="36" fill="url(#bg)"/>
  <rect x="8.5" y="8.5" width="239" height="303" rx="35.5" stroke="url(#ring)" stroke-opacity=".25"/>
  <circle cx="128" cy="118" r="56" fill="#202632"/>
  <path d="M94 240c8-28 29-42 62-42s54 14 62 42" stroke="#444851" stroke-width="18" stroke-linecap="round"/>
  <path d="M128 92c-15 0-26 11-26 26v8h18v-8c0-5 3-9 8-9 4 0 8 4 8 9 0 4-2 7-8 12-11 8-16 16-16 31v7h18v-5c0-8 2-11 9-17 10-8 15-16 15-28 0-15-12-26-26-26z" fill="#FFB22B"/>
  <circle cx="128" cy="193" r="9" fill="#FFB22B"/>
</svg>
`.trim();

export const CARD_PLACEHOLDER_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(CARD_PLACEHOLDER_SVG)}`;

const CATEGORY_ALIASES: Record<string, CardCategoryKey> = {
  all: 'All',
  mixed: 'All',
  mix: 'All',
  fruit: 'fruit',
  fruits: 'fruit',
  vegetable: 'vegetable',
  vegetables: 'vegetable',
  food: 'food',
  foods: 'food',
  animal: 'animal',
  animals: 'animal',
  object: 'object',
  objects: 'object'
};

const CATEGORY_DIRS: Record<Exclude<CardCategoryKey, 'All'>, string> = {
  fruit: 'fruits',
  vegetable: 'vegetables',
  food: 'foods',
  animal: 'animals',
  object: 'objects'
};

const ABSOLUTE_URI_RE = /^(?:https?:|data:|file:|blob:)/i;

export function normalizeCardCategory(raw: unknown): CardCategoryKey {
  const key = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  return CATEGORY_ALIASES[key] ?? 'All';
}

function normalizeAssetDirectory(raw: string) {
  const category = normalizeCardCategory(raw);
  return category === 'All' ? null : CATEGORY_DIRS[category];
}

export function normalizeCardImagePath(raw: unknown) {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  if (ABSOLUTE_URI_RE.test(value)) return value;

  const clean = value.replace(/\\/g, '/');
  const match = clean.match(/^\/?assets\/(?:images\/)?([^/]+)\/([^/]+)$/i);
  if (!match) {
    return clean.startsWith('/') ? clean : `/${clean}`;
  }

  const dir = normalizeAssetDirectory(match[1]);
  if (!dir) return clean.startsWith('/') ? clean : `/${clean}`;
  return `/assets/${dir}/${match[2]}`;
}

export function pickCardImagePath(card: any) {
  return normalizeCardImagePath(card?.imagePath ?? card?.image ?? null);
}

export function resolveCardImageUri(serverUrl: string | null | undefined, card: any) {
  const direct = normalizeCardImagePath(card?.imageUri ?? null);
  if (direct) return direct;

  const imagePath = pickCardImagePath(card);
  if (!imagePath) return null;
  if (ABSOLUTE_URI_RE.test(imagePath)) return imagePath;

  const base = String(serverUrl ?? '').trim().replace(/\/+$/, '');
  if (!base) return null;
  return `${base}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
}

export async function preloadImageUris(uris: Array<string | null | undefined>) {
  const unique = Array.from(
    new Set(
      uris
        .map((uri) => String(uri ?? '').trim())
        .filter(Boolean)
    )
  );

  await Promise.all(
    unique.map(async (uri) => {
      try {
        if (/^(?:data:|file:|blob:)/i.test(uri)) return;
        await Image.prefetch(uri);
      } catch {}
    })
  );
}
