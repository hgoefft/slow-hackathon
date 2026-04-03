import { prisma } from "@/lib/db/prisma"

export const META_TOKEN_CONFIG_KEY = "meta_user_token"

// Read the current token — DB takes priority over env var
export async function getMetaToken(): Promise<string> {
  const config = await prisma.config.findUnique({
    where: { key: META_TOKEN_CONFIG_KEY },
  })
  return config?.value ?? process.env.META_USER_TOKEN ?? ""
}
