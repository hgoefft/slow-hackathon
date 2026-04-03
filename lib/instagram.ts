import { getMetaToken } from "@/lib/meta-token"

const BASE_URL = "https://graph.facebook.com/v19.0"
const IG_USER_ID = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID!

// Fields fetched per media object in one call
const MEDIA_FIELDS = [
  "id",
  "caption",
  "timestamp",
  "permalink",
  "media_url",
  "thumbnail_url",
  "media_type",
  "like_count",
  "comments_count",
].join(",")

// Insight metrics available for feed posts and reels
const INSIGHT_METRICS = "reach,saved,shares,views,total_interactions"

async function fetchJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { cache: "no-store" })
  const json = await res.json()
  if (!res.ok || json.error) {
    console.error("Instagram API error:", json.error ?? res.status)
    return null
  }
  return json as T
}

// Fetch recent media posts (up to `limit`, default 30)
async function fetchMedia(limit = 30): Promise<Record<string, unknown>[]> {
  const token = await getMetaToken()
  const url = `${BASE_URL}/${IG_USER_ID}/media?fields=${MEDIA_FIELDS}&limit=${limit}&access_token=${token}`
  const data = await fetchJson<{ data: Record<string, unknown>[] }>(url)
  return data?.data ?? []
}

// Fetch per-post insights (reach, saves, shares, views)
async function fetchPostInsights(
  mediaId: string
): Promise<Record<string, number>> {
  const token = await getMetaToken()
  const url = `${BASE_URL}/${mediaId}/insights?metric=${INSIGHT_METRICS}&access_token=${token}`
  const data = await fetchJson<{ data: { name: string; values: { value: number }[] }[] }>(url)
  if (!data?.data) return {}

  return Object.fromEntries(
    data.data.map((m) => [m.name, m.values?.[0]?.value ?? 0])
  )
}

// Fetch account-level insights for a date range
export async function fetchAccountInsights(
  period: "day" | "week" | "month" = "day",
  metric = "reach,follower_count,profile_views"
): Promise<Record<string, unknown>[]> {
  const token = await getMetaToken()
  const url = `${BASE_URL}/${IG_USER_ID}/insights?metric=${metric}&period=${period}&access_token=${token}`
  const data = await fetchJson<{ data: Record<string, unknown>[] }>(url)
  return data?.data ?? []
}

// Fetch account profile (followers, media count, etc.)
export async function fetchProfile(): Promise<Record<string, unknown> | null> {
  const token = await getMetaToken()
  const url = `${BASE_URL}/${IG_USER_ID}?fields=name,biography,followers_count,follows_count,media_count,profile_picture_url,website&access_token=${token}`
  return fetchJson(url)
}

// Fetch posts with insights attached — main export for syncing to DB
export async function fetchInstagramPosts(limit = 30): Promise<Record<string, unknown>[]> {
  const posts = await fetchMedia(limit)

  const postsWithInsights = await Promise.all(
    posts.map(async (post) => {
      const insights = await fetchPostInsights(String(post.id))
      return { ...post, ...insights }
    })
  )

  return postsWithInsights
}

// Normalize an Instagram post into our DB schema shape (matches metricool.ts normalizePost output)
export function normalizePost(raw: Record<string, unknown>) {
  const isVideo = raw.media_type === "VIDEO" || raw.media_type === "REELS"

  return {
    platform: "instagram",
    externalId: String(raw.id ?? ""),
    caption: (raw.caption as string | null) ?? null,
    publishedAt: new Date(String(raw.timestamp ?? new Date())),
    url: (raw.permalink as string | null) ?? null,
    thumbnailUrl: (
      (raw.thumbnail_url as string | null) ??
      (raw.media_url as string | null) ??
      null
    ),
    views: isVideo ? ((raw.views as number | null) ?? null) : null,
    likes: (raw.like_count as number | null) ?? null,
    comments: (raw.comments_count as number | null) ?? null,
    shares: (raw.shares as number | null) ?? null,
    saves: (raw.saved as number | null) ?? null,
    impressions: null, // deprecated by Meta — use views/reach
    reach: (raw.reach as number | null) ?? null,
    engagement: (raw.total_interactions as number | null) ?? null,
    clicks: null, // not available at post level
    rawData: raw,
  }
}
