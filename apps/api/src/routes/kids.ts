import type { FastifyInstance } from "fastify";
import { childAccessSchema } from "../config/schemas.js";
import { buildConfigForFamily, findFamilyByChildAccessToken } from "../services/configService.js";

export async function registerKidsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { accessToken?: string } }>("/kids/config", async (request, reply) => {
    const token =
      request.headers["x-child-access-token"]?.toString() ??
      request.query.accessToken;
    const parsed = childAccessSchema.safeParse({ accessToken: token });
    if (!parsed.success) {
      return reply.code(401).send({ error: "Child access token is required." });
    }

    const familyId = await findFamilyByChildAccessToken(app.api.prisma, parsed.data.accessToken);
    if (!familyId) {
      return reply.code(403).send({ error: "Child access token is not valid." });
    }

    return buildConfigForFamily(app.api.prisma, familyId);
  });
}
