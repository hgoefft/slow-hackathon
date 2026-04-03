"use server"

import { google } from "googleapis"
import { auth } from "@/auth"
import { prisma } from "@/lib/db/prisma"

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!
const REDIRECT_URI = process.env.NEXTAUTH_URL
  ? `${process.env.NEXTAUTH_URL}/api/auth/gmail/callback`
  : "http://localhost:3000/api/auth/gmail/callback"

function getOAuthClient() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
}

export async function getGmailAuthUrl(): Promise<string> {
  const oauth2Client = getOAuthClient()
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/gmail.readonly"],
  })
}

export async function isGmailConnected(): Promise<boolean> {
  const session = await auth()
  if (!session?.user?.id) return false
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { gmailRefreshToken: true },
  })
  return !!user?.gmailRefreshToken
}

type FetchedEmail = {
  subject: string
  from: string
  date: string
  sentAt: Date
  body: string
}

function extractBody(payload: { mimeType?: string | null; body?: { data?: string | null } | null; parts?: typeof payload[] | null } | null | undefined): string {
  if (!payload) return ""
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8")
  }
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8")
  }
  if (payload.parts) {
    const htmlPart = payload.parts.find((p) => p?.mimeType === "text/html")
    if (htmlPart?.body?.data) return Buffer.from(htmlPart.body.data, "base64").toString("utf-8")
    const textPart = payload.parts.find((p) => p?.mimeType === "text/plain")
    if (textPart?.body?.data) return Buffer.from(textPart.body.data, "base64").toString("utf-8")
    for (const part of payload.parts) {
      if (!part) continue
      const text = extractBody(part)
      if (text) return text
    }
  }
  return ""
}

export async function fetchBriefingEmails(searchQuery: string, maxResults = 8): Promise<{
  success: boolean
  emails?: FetchedEmail[]
  message?: string
}> {
  const session = await auth()
  if (!session?.user?.id) return { success: false, message: "Not authenticated" }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { gmailRefreshToken: true },
  })

  if (!user?.gmailRefreshToken) return { success: false, message: "Gmail not connected" }

  const oauth2Client = getOAuthClient()
  oauth2Client.setCredentials({ refresh_token: user.gmailRefreshToken })
  const gmail = google.gmail({ version: "v1", auth: oauth2Client })

  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: searchQuery,
    maxResults,
  })

  const messages = listRes.data.messages
  if (!messages || messages.length === 0) {
    return { success: false, message: `No emails found for: "${searchQuery}"` }
  }

  const emails: FetchedEmail[] = []
  for (const msg of messages) {
    const msgRes = await gmail.users.messages.get({ userId: "me", id: msg.id!, format: "full" })
    const headers = msgRes.data.payload?.headers ?? []
    const subject = headers.find((h) => h.name === "Subject")?.value ?? "(no subject)"
    const from = headers.find((h) => h.name === "From")?.value ?? ""
    const date = headers.find((h) => h.name === "Date")?.value ?? ""
    const body = extractBody(msgRes.data.payload)
    emails.push({
      subject,
      from,
      date,
      sentAt: date ? new Date(date) : new Date(),
      body: body.slice(0, 15000),
    })
  }

  return { success: true, emails }
}
