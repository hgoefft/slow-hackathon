import { NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"
import { auth } from "@/auth"
import { prisma } from "@/lib/db/prisma"

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!
const REDIRECT_URI = process.env.NEXTAUTH_URL
  ? `${process.env.NEXTAUTH_URL}/api/auth/gmail/callback`
  : "http://localhost:3000/api/auth/gmail/callback"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  if (error || !code) {
    return NextResponse.redirect(new URL("/briefing?gmail=error", req.url))
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/sign-in", req.url))
  }

  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
  const { tokens } = await oauth2Client.getToken(code)

  if (!tokens.refresh_token) {
    return NextResponse.redirect(new URL("/briefing?gmail=no_refresh_token", req.url))
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { gmailRefreshToken: tokens.refresh_token },
  })

  return NextResponse.redirect(new URL("/briefing?gmail=connected", req.url))
}
