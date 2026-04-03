"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/db/prisma"
import { Prisma } from "@prisma/client"
import { fetchTikTokPosts, fetchLinkedInPosts, normalizePost } from "@/lib/metricool"
import { fetchInstagramPosts, normalizePost as normalizeInstagramPost } from "@/lib/instagram"
import { refreshMetaToken } from "@/lib/actions/meta-token"
import { fetchYouTubePosts } from "@/lib/actions/youtube"

export type PostWithTranscript = Prisma.PlatformPostGetPayload<{
  include: {
    contentPiece: {
      select: { id: true; attributes: { select: { transcript: true } } }
    }
  }
}>

export async function syncPlatformData(): Promise<{
  success: boolean
  message: string
  counts?: Record<string, number>
}> {
  const session = await auth()
  if (!session?.user?.id) return { success: false, message: "Not authenticated" }

  try {
    // Refresh Meta token on every sync — keeps it from ever expiring
    await refreshMetaToken()

    const [tiktokRaw, instagramRaw, linkedinRaw, youtubeRaw] = await Promise.all([
      fetchTikTokPosts(),
      fetchInstagramPosts(),
      fetchLinkedInPosts(),
      fetchYouTubePosts(session.user.id),
    ])

    const metricoolPosts = [
      ...tiktokRaw.map((p) => normalizePost("tiktok", p as Record<string, unknown>)),
      ...instagramRaw.map((p) => normalizeInstagramPost(p as Record<string, unknown>)),
      ...linkedinRaw.map((p) => normalizePost("linkedin", p as Record<string, unknown>)),
    ]

    let upsertCount = 0

    for (const post of metricoolPosts) {
      await prisma.platformPost.upsert({
        where: { platform_externalId: { platform: post.platform, externalId: post.externalId } },
        update: {
          views: post.views,
          likes: post.likes,
          comments: post.comments,
          shares: post.shares,
          saves: post.saves,
          impressions: post.impressions,
          reach: post.reach,
          engagement: post.engagement,
          clicks: post.clicks,
          caption: post.caption,
          url: post.url,
          thumbnailUrl: post.thumbnailUrl,
          rawData: post.rawData as object,
          syncedAt: new Date(),
        },
        create: {
          platform: post.platform,
          externalId: post.externalId,
          caption: post.caption,
          publishedAt: post.publishedAt,
          url: post.url,
          thumbnailUrl: post.thumbnailUrl,
          views: post.views,
          likes: post.likes,
          comments: post.comments,
          shares: post.shares,
          saves: post.saves,
          impressions: post.impressions,
          reach: post.reach,
          engagement: post.engagement,
          clicks: post.clicks,
          rawData: post.rawData as object,
        },
      })
      upsertCount++
    }

    for (const post of youtubeRaw) {
      await prisma.platformPost.upsert({
        where: { platform_externalId: { platform: post.platform, externalId: post.externalId } },
        update: {
          views: post.views,
          likes: post.likes,
          comments: post.comments,
          shares: post.shares,
          watchTime: post.watchTime,
          caption: post.caption,
          url: post.url,
          thumbnailUrl: post.thumbnailUrl,
          rawData: post.rawData,
          syncedAt: new Date(),
        },
        create: {
          platform: post.platform,
          externalId: post.externalId,
          caption: post.caption,
          publishedAt: post.publishedAt,
          url: post.url,
          thumbnailUrl: post.thumbnailUrl,
          views: post.views,
          likes: post.likes,
          comments: post.comments,
          shares: post.shares,
          watchTime: post.watchTime,
          rawData: post.rawData,
        },
      })
      upsertCount++
    }

    const counts: Record<string, number> = {
      tiktok: tiktokRaw.length,
      instagram: instagramRaw.length,
      linkedin: linkedinRaw.length,
      youtube: youtubeRaw.length,
      total: upsertCount,
    }

    return { success: true, message: `Synced ${upsertCount} posts`, counts }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("Sync error:", message)
    return { success: false, message }
  }
}

export async function getPerformanceData() {
  const session = await auth()
  if (!session?.user?.id) return null

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const posts = await prisma.platformPost.findMany({
    where: {
      // For YouTube, Analytics returns old videos still getting views — match by syncedAt.
      // For all other platforms, match by publishedAt.
      OR: [
        { platform: { not: "youtube" }, publishedAt: { gte: thirtyDaysAgo } },
        { platform: "youtube", syncedAt: { gte: thirtyDaysAgo } },
      ],
    },
    orderBy: { publishedAt: "desc" },
    include: {
      contentPiece: {
        select: {
          id: true,
          attributes: { select: { transcript: true } },
        },
      },
    },
  })

  const byPlatform: Record<string, typeof posts> = {}
  for (const post of posts) {
    if (!byPlatform[post.platform]) byPlatform[post.platform] = []
    byPlatform[post.platform].push(post)
  }

  return byPlatform
}
