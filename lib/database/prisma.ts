import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getServerEnvironment } from "@/lib/env/server";

const globalDatabase = globalThis as unknown as { prisma?: PrismaClient; pool?: Pool };

function createDatabaseClient() {
  const pool = new Pool({ connectionString: getServerEnvironment().DATABASE_URL, max: 5 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  if (process.env.NODE_ENV !== "production") globalDatabase.pool = pool;
  return prisma;
}

export const prisma = globalDatabase.prisma ?? createDatabaseClient();
if (process.env.NODE_ENV !== "production") globalDatabase.prisma = prisma;
