"use server"

import { prisma } from "@/lib/db/prisma"
import { getMetaToken, META_TOKEN_CONFIG_KEY } from "@/lib/meta-token"

const APP_ID = process.env.META_APP_ID!
const APP_SECRET = process.env.META_APP_SECRET!

// Exchange the current token for a fresh long-lived token (60 more days)
// Safe to call repeatedly — Meta accepts early refreshes
export async function refreshMetaToken(): Promise<void> {
  const currentToken = await getMetaToken()
  if (!currentToken) {
    console.warn("Meta token refresh skipped: no token found")
    return
  }

  const url = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${currentToken}`

  const res = await fetch(url, { cache: "no-store" })
  const json = await res.json()

  if (!res.ok || json.error || !json.access_token) {
    console.error("Meta token refresh failed:", json.error ?? res.status)
    return
  }

  await prisma.config.upsert({
    where: { key: META_TOKEN_CONFIG_KEY },
    update: { value: json.access_token },
    create: { key: META_TOKEN_CONFIG_KEY, value: json.access_token },
  })

  console.log("Meta token refreshed successfully")
}
