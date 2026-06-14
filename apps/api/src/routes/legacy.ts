import type { FastifyInstance } from "fastify";
import { buildConfigForFamily, getFirstFamilyId } from "../services/configService.js";

export async function registerLegacyRoutes(app: FastifyInstance): Promise<void> {
  app.get("/legacy/config.json", async (_request, reply) => {
    const familyId = await getFirstFamilyId(app.api.prisma);
    if (!familyId) {
      return reply.code(404).send({
        version: 1,
        updatedAt: new Date().toISOString(),
        refreshIntervalMinutes: 60,
        maxVideosPerChannel: 100,
        channels: [],
        blockedVideoIds: [],
        pinnedVideoIds: []
      });
    }

    return buildConfigForFamily(app.api.prisma, familyId);
  });
}
