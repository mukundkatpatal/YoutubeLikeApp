import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { loadEnv, type AppEnv } from "./config/env.js";
import { createPrismaClient } from "./db/prisma.js";
import { readSession } from "./auth/session.js";
import { GoogleYouTubeService, type YouTubeService } from "./services/youtubeService.js";
import { registerAdminChildrenRoutes } from "./routes/adminChildren.js";
import { registerAdminConfigRoutes } from "./routes/adminConfig.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerKidsRoutes } from "./routes/kids.js";
import { registerLegacyRoutes } from "./routes/legacy.js";
import { registerMeRoutes } from "./routes/me.js";
import { registerYouTubeAdminRoutes } from "./routes/youtubeAdmin.js";
import "./types.js";

export type BuildServerOptions = {
  env?: AppEnv;
  prisma?: PrismaClient;
  youtube?: YouTubeService;
};

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const env = options.env ?? loadEnv();
  const prisma = options.prisma ?? createPrismaClient();
  const youtube = options.youtube ?? new GoogleYouTubeService(env, prisma);
  const app = Fastify({ logger: env.NODE_ENV !== "test" });

  app.decorate("api", { env, prisma, youtube });
  await app.register(cors, {
    origin: [env.WEB_APP_ORIGIN, env.KIDS_WEB_APP_ORIGIN],
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "OPTIONS"]
  });
  await app.register(cookie, { secret: env.SESSION_SECRET });

  app.decorate("authenticateParent", async (request, reply) => {
    const session = readSession(request, env);
    if (!session) {
      return reply.code(401).send({ error: "Parent sign-in is required." });
    }

    const parent = await prisma.parentUser.findUnique({
      where: { id: session.parentUserId },
      select: { id: true, email: true }
    });
    if (!parent) {
      return reply.code(401).send({ error: "Parent session is no longer valid." });
    }

    request.parentUser = parent;
  });

  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await registerMeRoutes(app);
  await registerAdminChildrenRoutes(app);
  await registerAdminConfigRoutes(app);
  await registerYouTubeAdminRoutes(app);
  await registerKidsRoutes(app);
  await registerLegacyRoutes(app);

  return app;
}
