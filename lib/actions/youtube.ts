"use server"

import { google } from "googleapis"
import { auth } from "@/auth"
import { prisma } from "@/lib/db/prisma"

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!
const REDIRECT_URI = process.env.NEXTAUTH_URL
  ? `${process.env.NEXTAUTH_URL}/api/auth/youtube/callback`
  : "http://localhost:3000/api/auth/youtube/callback"

function getOAuthClient() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
}

export async function getYouTubeAuthUrl(): Promise<string> {
  const oauth2Client = getOAuthClient()
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/yt-analytics.readonly",
    ],
  })
}

export async function isYouTubeConnected(): Promise<boolean> {
  const session = await auth()
  if (!session?.user?.id) return false
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { youtubeRefreshToken: true },
  })
  return !!user?.youtubeRefreshToken
}

type YouTubePost = {
  platform: "youtube"
  externalId: string
  caption: string | null
  publishedAt: Date
  url: string
  thumbnailUrl: string | null
  views: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  watchTime: number | null
  rawData: object
}

export async function fetchYouTubePosts(userId: string): Promise<YouTubePost[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { youtubeRefreshToken: true },
  })
  if (!user?.youtubeRefreshToken) return []

  const oauth2Client = getOAuthClient()
  oauth2Client.setCredentials({ refresh_token: user.youtubeRefreshToken })

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const startDate = thirtyDaysAgo.toISOString().split("T")[0]
  const endDate = new Date().toISOString().split("T")[0]

  const youtubeAnalytics = google.youtubeAnalytics({ version: "v2", auth: oauth2Client })
  const analyticsRes = await youtubeAnalytics.reports.query({
    ids: "channel==MINE",
    startDate,
    endDate,
    metrics: "views,likes,comments,shares,estimatedMinutesWatched,averageViewDuration",
    dimensions: "video",
    maxResults: 50,
    sort: "-views",
  })

  const rows = analyticsRes.data.rows ?? []
  if (rows.length === 0) return []

  const videoIds = rows.map((r) => r[0] as string)

  const youtube = google.youtube({ version: "v3", auth: oauth2Client })
  const videosRes = await youtube.videos.list({
    part: ["snippet"],
    id: videoIds,
    maxResults: 50,
  })

  const videoMeta: Record<string, { title: string; publishedAt: string; thumbnail: string | null }> = {}
  for (const video of videosRes.data.items ?? []) {
    videoMeta[video.id!] = {
      title: video.snippet?.title ?? "(untitled)",
      publishedAt: video.snippet?.publishedAt ?? new Date().toISOString(),
      thumbnail:
        video.snippet?.thumbnails?.high?.url ??
        video.snippet?.thumbnails?.medium?.url ??
        video.snippet?.thumbnails?.default?.url ??
        null,
    }
  }

  return rows.map((row) => {
    const [videoId, views, likes, comments, shares, estimatedMinutes, avgDuration] = row as [
      string, number, number, number, number, number, number
    ]
    const meta = videoMeta[videoId] ?? {
      title: null,
      publishedAt: new Date().toISOString(),
      thumbnail: null,
    }
    return {
      platform: "youtube" as const,
      externalId: videoId,
      caption: meta.title,
      publishedAt: new Date(meta.publishedAt),
      url: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnailUrl: meta.thumbnail,
      views: views ?? null,
      likes: likes ?? null,
      comments: comments ?? null,
      shares: shares ?? null,
      watchTime: estimatedMinutes ? Math.round(estimatedMinutes * 60) : null,
      rawData: { videoId, views, likes, comments, shares, estimatedMinutes, avgDuration },
    }
  })
}
