const BASE_URL = "https://app.metricool.com/api"
const TOKEN = process.env.METRICOOL_API_TOKEN!

// Hardcoded from profile — avoids an extra API call on every sync
const USER_ID = 4682845
const BLOG_ID = 6067141

function isoRange(days = 30) {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - days)
  const fromStr = from.toISOString().split("T")[0] + "T00:00:00"
  const toStr = to.toISOString().split("T")[0] + "T23:59:59"
  return {
    from: encodeURIComponent(fromStr),
    to: encodeURIComponent(toStr),
  }
}

async function fetchV2Posts(platform: string, days = 30): Promise<unknown[]> {
  const { from, to } = isoRange(days)
  const url = `${BASE_URL}/v2/analytics/posts/${platform}?from=${from}&to=${to}&blogId=${BLOG_ID}&userId=${USER_ID}&integrationSource=MCP`

  const res = await fetch(url, {
    headers: { "X-Mc-Auth": TOKEN },
    cache: "no-store",
  })

  if (!res.ok) {
    console.error(`Metricool ${platform} fetch failed: ${res.status}`)
    return []
  }

  const json = await res.json()
  // v2 response is { data: [...] }
  return Array.isArray(json) ? json : (json.data ?? [])
}

export async function fetchTikTokPosts() {
  return fetchV2Posts("tiktok")
}

export async function fetchInstagramPosts() {
  return fetchV2Posts("instagram")
}

export async function fetchLinkedInPosts() {
  return fetchV2Posts("linkedin")
}

// Normalize any platform post into our DB schema shape
export function normalizePost(platform: string, raw: Record<string, unknown>) {
  // TikTok field names differ from Instagram/LinkedIn
  const isTikTok = platform === "tiktok"

  const externalId = String(
    raw.videoId ?? raw.postId ?? raw.id ?? raw.mediaId ?? Date.now()
  )

  const caption = String(
    raw.videoDescription ?? raw.caption ?? raw.text ?? raw.content ?? ""
  ) || null

  // Instagram returns publishedAt as { dateTime: "...", timezone: "..." } — extract the string
  const rawDate = raw.createTime ?? raw.publishedAt ?? raw.created ?? new Date()
  const dateStr =
    rawDate && typeof rawDate === "object" && "dateTime" in rawDate
      ? String((rawDate as Record<string, unknown>).dateTime)
      : String(rawDate)
  const publishedAt = new Date(dateStr)

  return {
    platform,
    externalId,
    caption,
    publishedAt,
    url: (raw.shareUrl ?? raw.url ?? null) as string | null,
    thumbnailUrl: (raw.coverImageUrl ?? raw.thumbnailUrl ?? null) as string | null,
    views: (isTikTok ? raw.viewCount : raw.views ?? raw.viewCount) as number | null,
    likes: (isTikTok ? raw.likeCount : raw.likes ?? raw.likeCount) as number | null,
    comments: (isTikTok ? raw.commentCount : raw.comments ?? raw.commentCount) as number | null,
    shares: (isTikTok ? raw.shareCount : raw.shares ?? raw.shareCount) as number | null,
    saves: (raw.saves ?? raw.saveCount ?? null) as number | null,
    impressions: (raw.impressions ?? raw.impression ?? null) as number | null,
    reach: (raw.reach ?? null) as number | null,
    engagement: (raw.engagement ?? raw.engagementRate ?? null) as number | null,
    clicks: (raw.clicks ?? raw.click ?? null) as number | null,
    rawData: raw,
  }
}
