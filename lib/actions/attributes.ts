"use server"

import { anthropic } from "@ai-sdk/anthropic"
import { generateObject } from "ai"
import { z } from "zod"
import { prisma } from "@/lib/db/prisma"

const AttributeSchema = z.object({
  hookText: z
    .string()
    .describe("The exact hook — the first sentence or opening line of the content"),
  hookStyle: z
    .enum(["research_backed", "uncomfortable_truth", "personal_revelation", "high_stakes", "contrarian", "shocking_stat"])
    .describe("The rhetorical strategy used to open the content"),
  substanceType: z
    .enum(["framework", "debate", "hype_visibility", "narrative"])
    .describe("The structural type of content: framework = step-by-step or system, debate = argument or hot take, hype_visibility = trend-riding or broad appeal, narrative = story-driven"),
  editingStyle: z
    .enum(["edited", "raw", "talking_head", "b_roll"])
    .describe("The visual/production style inferred from the transcript — edited = fast cuts, raw = minimal editing, talking_head = direct to camera, b_roll = footage over narration"),
  energyLevel: z
    .enum(["high", "medium", "low"])
    .describe("Pacing and emotional intensity of the content"),
  engagementTriggers: z
    .array(z.string())
    .min(1)
    .max(4)
    .describe("2-4 specific elements likely to drive saves, shares, or comments — e.g. 'contrarian take on common advice', 'relatable workplace frustration'"),
  hasResource: z
    .boolean()
    .describe("Does the content offer a downloadable, linked, or reference resource?"),
  resourceType: z
    .string()
    .nullable()
    .describe("If hasResource is true: what type (e.g. 'resume template', 'checklist', 'free guide')"),
  hasCta: z
    .boolean()
    .describe("Does the content include a call to action?"),
  ctaType: z
    .string()
    .nullable()
    .describe("If hasCta is true: what the CTA asks for (e.g. 'follow', 'comment your answer', 'save this', 'link in bio')"),
})

export type ExtractedAttributes = z.infer<typeof AttributeSchema>

export async function extractAttributes(
  contentPieceId: string,
  transcript: string,
  context: { platform: string; caption?: string | null }
): Promise<{ success: boolean; message?: string }> {
  try {
    const { object } = await generateObject({
      model: anthropic("claude-haiku-4-5-20251001"),
      schema: AttributeSchema,
      prompt: `You are analyzing a piece of content by Hanna Goefft, a career content creator known for "Hanna Gets Hired." She creates content about job searching, career strategy, and workplace navigation — primarily short-form video.

PLATFORM: ${context.platform}
CAPTION: ${context.caption?.slice(0, 300) ?? "(none)"}
TRANSCRIPT:
${transcript.slice(0, 4000)}

Extract the content attributes below. Base your analysis on what the content actually says and how it opens — not assumptions about the platform.`,
    })

    await prisma.contentAttribute.upsert({
      where: { contentPieceId },
      update: {
        hookText: object.hookText,
        hookStyle: object.hookStyle,
        substanceType: object.substanceType,
        editingStyle: object.editingStyle,
        energyLevel: object.energyLevel,
        engagementTriggers: object.engagementTriggers,
        hasResource: object.hasResource,
        resourceType: object.resourceType,
        hasCta: object.hasCta,
        ctaType: object.ctaType,
        aiAnalysis: object as object,
      },
      create: {
        contentPieceId,
        hookText: object.hookText,
        hookStyle: object.hookStyle,
        substanceType: object.substanceType,
        editingStyle: object.editingStyle,
        energyLevel: object.energyLevel,
        engagementTriggers: object.engagementTriggers,
        hasResource: object.hasResource,
        resourceType: object.resourceType,
        hasCta: object.hasCta,
        ctaType: object.ctaType,
        aiAnalysis: object as object,
      },
    })

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("extractAttributes error:", message)
    return { success: false, message }
  }
}
