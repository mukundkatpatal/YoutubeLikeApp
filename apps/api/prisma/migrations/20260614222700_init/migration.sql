-- CreateEnum
CREATE TYPE "ParentRole" AS ENUM ('OWNER', 'ADMIN');

-- CreateTable
CREATE TABLE "ParentUser" (
    "id" TEXT NOT NULL,
    "googleSubject" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "configVersion" INTEGER NOT NULL DEFAULT 1,
    "refreshIntervalMinutes" INTEGER NOT NULL DEFAULT 60,
    "maxVideosPerChannel" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyMember" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "parentUserId" TEXT NOT NULL,
    "role" "ParentRole" NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildProfile" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChildProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovedChannel" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovedChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockedVideo" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PinnedVideo" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PinnedVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YouTubeChannelCache" (
    "channelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "uploadsPlaylist" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YouTubeChannelCache_pkey" PRIMARY KEY ("channelId")
);

-- CreateTable
CREATE TABLE "YouTubeVideoCache" (
    "videoId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YouTubeVideoCache_pkey" PRIMARY KEY ("videoId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParentUser_googleSubject_key" ON "ParentUser"("googleSubject");

-- CreateIndex
CREATE UNIQUE INDEX "ParentUser_email_key" ON "ParentUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMember_familyId_parentUserId_key" ON "FamilyMember"("familyId", "parentUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ChildProfile_accessToken_key" ON "ChildProfile"("accessToken");

-- CreateIndex
CREATE INDEX "ApprovedChannel_familyId_enabled_idx" ON "ApprovedChannel"("familyId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovedChannel_familyId_channelId_key" ON "ApprovedChannel"("familyId", "channelId");

-- CreateIndex
CREATE UNIQUE INDEX "BlockedVideo_familyId_videoId_key" ON "BlockedVideo"("familyId", "videoId");

-- CreateIndex
CREATE UNIQUE INDEX "PinnedVideo_familyId_videoId_key" ON "PinnedVideo"("familyId", "videoId");

-- CreateIndex
CREATE INDEX "YouTubeVideoCache_channelId_publishedAt_idx" ON "YouTubeVideoCache"("channelId", "publishedAt");

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_parentUserId_fkey" FOREIGN KEY ("parentUserId") REFERENCES "ParentUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildProfile" ADD CONSTRAINT "ChildProfile_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovedChannel" ADD CONSTRAINT "ApprovedChannel_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockedVideo" ADD CONSTRAINT "BlockedVideo_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PinnedVideo" ADD CONSTRAINT "PinnedVideo_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YouTubeVideoCache" ADD CONSTRAINT "YouTubeVideoCache_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "YouTubeChannelCache"("channelId") ON DELETE CASCADE ON UPDATE CASCADE;
