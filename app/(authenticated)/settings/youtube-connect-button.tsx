"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { getYouTubeAuthUrl } from "@/lib/actions/youtube"

export function YoutubeConnectButton({ connected }: { connected: boolean }) {
  const [loading, setLoading] = useState(false)

  if (connected) return null

  async function handleConnect() {
    setLoading(true)
    const url = await getYouTubeAuthUrl()
    window.location.href = url
  }

  return (
    <Button size="sm" variant="outline" onClick={handleConnect} disabled={loading}>
      {loading ? "Redirecting..." : "Connect YouTube"}
    </Button>
  )
}
