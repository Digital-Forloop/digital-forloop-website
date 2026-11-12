import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { zipSync, strToU8, type Zippable } from 'fflate';
import { DISCORD_URL, YOUTUBE_URL } from '../../../config/links';

const PRESS_EMAIL = 'contact@digitalforloop.com';
const STUDIO = 'Digital Forloop';
const STUDIO_LOGO = '/assets/logo-horizontal.svg';
const STUDIO_LOGO_PNG = '/assets/logo-horizontal.png';
const STUDIO_LOGO_PNG_DARK = '/assets/logo-horizontal-inverted.png';

export const getStaticPaths = (async () => {
  const games = await getCollection('games');
  return games.map((game) => ({ params: { slug: game.id }, props: { game } }));
}) satisfies GetStaticPaths;

const publicPath = (webPath: string) => join(process.cwd(), 'public', webPath);

// Images are already compressed; storing them avoids wasted build time.
const stored = (webPath: string): [Uint8Array, { level: 0 }] => [
  readFileSync(publicPath(webPath)),
  { level: 0 },
];

function addIfExists(target: Record<string, Zippable[string]>, webPath: string) {
  if (existsSync(publicPath(webPath))) target[basename(webPath)] = stored(webPath);
}

function markdownToText(md: string) {
  return md
    .replace(/^##\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\[(.+?)\]\((.+?)\)/g, '$1 ($2)')
    .trim();
}

const STATUS_LABEL = { live: 'Out now', soon: 'Coming soon', dev: 'In development', archived: 'Archived' } as const;

function factsheet(game: CollectionEntry<'games'>, pageUrl: string) {
  const d = game.data;
  const trailer = d.youtubeShort
    ? `https://youtube.com/shorts/${d.youtubeId}`
    : `https://www.youtube.com/watch?v=${d.youtubeId}`;
  const links = d.storeLinksPreview && import.meta.env.PROD ? undefined : d.storeLinks;
  const stores = [
    links?.appStore && `App Store:      ${links.appStore}`,
    links?.playStore && `Google Play:    ${links.playStore}`,
  ].filter(Boolean);

  const lines = [
    `${d.title.toUpperCase()} — FACT SHEET`,
    '',
    `Developer:      ${STUDIO}`,
    `Release date:   ${d.releaseDate ? d.releaseDate.toISOString().slice(0, 10) : 'TBC'}`,
    d.status && `Status:         ${STATUS_LABEL[d.status]}`,
    d.platform && `Platforms:      ${d.platform}`,
    `Website:        ${pageUrl}`,
    `Trailer:        ${trailer}`,
    ...stores,
    `Discord:        ${DISCORD_URL}`,
    `YouTube:        ${YOUTUBE_URL}`,
    `Press contact:  ${PRESS_EMAIL}`,
    '',
    d.tagline,
    '',
    d.description,
    '',
    game.body ? markdownToText(game.body) : '',
    '',
  ];
  return lines.filter((l) => l !== undefined && l !== false).join('\n');
}

function readme(game: CollectionEntry<'games'>) {
  return [
    `${game.data.title} press kit — ${STUDIO}`,
    '',
    'Contents',
    '  factsheet.txt   Key facts, description and features',
    '  logos/          Game logo, app icon and studio logo',
    '  screenshots/    In-game screenshots at native device resolution',
    '',
    'Usage',
    `  You may use these assets in coverage of ${game.data.title}, including`,
    '  articles, reviews, videos and streams. Please do not alter the logos.',
    '',
    `Questions, review codes or interviews: ${PRESS_EMAIL}`,
    '',
  ].join('\n');
}

export const GET: APIRoute = ({ props, site }) => {
  const game = props.game as CollectionEntry<'games'>;
  const folder = `${game.id}-presskit`;
  const gameDir = `/games/${game.id}`;
  const pageUrl = new URL(`/games/${game.id}`, site).href;

  const logos: Record<string, Zippable[string]> = {};
  addIfExists(logos, `${gameDir}/logo-horizontal.svg`);
  addIfExists(logos, game.data.icon);
  addIfExists(logos, `${gameDir}/icon.png`);
  logos['digital-forloop-logo.svg'] = stored(STUDIO_LOGO);
  logos['digital-forloop-logo.png'] = stored(STUDIO_LOGO_PNG);
  logos['digital-forloop-logo-on-dark.png'] = stored(STUDIO_LOGO_PNG_DARK);

  const screenshots: Record<string, Zippable[string]> = {};
  game.data.screenshots.forEach((shot, i) => {
    screenshots[`${String(i + 1).padStart(2, '0')}-${basename(shot)}`] = stored(shot);
  });

  const zip = zipSync({
    [folder]: {
      'factsheet.txt': strToU8(factsheet(game, pageUrl)),
      'README.txt': strToU8(readme(game)),
      logos,
      screenshots,
    },
  });

  return new Response(zip, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${folder}.zip"`,
    },
  });
};
