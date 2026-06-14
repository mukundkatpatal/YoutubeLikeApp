import type { FastifyInstance } from "fastify";
import { youtubeChannelIdSchema, youtubeSearchQuerySchema } from "../config/schemas.js";

export async function registerYouTubeAdminRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { q?: string } }>(
    "/admin/youtube/channels/search",
    { preHandler: app.authenticateParent },
    async (request, reply) => {
      const parsed = youtubeSearchQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid search query." });
      }

      try {
        return { items: await app.api.youtube.searchChannels(parsed.data.q) };
      } catch (error) {
        return reply.code(502).send({
          error: error instanceof Error ? error.message : "YouTube channel search failed."
        });
      }
    }
  );

  app.get<{ Params: { channelId: string }; Querystring: { maxResults?: string } }>(
    "/admin/youtube/channels/:channelId/videos",
    { preHandler: app.authenticateParent },
    async (request, reply) => {
      const channelId = youtubeChannelIdSchema.safeParse(request.params.channelId);
      if (!channelId.success) {
        return reply.code(400).send({ error: channelId.error.issues[0]?.message ?? "Invalid channel ID." });
      }

      const maxResults = request.query.maxResults ? Number.parseInt(request.query.maxResults, 10) : 25;
      try {
        return {
          items: await app.api.youtube.listChannelVideos(channelId.data, Number.isFinite(maxResults) ? maxResults : 25)
        };
      } catch (error) {
        return reply.code(502).send({
          error: error instanceof Error ? error.message : "YouTube video fetch failed."
        });
      }
    }
  );
}
