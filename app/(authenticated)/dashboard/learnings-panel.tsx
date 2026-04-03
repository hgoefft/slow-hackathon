"use client"

import { useState } from "react"
import { generateInsights, getInsightExamples, type InsightResult, type ExamplePost } from "@/lib/actions/learnings"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Sparkles, TrendingUp, TrendingDown, BookOpen, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, ExternalLink, Loader2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

type AllInsights = {
  aggregate: (InsightResult & { generatedAt: Date }) | null
  byPlatform: Record<string, InsightResult>
}

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  low: "bg-muted text-muted-foreground",
}

const PLATFORM_ORDER = ["tiktok", "instagram", "linkedin", "youtube"]
const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  youtube: "YouTube",
}

function fmt(n: number | null | undefined) {
  if (n == null) return "—"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function ExampleCard({ example }: { example: ExamplePost }) {
  const metric = example.platform === "linkedin" ? example.impressions : example.views
  const metricLabel = example.platform === "linkedin" ? "impressions" : "views"
  return (
    <div className="rounded-md border bg-muted/30 p-3 flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs leading-relaxed line-clamp-2 flex-1">{example.caption ?? `Post ${example.externalId.slice(0, 8)}`}</p>
        {example.url && (
          <a href={example.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground">
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{example.platform}</Badge>
        <span>{fmt(metric)} {metricLabel}</span>
        <span>{fmt(example.likes)} likes</span>
      </div>
      <p className="text-xs text-muted-foreground italic border-t pt-1.5 mt-0.5">{example.reason}</p>
    </div>
  )
}

function InsightItem({
  text,
  prefix,
  prefixClass,
}: {
  text: string
  prefix: string
  prefixClass: string
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [examples, setExamples] = useState<ExamplePost[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    if (open) { setOpen(false); return }
    setOpen(true)
    if (examples !== null) return
    setLoading(true)
    setError(null)
    const result = await getInsightExamples(text)
    if (result.success && result.examples) {
      setExamples(result.examples)
    } else {
      setError(result.message ?? "Couldn't find examples")
    }
    setLoading(false)
  }

  return (
    <li className="flex flex-col gap-1.5">
      <button
        onClick={handleClick}
        className="text-sm flex gap-2 text-left w-full group hover:opacity-80 transition-opacity"
      >
        <span className={`shrink-0 ${prefixClass}`}>{prefix}</span>
        <span className="flex-1">{text}</span>
        <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
          {open ? "▲ hide" : "▼ examples"}
        </span>
      </button>
      {open && (
        <div className="ml-4 flex flex-col gap-2">
          {loading && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Finding examples…
            </div>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
          {examples?.map((ex) => <ExampleCard key={ex.id} example={ex} />)}
          {examples?.length === 0 && <p className="text-xs text-muted-foreground">No specific examples found.</p>}
        </div>
      )}
    </li>
  )
}

function InsightContent({ insight }: { insight: InsightResult }) {
  return (
    <div className="flex flex-col gap-5 pt-4">
      <p className="text-sm text-muted-foreground leading-relaxed italic">{insight.summary}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="h-3.5 w-3.5 text-green-600" />
            <span className="text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">What&apos;s Working</span>
          </div>
          <ul className="flex flex-col gap-2">
            {insight.whats_working.map((item, i) => (
              <InsightItem key={i} text={item} prefix="↑" prefixClass="text-green-500" />
            ))}
          </ul>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingDown className="h-3.5 w-3.5 text-red-500" />
            <span className="text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">What&apos;s Not</span>
          </div>
          <ul className="flex flex-col gap-2">
            {insight.whats_not.map((item, i) => (
              <InsightItem key={i} text={item} prefix="↓" prefixClass="text-red-400" />
            ))}
          </ul>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">Double Down On</span>
          </div>
          <ul className="flex flex-col gap-2">
            {insight.topics_to_double_down.map((item, i) => (
              <InsightItem key={i} text={item} prefix="→" prefixClass="text-primary" />
            ))}
          </ul>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle className="h-3.5 w-3.5 text-yellow-600" />
            <span className="text-xs font-semibold uppercase tracking-wide text-yellow-700 dark:text-yellow-400">Watch Out For</span>
          </div>
          <ul className="flex flex-col gap-2">
            {insight.watch_out_for.map((item, i) => (
              <InsightItem key={i} text={item} prefix="⚠" prefixClass="text-yellow-500" />
            ))}
          </ul>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide mb-2 text-muted-foreground">Platform Rules</p>
        <div className="flex flex-col gap-2">
          {insight.rules.map((r, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="flex items-start gap-2">
                <Badge className={`text-xs shrink-0 mt-0.5 border-0 ${CONFIDENCE_COLORS[r.confidence]}`}>
                  {r.confidence}
                </Badge>
                <InsightItem text={r.rule} prefix="" prefixClass="" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function LearningsPanel({ initial }: { initial: AllInsights }) {
  const [allInsights, setAllInsights] = useState<AllInsights>(initial)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(!!initial.aggregate)
  const [activeTab, setActiveTab] = useState("aggregate")

  const hasData = !!allInsights.aggregate
  const availablePlatforms = PLATFORM_ORDER.filter((p) => allInsights.byPlatform[p])

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    const result = await generateInsights()
    if (result.success && result.allInsights) {
      setAllInsights(result.allInsights)
      setExpanded(true)
      setActiveTab("aggregate")
    } else {
      setError(result.message ?? "Something went wrong")
    }
    setLoading(false)
  }

  return (
    <div className="rounded-lg border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">AI Learnings</span>
          {allInsights.aggregate && (
            <span className="text-xs text-muted-foreground">
              · {formatDistanceToNow(new Date(allInsights.aggregate.generatedAt), { addSuffix: true })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasData && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
          <Button variant="outline" size="sm" onClick={handleGenerate} disabled={loading}>
            {loading ? (
              <><RefreshCw className="h-3 w-3 mr-1.5 animate-spin" />Analyzing…</>
            ) : hasData ? (
              <><RefreshCw className="h-3 w-3 mr-1.5" />Refresh</>
            ) : (
              <><Sparkles className="h-3 w-3 mr-1.5" />Generate</>
            )}
          </Button>
        </div>
      </div>

      {error && <div className="px-4 py-3 text-sm text-destructive border-b">{error}</div>}

      {!hasData && !loading && !error && (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          Click Generate to have Claude analyze your top vs. bottom performers and surface what&apos;s working.
        </div>
      )}

      {loading && !hasData && (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          Claude is reading your data… this takes ~10 seconds.
        </div>
      )}

      {hasData && expanded && (
        <div className="p-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList variant="line" className="w-full justify-start">
              <TabsTrigger value="aggregate">All Platforms</TabsTrigger>
              {availablePlatforms.map((p) => (
                <TabsTrigger key={p} value={p}>{PLATFORM_LABELS[p]}</TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="aggregate">
              {allInsights.aggregate && <InsightContent insight={allInsights.aggregate} />}
            </TabsContent>
            {availablePlatforms.map((p) => (
              <TabsContent key={p} value={p}>
                <InsightContent insight={allInsights.byPlatform[p]} />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      )}
    </div>
  )
}
