"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { syncPlatformData } from "@/lib/actions/sync"
import { useRouter } from "next/navigation"

export function SyncButton() {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const router = useRouter()

  async function handleSync() {
    setLoading(true)
    setStatus(null)
    const result = await syncPlatformData()
    setLoading(false)
    if (result.success) {
      setStatus(result.message)
      router.refresh()
    } else {
      setStatus(`Error: ${result.message}`)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {status && (
        <p className="text-xs text-muted-foreground">{status}</p>
      )}
      <Button onClick={handleSync} disabled={loading} size="sm">
        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Syncing…" : "Sync Data"}
      </Button>
    </div>
  )
}
