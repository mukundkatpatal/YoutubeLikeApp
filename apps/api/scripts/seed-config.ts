import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createPrismaClient } from "../src/db/prisma.js";
import { appConfigSchema } from "../src/config/schemas.js";
import { replaceFamilyConfig } from "../src/services/configService.js";

const prisma = createPrismaClient();

async function main(): Promise<void> {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const configPath = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : path.resolve(scriptDir, "../../../config/config.github.json");
  const raw = await readFile(configPath, "utf8");
  const config = appConfigSchema.parse(JSON.parse(raw));

  const family = await prisma.family.upsert({
    where: { id: "default-family" },
    create: {
      id: "default-family",
      name: "Default family",
      refreshIntervalMinutes: config.refreshIntervalMinutes,
      maxVideosPerChannel: config.maxVideosPerChannel,
      configVersion: config.version,
      childProfiles: {
        create: {
          displayName: "Child",
          accessToken: "local-dev-child-access-token"
        }
      }
    },
    update: {
      name: "Default family"
    },
    select: { id: true }
  });

  await replaceFamilyConfig(prisma, family.id, config);
  console.log(`Seeded ${config.channels.length} channels into family ${family.id}.`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
