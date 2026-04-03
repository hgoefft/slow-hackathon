"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CheckCircle, Loader2, FileText } from "lucide-react"
import { getTranscriptAction } from "@/lib/actions/transcripts"

export function TranscriptButton({
  postId,
  initialHasTranscript,
}: {
  postId: string
  initialHasTranscript: boolean
}) {
  const [hasTranscript, setHasTranscript] = useState(initialHasTranscript)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    const result = await getTranscriptAction(postId)
    setLoading(false)
    if (result.success) {
      setHasTranscript(true)
    } else {
      setError(result.message)
    }
  }

  if (hasTranscript) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
        <CheckCircle className="h-3 w-3" />
        Done
      </span>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs"
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <>
            <FileText className="h-3 w-3 mr-1" />
            Get
          </>
        )}
      </Button>
      {error && <p className="text-[10px] text-destructive max-w-[80px] text-right leading-tight">{error}</p>}
    </div>
  )
}
