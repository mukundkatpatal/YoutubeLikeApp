import type { FastifyInstance } from "fastify";
import {
  buildConfigForFamily,
  ensureDefaultFamilyForParent,
  replaceFamilyConfig
} from "../services/configService.js";

export async function registerAdminConfigRoutes(app: FastifyInstance): Promise<void> {
  app.get("/admin/config", { preHandler: app.authenticateParent }, async (request) => {
    const parent = request.parentUser!;
    const familyId = await ensureDefaultFamilyForParent(app.api.prisma, parent.id, parent.email);
    return buildConfigForFamily(app.api.prisma, familyId);
  });

  app.put("/admin/config", { preHandler: app.authenticateParent }, async (request, reply) => {
    const parent = request.parentUser!;
    const familyId = await ensureDefaultFamilyForParent(app.api.prisma, parent.id, parent.email);
    try {
      return await replaceFamilyConfig(app.api.prisma, familyId, request.body);
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Invalid config."
      });
    }
  });
}
