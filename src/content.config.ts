import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'zod';

/**
 * 글은 언어별 디렉터리로 나눈다: src/content/posts/{ko,en}/<slug>.mdx
 * id 가 "ko/tcp-recovery" 형태로 잡히므로 언어와 slug를 id에서 분해할 수 있다.
 * 번역이 없는 글은 해당 언어 목록에 그냥 나타나지 않는다 — 별도 처리 불필요.
 */
const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    category: z.enum(['retrospect', 'infra', 'guide', 'life']),
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts };
