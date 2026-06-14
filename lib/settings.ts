import { prisma } from "@/lib/db";

const KEY_OPENAI = "openai_api_key";

export async function getApiKey(provider: "openai"): Promise<string | null> {
  const row = await prisma.appSettings.findUnique({ where: { key: KEY_OPENAI } });
  if (row?.value) return row.value;

  const envVal = process.env.OPENAI_API_KEY;
  if (envVal) return envVal;

  return null;
}

export async function setApiKey(value: string): Promise<void> {
  if (!value) {
    await prisma.appSettings.deleteMany({ where: { key: KEY_OPENAI } });
    return;
  }
  await prisma.appSettings.upsert({
    where: { key: KEY_OPENAI },
    create: { key: KEY_OPENAI, value },
    update: { value },
  });
}

export async function getApiKeyStatus(): Promise<{
  hasOpenAI: boolean;
  openaiPreview: string | null;
}> {
  const key = await getApiKey("openai");

  function preview(k: string | null): string | null {
    if (!k || k.length < 8) return null;
    return "..." + k.slice(-4);
  }

  return {
    hasOpenAI: !!key,
    openaiPreview: preview(key),
  };
}
