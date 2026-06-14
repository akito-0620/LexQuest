import { prisma } from "./db";

export const DEFAULT_USER_ID = "default-user";

export async function getOrCreateDefaultUser() {
  return prisma.user.upsert({
    where: { id: DEFAULT_USER_ID },
    update: {},
    create: { id: DEFAULT_USER_ID, displayName: "旅人" },
  });
}
