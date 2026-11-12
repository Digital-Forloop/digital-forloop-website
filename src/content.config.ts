import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const games = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/games' }),
  schema: z.object({
    title: z.string(),
    tagline: z.string(),
    description: z.string(),
    icon: z.string(),
    hero: z.string(),
    youtubeId: z.string(),
    youtubeShort: z.boolean().optional(),
    screenshots: z.array(z.string()),
    storeLinks: z.object({
      appStore: z.string().url().optional(),
      playStore: z.string().url().optional(),
    }).optional(),
    releaseDate: z.date().optional(),
    status: z.enum(['live', 'soon', 'dev', 'archived']).optional(),
    platform: z.string().optional(),
    chips: z.array(z.string()).optional(),
  }),
});

export const collections = { games };