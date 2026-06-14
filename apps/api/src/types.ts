import type { PrismaClient } from "@prisma/client";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AppEnv } from "./config/env.js";
import type { YouTubeService } from "./services/youtubeService.js";

export type ApiContext = {
  env: AppEnv;
  prisma: PrismaClient;
  youtube: YouTubeService;
};

export type AuthenticatedParent = {
  id: string;
  email: string;
};

declare module "fastify" {
  interface FastifyInstance {
    api: ApiContext;
    authenticateParent: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    parentUser?: AuthenticatedParent;
  }
}
