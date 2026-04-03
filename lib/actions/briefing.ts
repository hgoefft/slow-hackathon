"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/db/prisma"
import { generateObject } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { z } from "zod"
import * as fs from "fs"
import * as path from "path"
import { fetchBriefingEmails } from "@/lib/actions/gmail"

function loadStrategyContext(): string {
  const dirs = [
    "/Users/hannagoefft/Documents/Claude Code/Content",
    "/Users/hannagoefft/Documents/Claude Code/Brand-Standards",
  ]
  const chunks: string[] = []
  for (const dir of dirs) {
    try {
      const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"))
      for (const file of files) {
        const content = fs.readFileSync(path.join(dir, file), "utf-8")
        chunks.push(`### ${file}\n${content}`)
      }
    } catch {
      // skip if unavailable
    }
  }
  return chunks.join("\n\n---\n\n")
}

const CrossSynthesisSchema = z.object({
  summary: z.string().describe("2-3 sentence read on what's been happening across these briefings and where things are heading"),
  themes: z.array(z.object({
    theme: z.string(),
    status: z.enum(["recurring", "emerging", "fading"]),
    evidence: z.string().describe("Brief note on which weeks/emails this appeared in"),
  })).describe("Key themes surfacing across multiple briefings"),
  trends: z.array(z.string()).describe("Directional signals — things that are building, shifting, or accelerating"),
  insights: z.array(z.string()).describe("Observations and patterns that aren't obvious from any single week"),
  content_ideas: z.array(z.object({
    title: z.string(),
    hook: z.string(),
    angle: z.string(),
    content_type: z.enum(["short_form_video", "long_form_video", "written"]),
    platforms: z.array(z.string()),
    why_now: z.string(),
    effort: z.enum(["low", "medium", "high"]),
    repurpose_note: z.string().optional(),
  })).describe("4-10 content ideas that draw on patterns across multiple weeks, with recency bias"),
  topics_heating_up: z.array(z.string()).describe("Topics gaining momentum — appeared recently and repeatedly"),
  topics_cooling_down: z.array(z.string()).describe("Topics that were prominent earlier but have faded"),
})

export type CrossSynthesis = z.infer<typeof CrossSynthesisSchema>

export async function fetchAndStoreBriefings(searchQuery: string): Promise<{
  success: boolean
  stored: number
  skipped: number
  message?: string
}> {
  const session = await auth()
  if (!session?.user?.id) return { success: false, stored: 0, skipped: 0, message: "Not authenticated" }

  const result = await fetchBriefingEmails(searchQuery, 8)
  if (!result.success || !result.emails) {
    return { success: false, stored: 0, skipped: 0, message: result.message }
  }

  let stored = 0
  let skipped = 0

  for (const email of result.emails) {
    // Round to start of week to use as dedup key
    const weekOf = new Date(email.sentAt)
    weekOf.setHours(0, 0, 0, 0)
    weekOf.setDate(weekOf.getDate() - weekOf.getDay()) // Sunday

    try {
      await prisma.briefing.upsert({
        where: { userId_weekOf: { userId: session.user.id, weekOf } },
        update: {
          subject: email.subject,
          fromEmail: email.from,
          rawEmail: email.body,
        },
        create: {
          userId: session.user.id,
          weekOf,
          subject: email.subject,
          fromEmail: email.from,
          rawEmail: email.body,
        },
      })
      stored++
    } catch {
      skipped++
    }
  }

  return { success: true, stored, skipped }
}

export async function synthesizeAcrossBriefings(): Promise<{
  success: boolean
  synthesis?: CrossSynthesis & { generatedAt: Date; weekCount: number }
  message?: string
}> {
  const session = await auth()
  if (!session?.user?.id) return { success: false, message: "Not authenticated" }

  const twoMonthsAgo = new Date()
  twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 60)

  const briefings = await prisma.briefing.findMany({
    where: { userId: session.user.id, weekOf: { gte: twoMonthsAgo } },
    orderBy: { weekOf: "desc" },
    take: 8,
  })

  if (briefings.length < 2) {
    return { success: false, message: "Need at least 2 stored briefings — fetch your emails first" }
  }

  const strategyContext = loadStrategyContext()

  const emailSections = briefings.map((b, i) => {
    const weekLabel = b.weekOf.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    const recencyNote = i === 0 ? " [MOST RECENT]" : i === 1 ? " [LAST WEEK]" : ` [${i + 1} WEEKS AGO]`
    const plainText = (b.rawEmail ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    return `## Week of ${weekLabel}${recencyNote}
Subject: ${b.subject ?? "(no subject)"}
${plainText.slice(0, 8000)}`
  }).join("\n\n---\n\n")

  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-6"),
    schema: CrossSynthesisSchema,
    prompt: `You are Hanna's content strategy AI. Analyze ${briefings.length} weeks of her weekly briefing emails and identify patterns, trends, and content opportunities that span across time.

BRIEFING EMAILS (most recent first — give heavier weight to recent weeks):
${emailSections}

HANNA'S BRAND STRATEGY:
${strategyContext || "Career content creator — 'Hanna Gets Hired'. Helps ambitious professionals navigate job searching, career growth, and the workplace. Brand voice: The Interpreter — making sense of the system."}

Your job:
- Find what's been building across multiple weeks, not just what's in the latest email
- Give recency bias — recent topics should score higher than older ones
- Identify what's emerging vs. what's been consistent vs. what's fading
- Surface content ideas that could only come from seeing multiple weeks together
- Push into adjacent territory — don't just confirm the obvious topics
- Every content idea needs a specific hook, not a vague concept`,
  })

  const saved = await prisma.briefingInsight.create({
    data: {
      weekCount: briefings.length,
      analysis: object as object,
    },
  })

  return {
    success: true,
    synthesis: { ...object, generatedAt: saved.generatedAt, weekCount: briefings.length },
  }
}

export async function getStoredBriefings() {
  const session = await auth()
  if (!session?.user?.id) return []

  return prisma.briefing.findMany({
    where: { userId: session.user.id },
    orderBy: { weekOf: "desc" },
    take: 10,
    select: { id: true, weekOf: true, subject: true, fromEmail: true, createdAt: true },
  })
}

export async function getBriefingContent(id: string): Promise<{ subject: string | null; fromEmail: string | null; weekOf: Date; rawEmail: string | null } | null> {
  const session = await auth()
  if (!session?.user?.id) return null
  return prisma.briefing.findFirst({
    where: { id, userId: session.user.id },
    select: { subject: true, fromEmail: true, weekOf: true, rawEmail: true },
  })
}

export async function getLatestBriefingInsight(): Promise<(CrossSynthesis & { generatedAt: Date; weekCount: number }) | null> {
  const latest = await prisma.briefingInsight.findFirst({
    orderBy: { generatedAt: "desc" },
  })
  if (!latest) return null
  return {
    ...(latest.analysis as CrossSynthesis),
    generatedAt: latest.generatedAt,
    weekCount: latest.weekCount,
  }
}
