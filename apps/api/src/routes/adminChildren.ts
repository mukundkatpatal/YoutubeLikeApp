import type { FastifyInstance } from "fastify";
import {
  childProfileCreateSchema,
  childProfileUpdateSchema
} from "../config/schemas.js";
import { ensureDefaultFamilyForParent } from "../services/configService.js";
import {
  createChildProfile,
  listChildProfiles,
  rotateChildAccessToken,
  updateChildProfile
} from "../services/childProfileService.js";

export async function registerAdminChildrenRoutes(app: FastifyInstance): Promise<void> {
  app.get("/admin/children", { preHandler: app.authenticateParent }, async (request) => {
    const familyId = await getParentFamilyId(app, request.parentUser!);
    return { items: await listChildProfiles(app.api.prisma, familyId) };
  });

  app.post("/admin/children", { preHandler: app.authenticateParent }, async (request, reply) => {
    const parsed = childProfileCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid child profile." });
    }

    const familyId = await getParentFamilyId(app, request.parentUser!);
    const child = await createChildProfile(app.api.prisma, familyId, parsed.data.displayName);
    return reply.code(201).send(child);
  });

  app.patch<{ Params: { childId: string } }>(
    "/admin/children/:childId",
    { preHandler: app.authenticateParent },
    async (request, reply) => {
      const parsed = childProfileUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid child profile update." });
      }

      const familyId = await getParentFamilyId(app, request.parentUser!);
      const child = await updateChildProfile(app.api.prisma, familyId, request.params.childId, parsed.data);
      if (!child) {
        return reply.code(404).send({ error: "Child profile was not found." });
      }

      return child;
    }
  );

  app.post<{ Params: { childId: string } }>(
    "/admin/children/:childId/rotate-token",
    { preHandler: app.authenticateParent },
    async (request, reply) => {
      const familyId = await getParentFamilyId(app, request.parentUser!);
      const child = await rotateChildAccessToken(app.api.prisma, familyId, request.params.childId);
      if (!child) {
        return reply.code(404).send({ error: "Child profile was not found." });
      }

      return child;
    }
  );
}

async function getParentFamilyId(
  app: FastifyInstance,
  parent: { id: string; email: string }
): Promise<string> {
  return ensureDefaultFamilyForParent(app.api.prisma, parent.id, parent.email);
}
