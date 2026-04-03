"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/db/prisma"
import { revalidatePath } from "next/cache"
import { generateObject } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { z } from "zod"
import * as fs from "fs"
import * as path from "path"
import { getAllLatestInsights } from "@/lib/actions/learnings"
import type { InsightResult } from "@/lib/actions/learnings"

// Load strategy context from Obsidian files
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
      // directory might not exist in production
    }
  }
  return chunks.join("\n\n---\n\n")
}

export async function createIdea(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Not authenticated")

  const title = formData.get("title") as string
  const concept = formData.get("concept") as string
  const contentType = formData.get("contentType") as string
  const effortLevel = formData.get("effortLevel") as string

  await prisma.contentIdea.create({
    data: {
      userId: session.user.id,
      title,
      concept,
      contentType: contentType || null,
      effortLevel: effortLevel || null,
      status: "raw",
    },
  })

  revalidatePath("/ideas")
}

export async function getIdeas() {
  const session = await auth()
  if (!session?.user?.id) return []

  return prisma.contentIdea.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  })
}

export async function auditIdea(ideaId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Not authenticated")

  const idea = await prisma.contentIdea.findUnique({ where: { id: ideaId } })
  if (!idea) throw new Error("Idea not found")

  // Update status to auditioning
  await prisma.contentIdea.update({
    where: { id: ideaId },
    data: { status: "auditioning" },
  })

  // Load strategy context
  const strategyContext = loadStrategyContext()

  // Pull synthesized insights (aggregate + per-platform)
  const { aggregate, byPlatform } = await getAllLatestInsights()

  function formatInsight(insight: InsightResult, label: string): string {
    return `### ${label}
What's working: ${insight.whats_working.join(" | ")}
What's not: ${insight.whats_not.join(" | ")}
Standing rules: ${insight.rules.map((r) => `${r.rule} (${r.confidence} confidence)`).join(" | ")}
Topics to double down: ${insight.topics_to_double_down.join(", ")}
Watch out for: ${insight.watch_out_for.join(" | ")}`
  }

  const insightSections: string[] = []
  if (aggregate) insightSections.push(formatInsight(aggregate, "Cross-Platform Learnings"))
  for (const [platform, insight] of Object.entries(byPlatform)) {
    insightSections.push(formatInsight(insight, `${platform.charAt(0).toUpperCase() + platform.slice(1)} Learnings`))
  }
  const insightContext = insightSections.length > 0
    ? insightSections.join("\n\n")
    : "No performance insights generated yet — run the AI Learnings refresh first."

  const AuditSchema = z.object({
    verdict: z.enum(["pursue", "adapt", "pass"]),
    verdict_reason: z.string(),
    platform_fit: z.array(z.object({
      platform: z.string(),
      fit: z.enum(["strong", "moderate", "weak"]),
      reason: z.string(),
    })),
    content_type: z.string(),
    hook_options: z.array(z.string()).min(2).max(3),
    format_guidance: z.string(),
    effort_vs_return: z.string(),
    evolution_check: z.string(),
    brand_alignment: z.string(),
  })

  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-6"),
    schema: AuditSchema,
    prompt: `You are Hanna's content strategy AI. Audit this content idea against her brand strategy, synthesized performance learnings, and platform fit.

CONTENT IDEA:
Title: ${idea.title}
Concept: ${idea.concept ?? "N/A"}
Intended type: ${idea.contentType ?? "Not specified"}
Effort level: ${idea.effortLevel ?? "Not specified"}

PERFORMANCE LEARNINGS (synthesized from last 30 days — apply these directly to evaluate this idea):
${insightContext}

HANNA'S BRAND STRATEGY:
${strategyContext || "See strategy files (not loaded in this environment)."}

Provide a rigorous audit:
- verdict: "pursue" if the idea is strong and aligns with what's working, "adapt" if the core is good but needs a different angle or platform, "pass" if it contradicts her patterns or doesn't serve her goals
- Be direct and honest — use the standing rules and learnings above as your primary filter, not just gut instinct
- evolution_check: Does this idea align with topics to double down on, or does it risk repeating what's underperforming?
- platform_fit: Assess TikTok, Instagram, LinkedIn, YouTube — only include platforms that make sense, and reference platform-specific learnings where relevant
- hook_options: Give 2-3 strong, specific hook options (first line/frame of the content) that align with hook styles that have worked for her`,
  })

  // Save the audit result
  await prisma.contentIdea.update({
    where: { id: ideaId },
    data: {
      status: "auditioning",
      auditResult: object as object,
      predictedTier: object.verdict === "pursue" ? "high" : object.verdict === "adapt" ? "medium" : "low",
    },
  })

  revalidatePath("/ideas")
  return object
}

export async function updateIdeaStatus(ideaId: string, status: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Not authenticated")

  await prisma.contentIdea.update({
    where: { id: ideaId },
    data: { status },
  })

  revalidatePath("/ideas")
}
