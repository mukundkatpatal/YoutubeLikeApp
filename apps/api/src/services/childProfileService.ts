import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export type ChildProfileSummary = {
  id: string;
  displayName: string;
  enabled: boolean;
  tokenPreview: string;
  createdAt: string;
  updatedAt: string;
};

export type ChildProfileWithToken = ChildProfileSummary & {
  accessToken: string;
};

export function generateChildAccessToken(): string {
  return `child_${randomBytes(32).toString("base64url")}`;
}

export async function listChildProfiles(
  prisma: PrismaClient,
  familyId: string
): Promise<ChildProfileSummary[]> {
  const profiles = await prisma.childProfile.findMany({
    where: { familyId },
    orderBy: [{ createdAt: "asc" }, { displayName: "asc" }]
  });

  return profiles.map(toSummary);
}

export async function createChildProfile(
  prisma: PrismaClient,
  familyId: string,
  displayName: string
): Promise<ChildProfileWithToken> {
  const profile = await createWithUniqueToken(prisma, familyId, displayName);
  return toWithToken(profile);
}

export async function updateChildProfile(
  prisma: PrismaClient,
  familyId: string,
  childId: string,
  input: { displayName?: string; enabled?: boolean }
): Promise<ChildProfileSummary | null> {
  const existing = await prisma.childProfile.findFirst({
    where: { id: childId, familyId },
    select: { id: true }
  });
  if (!existing) {
    return null;
  }

  const profile = await prisma.childProfile.update({
    where: { id: childId },
    data: input
  });

  return toSummary(profile);
}

export async function rotateChildAccessToken(
  prisma: PrismaClient,
  familyId: string,
  childId: string
): Promise<ChildProfileWithToken | null> {
  const existing = await prisma.childProfile.findFirst({
    where: { id: childId, familyId },
    select: { id: true }
  });
  if (!existing) {
    return null;
  }

  const profile = await updateWithUniqueToken(prisma, childId);
  return toWithToken(profile);
}

async function createWithUniqueToken(
  prisma: PrismaClient,
  familyId: string,
  displayName: string
) {
  return retryTokenCollision(() =>
    prisma.childProfile.create({
      data: {
        familyId,
        displayName,
        accessToken: generateChildAccessToken()
      }
    })
  );
}

async function updateWithUniqueToken(prisma: PrismaClient, childId: string) {
  return retryTokenCollision(() =>
    prisma.childProfile.update({
      where: { id: childId },
      data: {
        accessToken: generateChildAccessToken()
      }
    })
  );
}

async function retryTokenCollision<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
      lastError = error;
    }
  }

  throw lastError;
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: string }).code === "P2002";
}

function toSummary(profile: {
  id: string;
  displayName: string;
  enabled: boolean;
  accessToken: string;
  createdAt: Date;
  updatedAt: Date;
}): ChildProfileSummary {
  return {
    id: profile.id,
    displayName: profile.displayName,
    enabled: profile.enabled,
    tokenPreview: previewToken(profile.accessToken),
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString()
  };
}

function toWithToken(profile: Parameters<typeof toSummary>[0]): ChildProfileWithToken {
  return {
    ...toSummary(profile),
    accessToken: profile.accessToken
  };
}

function previewToken(token: string): string {
  return token.length <= 12 ? token : `${token.slice(0, 8)}...${token.slice(-4)}`;
}
