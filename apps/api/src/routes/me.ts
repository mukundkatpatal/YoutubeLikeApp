import type { FastifyInstance } from "fastify";
import { ensureDefaultFamilyForParent } from "../services/configService.js";

export async function registerMeRoutes(app: FastifyInstance): Promise<void> {
  app.get("/me", { preHandler: app.authenticateParent }, async (request) => {
    const parent = request.parentUser!;
    const familyId = await ensureDefaultFamilyForParent(app.api.prisma, parent.id, parent.email);
    return {
      parent,
      familyId
    };
  });
}
