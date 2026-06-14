import { z } from "zod";

export const youtubeChannelIdSchema = z
  .string()
  .regex(/^UC[a-zA-Z0-9_-]{20,30}$/, "Use the canonical YouTube UC... channel ID.");

export const youtubeVideoIdSchema = z
  .string()
  .regex(/^[a-zA-Z0-9_-]{11}$/, "Use an 11-character YouTube video ID.");

export const channelConfigSchema = z.object({
  channelId: youtubeChannelIdSchema,
  title: z.string().trim().min(1),
  enabled: z.boolean().default(true)
});

export const appConfigSchema = z.object({
  version: z.number().int().positive().default(1),
  updatedAt: z.string().datetime(),
  refreshIntervalMinutes: z.number().int().min(15).max(24 * 60).default(60),
  maxVideosPerChannel: z.number().int().min(1).max(250).default(100),
  channels: z.array(channelConfigSchema).default([]),
  blockedVideoIds: z.array(youtubeVideoIdSchema).default([]),
  pinnedVideoIds: z.array(youtubeVideoIdSchema).default([])
});

export const youtubeSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(120)
});

export const childAccessSchema = z.object({
  accessToken: z.string().trim().min(16)
});

export type ChannelConfig = z.infer<typeof channelConfigSchema>;
export type AppConfig = z.infer<typeof appConfigSchema>;
