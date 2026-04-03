"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react"
import { auditIdea, updateIdeaStatus } from "@/lib/actions/ideas"
import type { ContentIdea } from "@prisma/client"
import { cn } from "@/lib/utils"

const STATUS_COLORS: Record<string, string> = {
  raw: "bg-muted text-muted-foreground",
  auditioning: "bg-yellow-100 text-yellow-800",
  greenlit: "bg-green-100 text-green-800",
  in_production: "bg-blue-100 text-blue-800",
  live: "bg-purple-100 text-purple-800",
  analyzed: "bg-gray-100 text-gray-600",
}

const VERDICT_COLORS: Record<string, string> = {
  pursue: "text-green-700",
  adapt: "text-yellow-700",
  pass: "text-red-700",
}

type AuditResult = {
  verdict: "pursue" | "adapt" | "pass"
  verdict_reason: string
  platform_fit: Array<{ platform: string; fit: string; reason: string }>
  hook_options: string[]
  format_guidance: string
  effort_vs_return: string
  evolution_check: string
  brand_alignment: string
  content_type: string
}

export function IdeaCard({ idea }: { idea: ContentIdea }) {
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const audit = idea.auditResult as AuditResult | null

  async function handleAudit() {
    setLoading(true)
    await auditIdea(idea.id)
    setLoading(false)
    setExpanded(true)
  }

  const contentTypeLabel: Record<string, string> = {
    short_form_video: "Short-form",
    long_form_video: "Long-form",
    written: "Written",
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm leading-snug">{idea.title}</p>
            {idea.concept && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{idea.concept}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {idea.contentType && (
              <Badge variant="outline" className="text-xs">
                {contentTypeLabel[idea.contentType] ?? idea.contentType}
              </Badge>
            )}
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLORS[idea.status])}>
              {idea.status.replace("_", " ")}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Audit result */}
        {audit && (
          <div className="mt-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className={cn("font-semibold", VERDICT_COLORS[audit.verdict])}>
                {audit.verdict.toUpperCase()}
              </span>
              <span>— {audit.verdict_reason.slice(0, 80)}{audit.verdict_reason.length > 80 ? "…" : ""}</span>
              {expanded ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
            </button>

            {expanded && (
              <div className="mt-3 flex flex-col gap-3 text-xs border-t pt-3">
                {/* Platform fit */}
                <div>
                  <p className="font-medium text-muted-foreground uppercase tracking-wide mb-1">Platform Fit</p>
                  <div className="flex flex-wrap gap-2">
                    {audit.platform_fit.map((p) => (
                      <div key={p.platform} className="flex items-center gap-1">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-xs font-medium",
                          p.fit === "strong" ? "bg-green-100 text-green-700" :
                          p.fit === "moderate" ? "bg-yellow-100 text-yellow-700" :
                          "bg-red-100 text-red-700"
                        )}>
                          {p.platform}
                        </span>
                        <span className="text-muted-foreground">{p.fit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hooks */}
                <div>
                  <p className="font-medium text-muted-foreground uppercase tracking-wide mb-1">Hook Options</p>
                  <ol className="list-decimal list-inside flex flex-col gap-1">
                    {audit.hook_options.map((h, i) => (
                      <li key={i} className="text-foreground">{h}</li>
                    ))}
                  </ol>
                </div>

                {/* Format + effort */}
                <div>
                  <p className="font-medium text-muted-foreground uppercase tracking-wide mb-1">Format Guidance</p>
                  <p>{audit.format_guidance}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground uppercase tracking-wide mb-1">Effort vs Return</p>
                  <p>{audit.effort_vs_return}</p>
                </div>

                {/* Evolution check */}
                <div>
                  <p className="font-medium text-muted-foreground uppercase tracking-wide mb-1">Evolution Check</p>
                  <p>{audit.evolution_check}</p>
                </div>

                {/* Brand alignment */}
                <div>
                  <p className="font-medium text-muted-foreground uppercase tracking-wide mb-1">Brand Alignment</p>
                  <p>{audit.brand_alignment}</p>
                </div>

                {/* Status updater */}
                <div className="flex gap-2 pt-1">
                  {["greenlit", "in_production", "live"].map((s) => (
                    <Button
                      key={s}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => updateIdeaStatus(idea.id, s)}
                    >
                      Mark {s.replace("_", " ")}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Audit button */}
        {!audit && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2 text-xs h-7"
            onClick={handleAudit}
            disabled={loading}
          >
            <Sparkles className={cn("h-3 w-3 mr-1", loading && "animate-pulse")} />
            {loading ? "Auditioning…" : "Audition This Idea"}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
