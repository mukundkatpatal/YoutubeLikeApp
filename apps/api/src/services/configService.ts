import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { AppConfig } from "../config/schemas.js";
import { appConfigSchema } from "../config/schemas.js";

type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export async function getFirstFamilyId(prisma: PrismaClient): Promise<string | null> {
  const family = await prisma.family.findFirst({ select: { id: true }, orderBy: { createdAt: "asc" } });
  return family?.id ?? null;
}

export async function ensureDefaultFamilyForParent(
  prisma: PrismaClient,
  parentUserId: string,
  parentEmail: string
): Promise<string> {
  const seededFamily = await prisma.family.findUnique({
    where: { id: "default-family" },
    select: { id: true }
  });
  if (seededFamily) {
    await prisma.familyMember.upsert({
      where: {
        familyId_parentUserId: {
          familyId: seededFamily.id,
          parentUserId
        }
      },
      create: {
        familyId: seededFamily.id,
        parentUserId,
        role: "OWNER"
      },
      update: {}
    });
    return seededFamily.id;
  }

  const existing = await prisma.familyMember.findFirst({
    where: { parentUserId },
    select: { familyId: true },
    orderBy: { createdAt: "asc" }
  });
  if (existing) {
    return existing.familyId;
  }

  const family = await prisma.family.create({
    data: {
      name: `${parentEmail}'s family`,
      members: {
        create: {
          parentUserId,
          role: "OWNER"
        }
      },
      childProfiles: {
        create: {
          displayName: "Child",
          accessToken: randomUUID()
        }
      }
    },
    select: { id: true }
  });

  return family.id;
}

export async function buildConfigForFamily(prisma: PrismaClient, familyId: string): Promise<AppConfig> {
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    include: {
      approvedChannels: { orderBy: [{ sortOrder: "asc" }, { title: "asc" }] },
      blockedVideos: { orderBy: { createdAt: "asc" } },
      pinnedVideos: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }
    }
  });

  if (!family) {
    throw new Error("Family was not found.");
  }

  return appConfigSchema.parse({
    version: family.configVersion,
    updatedAt: family.updatedAt.toISOString(),
    refreshIntervalMinutes: family.refreshIntervalMinutes,
    maxVideosPerChannel: family.maxVideosPerChannel,
    channels: family.approvedChannels.map((channel) => ({
      channelId: channel.channelId,
      title: channel.title,
      enabled: channel.enabled
    })),
    blockedVideoIds: family.blockedVideos.map((video) => video.videoId),
    pinnedVideoIds: family.pinnedVideos.map((video) => video.videoId)
  });
}

export async function replaceFamilyConfig(
  prisma: PrismaClient,
  familyId: string,
  input: unknown
): Promise<AppConfig> {
  const config = appConfigSchema.parse(input);

  await prisma.$transaction(async (tx: PrismaTransaction) => {
    await tx.family.update({
      where: { id: familyId },
      data: {
        configVersion: config.version,
        refreshIntervalMinutes: config.refreshIntervalMinutes,
        maxVideosPerChannel: config.maxVideosPerChannel
      }
    });
    await tx.approvedChannel.deleteMany({ where: { familyId } });
    await tx.blockedVideo.deleteMany({ where: { familyId } });
    await tx.pinnedVideo.deleteMany({ where: { familyId } });
    await tx.approvedChannel.createMany({
      data: config.channels.map((channel, index) => ({
        familyId,
        channelId: channel.channelId,
        title: channel.title,
        enabled: channel.enabled,
        sortOrder: index
      }))
    });
    await tx.blockedVideo.createMany({
      data: config.blockedVideoIds.map((videoId) => ({ familyId, videoId })),
      skipDuplicates: true
    });
    await tx.pinnedVideo.createMany({
      data: config.pinnedVideoIds.map((videoId, index) => ({ familyId, videoId, sortOrder: index })),
      skipDuplicates: true
    });
  });

  return buildConfigForFamily(prisma, familyId);
}

export async function findFamilyByChildAccessToken(
  prisma: PrismaClient,
  accessToken: string
): Promise<string | null> {
  const profile = await prisma.childProfile.findFirst({
    where: { accessToken, enabled: true },
    select: { familyId: true }
  });
  return profile?.familyId ?? null;
}
