"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/db/prisma"
import { YoutubeTranscript } from "youtube-transcript"
import { supportsTranscript } from "@/lib/transcript-utils"
import { extractAttributes } from "@/lib/actions/attributes"

const SUPADATA_API_KEY = process.env.SUPADATA_API_KEY

async function fetchYouTubeTranscript(videoId: string): Promise<string> {
  const segments = await YoutubeTranscript.fetchTranscript(videoId)
  if (!segments || segments.length === 0) {
    throw new Error("No transcript available for this video")
  }
  return segments.map((s) => s.text).join(" ")
}

async function fetchSupadataTranscript(platform: string, url: string): Promise<string> {
  if (!SUPADATA_API_KEY) throw new Error("SUPADATA_API_KEY is not set")

  const endpoint =
    platform === "tiktok"
      ? `https://api.supadata.ai/v1/tiktok/transcript?url=${encodeURIComponent(url)}`
      : `https://api.supadata.ai/v1/youtube/transcript?url=${encodeURIComponent(url)}`

  const res = await fetch(endpoint, {
    headers: { "x-api-key": SUPADATA_API_KEY },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Supadata error ${res.status}: ${text}`)
  }

  const data = await res.json()
  // Supadata returns { content: string } or { transcript: string }
  const text = data.content ?? data.transcript
  if (typeof text !== "string" || text.length === 0) {
    throw new Error("Supadata returned no transcript content")
  }
  return text
}

export async function getTranscriptAction(postId: string): Promise<{
  success: boolean
  message: string
  transcript?: string
}> {
  const session = await auth()
  if (!session?.user?.id) return { success: false, message: "Not authenticated" }

  try {
    const post = await prisma.platformPost.findUnique({
      where: { id: postId },
      include: {
        contentPiece: { include: { attributes: true } },
      },
    })

    if (!post) return { success: false, message: "Post not found" }
    if (!supportsTranscript(post.platform)) {
      return { success: false, message: `Transcripts not supported for ${post.platform}` }
    }

    // Fetch transcript from the right source
    let transcript: string
    if (post.platform === "youtube") {
      transcript = await fetchYouTubeTranscript(post.externalId)
    } else {
      // tiktok or instagram via Supadata
      if (!post.url) return { success: false, message: "Post has no URL — can't fetch transcript" }
      transcript = await fetchSupadataTranscript(post.platform, post.url)
    }

    // Find or create a ContentPiece for this post
    let contentPieceId = post.contentPieceId
    if (!contentPieceId) {
      const contentType = post.platform === "youtube" ? "long_form_video" : "short_form_video"
      const piece = await prisma.contentPiece.create({
        data: {
          userId: session.user.id,
          title: post.caption?.slice(0, 100) ?? `${post.platform} post`,
          contentType,
        },
      })
      contentPieceId = piece.id
      await prisma.platformPost.update({
        where: { id: postId },
        data: { contentPieceId },
      })
    }

    // Upsert ContentAttribute with the transcript
    await prisma.contentAttribute.upsert({
      where: { contentPieceId },
      update: { transcript },
      create: { contentPieceId, transcript },
    })

    // Auto-extract content attributes from the transcript (fire-and-forget — don't block the response)
    extractAttributes(contentPieceId, transcript, {
      platform: post.platform,
      caption: post.caption,
    }).catch((err) => console.error("extractAttributes failed:", err))

    return { success: true, message: "Transcript saved", transcript }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("getTranscriptAction error:", message)
    return { success: false, message }
  }
}
