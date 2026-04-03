"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { debugMetricool } from "@/lib/actions/debug"

export function DebugButton() {
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function run() {
    setLoading(true)
    const data = await debugMetricool()
    setResult(JSON.stringify(data, null, 2))
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-3">
      <Button variant="outline" size="sm" onClick={run} disabled={loading}>
        {loading ? "Testing…" : "Test Metricool API"}
      </Button>
      {result && (
        <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-96 whitespace-pre-wrap">
          {result}
        </pre>
      )}
    </div>
  )
}
