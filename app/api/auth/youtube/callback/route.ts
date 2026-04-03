import { NextResponse } from "next/server"
import { google } from "googleapis"
import { auth } from "@/auth"
import { prisma } from "@/lib/db/prisma"

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!
const REDIRECT_URI = process.env.NEXTAUTH_URL
  ? `${process.env.NEXTAUTH_URL}/api/auth/youtube/callback`
  : "http://localhost:3000/api/auth/youtube/callback"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")

  if (!code) {
    return NextResponse.redirect(new URL("/settings?youtube=error", request.url))
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/sign-in", request.url))
  }

  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
  const { tokens } = await oauth2Client.getToken(code)

  if (!tokens.refresh_token) {
    // This happens if the user already granted access and Google didn't re-issue a refresh token.
    // Redirect with an error so they know to revoke and reconnect.
    return NextResponse.redirect(new URL("/settings?youtube=no_refresh_token", request.url))
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { youtubeRefreshToken: tokens.refresh_token },
  })

  return NextResponse.redirect(new URL("/settings?youtube=connected", request.url))
}
