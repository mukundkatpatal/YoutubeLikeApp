import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  childAccessSchema,
  childVideosQuerySchema,
  youtubeChannelIdSchema
} from "../config/schemas.js";
import { buildConfigForFamily, findFamilyByChildAccessToken } from "../services/configService.js";
import { findEnabledChildByAccessToken } from "../services/childProfileService.js";
import { buildChildBootstrap, buildChildVideoPage } from "../services/childFeedService.js";

export async function registerKidsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { accessToken?: string } }>("/kids/config", async (request, reply) => {
    const token = getChildToken(request);
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

  app.get<{ Querystring: { accessToken?: string } }>("/kids/bootstrap", async (request, reply) => {
    const child = await authenticateChild(app, request, reply);
    if (!child) {
      return reply;
    }

    return buildChildBootstrap(app.api.prisma, app.api.env, app.api.youtube, child);
  });

  app.get<{
    Params: { channelId: string };
    Querystring: { accessToken?: string; limit?: string; cursor?: string };
  }>("/kids/channels/:channelId/videos", async (request, reply) => {
    const child = await authenticateChild(app, request, reply);
    if (!child) {
      return reply;
    }

    const channelId = youtubeChannelIdSchema.safeParse(request.params.channelId);
    if (!channelId.success) {
      return reply.code(400).send({ error: channelId.error.issues[0]?.message ?? "Invalid channel ID." });
    }

    const parsedQuery = childVideosQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      return reply.code(400).send({ error: parsedQuery.error.issues[0]?.message ?? "Invalid video query." });
    }

    const page = await buildChildVideoPage(app.api.prisma, app.api.youtube, child, channelId.data, parsedQuery.data);
    if (!page) {
      return reply.code(403).send({ error: "This channel is not approved for this child." });
    }

    return page;
  });

  app.get<{ Querystring: { currentVersion?: string } }>("/kids/app-version", async (request) => {
    const currentVersion = request.query.currentVersion?.trim() || "";
    return {
      latestVersion: app.api.env.KIDS_LATEST_VERSION,
      minimumSupportedVersion: app.api.env.KIDS_MINIMUM_SUPPORTED_VERSION,
      currentVersion: currentVersion || null,
      updateRequired: currentVersion
        ? compareVersions(currentVersion, app.api.env.KIDS_MINIMUM_SUPPORTED_VERSION) < 0
        : false
    };
  });
}

async function authenticateChild(
  app: FastifyInstance,
  request: FastifyRequest<{ Querystring: { accessToken?: string } }>,
  reply: FastifyReply
) {
  const token = getChildToken(request);
  const parsed = childAccessSchema.safeParse({ accessToken: token });
  if (!parsed.success) {
    reply.code(401).send({ error: "Child access token is required." });
    return null;
  }

  const child = await findEnabledChildByAccessToken(app.api.prisma, parsed.data.accessToken);
  if (!child) {
    reply.code(403).send({ error: "Child access token is not valid." });
    return null;
  }

  return child;
}

function getChildToken(request: { headers: Record<string, unknown>; query?: { accessToken?: string } }): string | undefined {
  return request.headers["x-child-access-token"]?.toString() ?? request.query?.accessToken;
}

function compareVersions(left: string, right: string): number {
  const leftParts = toVersionParts(left);
  const rightParts = toVersionParts(right);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

function toVersionParts(version: string): number[] {
  return version
    .split(/[.-]/)
    .map((part) => Number.parseInt(part, 10))
    .map((part) => Number.isFinite(part) ? part : 0);
}
