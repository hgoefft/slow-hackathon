"use server"

import { anthropic } from "@ai-sdk/anthropic"
import { generateObject } from "ai"
import { z } from "zod"
import { prisma } from "@/lib/db/prisma"
import { auth } from "@/auth"
import type { PlatformPost } from "@prisma/client"

type PostAttributes = {
  transcript: string | null
  hookStyle: string | null
  substanceType: string | null
  editingStyle: string | null
  energyLevel: string | null
  engagementTriggers: string[]
} | null

type PostWithAttributes = Pick<PlatformPost, "id" | "caption" | "views" | "impressions" | "likes" | "saves" | "comments"> & {
  contentPiece?: { attributes: PostAttributes } | null
}

export type ExamplePost = Pick<PlatformPost, "id" | "platform" | "externalId" | "caption" | "url" | "thumbnailUrl" | "views" | "impressions" | "likes"> & { reason: string }

const InsightSchema = z.object({
  summary: z.string().describe("2-3 sentences: the single clearest thing the data is saying right now, framed as a strategic read not a recap"),
  whats_working: z.array(z.string()).describe("3-4 transferable content principles driving performance — each one a crisp, generalizable rule (e.g. 'Tactical how-to content outperforms motivational content'), not a reference to a specific post"),
  whats_not: z.array(z.string()).describe("2-3 patterns or content types that are underperforming — stated as a generalizable principle, not tied to a specific post"),
  rules: z.array(
    z.object({
      rule: z.string().describe("One sentence, written as a standing guideline she can apply to any new content idea"),
      confidence: z.enum(["high", "medium", "low"]),
    })
  ).describe("3-4 standing content rules derived from patterns in the data — things she can apply before creating, not after analyzing"),
  topics_to_double_down: z.array(z.string()).describe("2-3 topic territories or angles worth exploring more — broad enough to generate multiple content ideas from"),
  watch_out_for: z.array(z.string()).describe("1-2 content traps or tendencies to avoid — stated as a pattern, not a specific post critique"),
})

export type InsightResult = z.infer<typeof InsightSchema>

function buildPlatformSection(platform: string, platformPosts: PostWithAttributes[]): string {
  const sorted = [...platformPosts].sort((a, b) =>
    (platform === "linkedin" ? (b.impressions ?? 0) : (b.views ?? 0)) -
    (platform === "linkedin" ? (a.impressions ?? 0) : (a.views ?? 0))
  )
  const top5 = sorted.slice(0, 5)
  const bottom5 = sorted.slice(-5).reverse()

  const formatPost = (p: PostWithAttributes) => {
    const metric = platform === "linkedin" ? p.impressions : p.views
    const metricLabel = platform === "linkedin" ? "impressions" : "views"
    const caption = p.caption?.slice(0, 120) ?? "(no caption)"
    const lines: string[] = [
      `  - [id:${p.id}] "${caption}" | ${metric ?? 0} ${metricLabel}, ${p.likes ?? 0} likes, ${p.saves ?? 0} saves, ${p.comments ?? 0} comments`
    ]
    const attrs = p.contentPiece?.attributes
    if (attrs) {
      const attrParts = [
        attrs.hookStyle && `Hook: ${attrs.hookStyle}`,
        attrs.substanceType && `Substance: ${attrs.substanceType}`,
        attrs.editingStyle && `Editing: ${attrs.editingStyle}`,
        attrs.energyLevel && `Energy: ${attrs.energyLevel}`,
      ].filter(Boolean)
      if (attrParts.length > 0) lines.push(`    ${attrParts.join(" | ")}`)
      if (attrs.transcript) lines.push(`    Transcript: "${attrs.transcript.slice(0, 300)}…"`)
    }
    return lines.join("\n")
  }

  return `## ${platform.toUpperCase()} (${platformPosts.length} posts)
TOP PERFORMERS:
${top5.map(formatPost).join("\n")}
LOWEST PERFORMERS:
${bottom5.map(formatPost).join("\n")}`
}

function buildInsightPrompt(platformContext: string, platformLabel: string): string {
  return `You are analyzing 30-day content performance data for Hanna Goefft, a career content creator behind "Hanna Gets Hired." She creates content about job searching, career growth, and the workplace — primarily short-form video on TikTok and Instagram, plus LinkedIn posts.

${platformLabel}

Here is the performance data:

${platformContext}

Your job is to extract transferable strategic principles from this data — not to analyze individual posts. Use the captions, metrics, and (where available) extracted content attributes and transcript excerpts to identify underlying patterns, then state those patterns as high-level, reusable guidance she can apply to future content she hasn't made yet.

Where posts include extracted attributes (hook style, substance type, editing style, energy level) and transcript excerpts, use those signals to identify patterns beyond what captions alone reveal — e.g., whether raw vs. edited content performs differently, or whether framework-style substance outperforms narrative.

Think like a content strategist distilling signal from noise:
- What types of content, angles, or formats consistently outperform? State the principle, not the example.
- What's dragging performance down as a pattern?
- What standing rules should guide her content decisions going forward?
- What topic territories have the most signal worth exploring further?

Do NOT reference specific captions or post details. Every insight should be abstract enough to apply to a new piece of content she hasn't written yet.`
}

export async function generateInsights(): Promise<{
  success: boolean
  allInsights?: {
    aggregate: InsightResult & { generatedAt: Date }
    byPlatform: Record<string, InsightResult>
  }
  message?: string
}> {
  const session = await auth()
  if (!session?.user?.id) return { success: false, message: "Not authenticated" }

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const posts = await prisma.platformPost.findMany({
    where: { publishedAt: { gte: thirtyDaysAgo } },
    orderBy: { publishedAt: "desc" },
    include: {
      contentPiece: {
        select: {
          attributes: {
            select: {
              transcript: true,
              hookStyle: true,
              substanceType: true,
              editingStyle: true,
              energyLevel: true,
              engagementTriggers: true,
            }
          }
        }
      }
    }
  })

  if (posts.length < 3) {
    return { success: false, message: "Not enough data — sync more posts first" }
  }

  // Group by platform
  const byPlatform: Record<string, PostWithAttributes[]> = {}
  for (const post of posts) {
    if (!byPlatform[post.platform]) byPlatform[post.platform] = []
    byPlatform[post.platform].push(post)
  }

  try {
    // Generate aggregate insight (all platforms combined)
    const allSections = Object.entries(byPlatform).map(([platform, platformPosts]) =>
      buildPlatformSection(platform, platformPosts)
    )

    const { object: aggregateObject } = await generateObject({
      model: anthropic("claude-sonnet-4-6"),
      schema: InsightSchema,
      prompt: buildInsightPrompt(
        allSections.join("\n\n"),
        "This is a CROSS-PLATFORM analysis. Identify patterns that hold across platforms as well as platform-specific signals worth noting."
      ),
    })

    const saved = await prisma.performanceInsight.create({
      data: { periodDays: 30, platform: null, analysis: aggregateObject as object },
    })

    // Generate per-platform insights in parallel (only for platforms with enough data)
    const platformEntries = Object.entries(byPlatform).filter(([, platformPosts]) => platformPosts.length >= 3)

    const platformResults = await Promise.all(
      platformEntries.map(async ([platform, platformPosts]) => {
        const section = buildPlatformSection(platform, platformPosts)
        const { object } = await generateObject({
          model: anthropic("claude-haiku-4-5-20251001"),
          schema: InsightSchema,
          prompt: buildInsightPrompt(
            section,
            `This is a ${platform.toUpperCase()}-ONLY analysis. Extract principles specific to what works and fails on this platform.`
          ),
        })
        await prisma.performanceInsight.create({
          data: { periodDays: 30, platform, analysis: object as object },
        })
        return { platform, object }
      })
    )

    const byPlatformResults: Record<string, InsightResult> = {}
    for (const { platform, object } of platformResults) {
      byPlatformResults[platform] = object
    }

    return {
      success: true,
      allInsights: {
        aggregate: { ...aggregateObject, generatedAt: saved.generatedAt },
        byPlatform: byPlatformResults,
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("Learnings generation error:", message)
    return { success: false, message }
  }
}

const ExamplesSchema = z.object({
  examples: z.array(z.object({
    postId: z.string().describe("The exact ID from the [id:...] tag in the data"),
    reason: z.string().describe("One sentence explaining why this post illustrates the principle"),
  })).describe("2-3 examples maximum"),
})

export async function getInsightExamples(insightText: string): Promise<{
  success: boolean
  examples?: ExamplePost[]
  message?: string
}> {
  const session = await auth()
  if (!session?.user?.id) return { success: false, message: "Not authenticated" }

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const posts = await prisma.platformPost.findMany({
    where: { publishedAt: { gte: thirtyDaysAgo } },
    orderBy: { publishedAt: "desc" },
  })

  if (posts.length === 0) return { success: false, message: "No posts found" }

  const byPlatform: Record<string, typeof posts> = {}
  for (const post of posts) {
    if (!byPlatform[post.platform]) byPlatform[post.platform] = []
    byPlatform[post.platform].push(post)
  }

  const sections: string[] = []
  for (const [platform, platformPosts] of Object.entries(byPlatform)) {
    const lines = platformPosts.map((p) => {
      const metric = platform === "linkedin" ? p.impressions : p.views
      const metricLabel = platform === "linkedin" ? "impressions" : "views"
      const caption = p.caption?.slice(0, 120) ?? "(no caption)"
      return `  - [id:${p.id}] "${caption}" | ${metric ?? 0} ${metricLabel}, ${p.likes ?? 0} likes`
    })
    sections.push(`## ${platform.toUpperCase()}\n${lines.join("\n")}`)
  }

  try {
    const { object } = await generateObject({
      model: anthropic("claude-haiku-4-5-20251001"),
      schema: ExamplesSchema,
      prompt: `Given this content principle: "${insightText}"

Here is recent content performance data. Each post has an ID in [id:...] format:

${sections.join("\n\n")}

Identify 2-3 posts that best illustrate this principle — posts where you can clearly see this pattern at work. Return their exact IDs and a one-sentence explanation of why each fits.`,
    })

    const postIds = object.examples.map((e) => e.postId)
    const matchedPosts = await prisma.platformPost.findMany({
      where: { id: { in: postIds } },
      select: { id: true, platform: true, externalId: true, caption: true, url: true, thumbnailUrl: true, views: true, impressions: true, likes: true },
    })

    const postMap = new Map(matchedPosts.map((p) => [p.id, p]))
    const examples: ExamplePost[] = object.examples
      .filter((e) => postMap.has(e.postId))
      .map((e) => ({ ...postMap.get(e.postId)!, reason: e.reason }))

    return { success: true, examples }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, message }
  }
}

export async function getLatestInsight(): Promise<(InsightResult & { generatedAt: Date }) | null> {
  const latest = await prisma.performanceInsight.findFirst({
    where: { platform: null },
    orderBy: { generatedAt: "desc" },
  })
  if (!latest) return null
  return {
    ...(latest.analysis as InsightResult),
    generatedAt: latest.generatedAt,
  }
}

export async function getLatestInsightForPlatform(platform: string): Promise<InsightResult | null> {
  const latest = await prisma.performanceInsight.findFirst({
    where: { platform },
    orderBy: { generatedAt: "desc" },
  })
  if (!latest) return null
  return latest.analysis as InsightResult
}

export async function getAllLatestInsights(): Promise<{
  aggregate: (InsightResult & { generatedAt: Date }) | null
  byPlatform: Record<string, InsightResult>
}> {
  const all = await prisma.performanceInsight.findMany({
    orderBy: { generatedAt: "desc" },
  })

  // For each platform (including null=aggregate), take the most recent
  const seen = new Set<string | null>()
  const byPlatform: Record<string, InsightResult> = {}
  let aggregateResult: (InsightResult & { generatedAt: Date }) | null = null

  for (const row of all) {
    const key = row.platform ?? "__aggregate__"
    if (seen.has(key)) continue
    seen.add(key)

    if (row.platform === null) {
      aggregateResult = { ...(row.analysis as InsightResult), generatedAt: row.generatedAt }
    } else {
      byPlatform[row.platform] = row.analysis as InsightResult
    }
  }

  return { aggregate: aggregateResult, byPlatform }
}
