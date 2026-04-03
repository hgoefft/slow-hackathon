"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getGmailAuthUrl } from "@/lib/actions/gmail"
import { fetchAndStoreBriefings, synthesizeAcrossBriefings, getBriefingContent, type CrossSynthesis } from "@/lib/actions/briefing"
import {
  Mail, CheckCircle, RefreshCw, Sparkles, TrendingUp, TrendingDown,
  Lightbulb, ArrowRight, Flame, Calendar, BookOpen, ChevronDown, ChevronUp,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"

type StoredBriefing = {
  id: string
  weekOf: Date
  subject: string | null
  fromEmail: string | null
  createdAt: Date
}

type Insight = CrossSynthesis & { generatedAt: Date; weekCount: number }

const EFFORT_COLORS = {
  low: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
}

const STATUS_COLORS = {
  recurring: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  emerging: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  fading: "bg-muted text-muted-foreground",
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  short_form_video: "Short-form",
  long_form_video: "YouTube",
  written: "Written",
}

export function BriefingClient({
  gmailConnected,
  storedBriefings: initialBriefings,
  latestInsight: initialInsight,
}: {
  gmailConnected: boolean
  storedBriefings: StoredBriefing[]
  latestInsight: Insight | null
}) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const gmailStatus = searchParams.get("gmail")

  const [connected, setConnected] = useState(gmailConnected)
  const [searchQuery, setSearchQuery] = useState("subject:weekly briefings")
  const [briefings, setBriefings] = useState<StoredBriefing[]>(initialBriefings)
  const [insight, setInsight] = useState<Insight | null>(initialInsight)

  useEffect(() => {
    setBriefings(initialBriefings)
  }, [initialBriefings])

  const [fetchLoading, setFetchLoading] = useState(false)
  const [synthLoading, setSynthLoading] = useState(false)
  const [gmailLoading, setGmailLoading] = useState(false)
  const [fetchMsg, setFetchMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [logExpanded, setLogExpanded] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedContent, setSelectedContent] = useState<{ subject: string | null; fromEmail: string | null; weekOf: Date; rawEmail: string | null } | null>(null)
  const [contentLoading, setContentLoading] = useState(false)

  useEffect(() => {
    if (gmailStatus === "connected") {
      setConnected(true)
      router.replace("/briefing")
    }
  }, [gmailStatus, router])

  async function handleConnectGmail() {
    setGmailLoading(true)
    const url = await getGmailAuthUrl()
    window.location.href = url
  }

  async function handleFetch() {
    setFetchLoading(true)
    setFetchMsg(null)
    setError(null)
    const result = await fetchAndStoreBriefings(searchQuery)
    setFetchLoading(false)
    if (result.success) {
      setFetchMsg(`Stored ${result.stored} briefing${result.stored !== 1 ? "s" : ""}${result.skipped ? `, ${result.skipped} already up to date` : ""}`)
      router.refresh()
    } else {
      setError(result.message ?? "Failed to fetch")
    }
  }

  async function handleSynthesize() {
    setSynthLoading(true)
    setError(null)
    const result = await synthesizeAcrossBriefings()
    setSynthLoading(false)
    if (result.success && result.synthesis) {
      setInsight(result.synthesis)
    } else {
      setError(result.message ?? "Something went wrong")
    }
  }

  async function handleSelectBriefing(id: string) {
    if (selectedId === id) return
    setSelectedId(id)
    setContentLoading(true)
    setSelectedContent(null)
    const content = await getBriefingContent(id)
    setSelectedContent(content)
    setContentLoading(false)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Gmail section */}
      <Card>
        <CardContent className="pt-4 flex flex-col gap-3">
          {!connected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                Connect Gmail to pull your briefing emails automatically
              </div>
              <Button variant="outline" size="sm" onClick={handleConnectGmail} disabled={gmailLoading}>
                {gmailLoading ? "Redirecting…" : "Connect Gmail"}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-green-700 dark:text-green-400 font-medium">Gmail connected</span>
                  {briefings.length > 0 && (
                    <span className="text-muted-foreground">· {briefings.length} briefing{briefings.length !== 1 ? "s" : ""} stored</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="text-sm h-8 w-56"
                  />
                  <Button variant="outline" size="sm" onClick={handleFetch} disabled={fetchLoading}>
                    {fetchLoading ? <><RefreshCw className="h-3 w-3 mr-1.5 animate-spin" />Fetching…</> : "Fetch Last 8 Weeks"}
                  </Button>
                </div>
              </div>
              {fetchMsg && <p className="text-xs text-green-700 dark:text-green-400">{fetchMsg}</p>}
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inline briefing browser */}
      {briefings.length > 0 && (
        <div className="rounded-lg border">
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
            onClick={() => {
              const opening = !logExpanded
              setLogExpanded(opening)
              if (opening && !selectedId && briefings.length > 0) handleSelectBriefing(briefings[0].id)
            }}
          >
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              Browse Briefings
              <span className="text-muted-foreground font-normal">({briefings.length})</span>
            </div>
            {logExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {logExpanded && (
            <div className="border-t flex h-[520px]">
              {/* Left: list */}
              <div className="w-64 shrink-0 border-r overflow-y-auto">
                {briefings.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => handleSelectBriefing(b.id)}
                    className={cn(
                      "w-full text-left px-4 py-3 border-b hover:bg-muted/50 transition-colors",
                      selectedId === b.id && "bg-muted"
                    )}
                  >
                    <p className="text-sm font-medium truncate">{b.subject ?? "(no subject)"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(b.weekOf).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{b.fromEmail}</p>
                  </button>
                ))}
              </div>

              {/* Right: content */}
              <div className="flex-1 flex flex-col min-h-0 min-w-0">
                {contentLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground p-5">
                    <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                )}
                {!contentLoading && selectedContent && (
                  <>
                    <div className="px-5 py-3 border-b shrink-0">
                      <h2 className="font-semibold text-sm">{selectedContent.subject ?? "(no subject)"}</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {selectedContent.fromEmail} · Week of {new Date(selectedContent.weekOf).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-4 prose prose-sm max-w-none dark:prose-invert [&_*]:break-words [&_a]:break-all">
                      <ReactMarkdown>{selectedContent.rawEmail ?? "No content available."}</ReactMarkdown>
                    </div>
                  </>
                )}
                {!contentLoading && !selectedContent && (
                  <p className="text-sm text-muted-foreground p-5">Select a briefing from the list.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Synthesize button */}
      {briefings.length >= 2 && (
        <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
          <div>
            <p className="text-sm font-medium">Cross-briefing analysis</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {insight
                ? `Last run ${formatDistanceToNow(new Date(insight.generatedAt), { addSuffix: true })} · ${insight.weekCount} weeks`
                : `Ready to analyze ${briefings.length} weeks`}
            </p>
          </div>
          <Button onClick={handleSynthesize} disabled={synthLoading} size="sm">
            {synthLoading
              ? <><Sparkles className="h-3 w-3 mr-1.5 animate-pulse" />Analyzing…</>
              : insight
              ? <><RefreshCw className="h-3 w-3 mr-1.5" />Refresh</>
              : <><Sparkles className="h-3 w-3 mr-1.5" />Synthesize</>}
          </Button>
        </div>
      )}

      {briefings.length < 2 && briefings.length > 0 && (
        <p className="text-sm text-muted-foreground text-center py-2">Fetch at least 2 weeks of briefings to run cross-analysis.</p>
      )}

      {briefings.length === 0 && connected && (
        <p className="text-sm text-muted-foreground text-center py-8">No briefings stored yet — hit "Fetch Last 8 Weeks" above.</p>
      )}

      {/* Synthesis output */}
      {insight && (
        <div className="flex flex-col gap-5">
          {/* Summary */}
          <p className="text-sm text-muted-foreground italic leading-relaxed">{insight.summary}</p>

          {/* Themes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Themes Across {insight.weekCount} Weeks
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {insight.themes.map((t, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Badge className={cn("text-xs shrink-0 border-0 mt-0.5", STATUS_COLORS[t.status])}>
                    {t.status}
                  </Badge>
                  <div>
                    <p className="text-sm font-medium">{t.theme}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.evidence}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Trends */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Flame className="h-4 w-4 text-orange-500" /> Directional Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2">
                  {insight.trends.map((t, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <ArrowRight className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" /> {t}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Insights */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500" /> Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2">
                  {insight.insights.map((t, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-yellow-500 shrink-0 mt-0.5">→</span> {t}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Heating up */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" /> Heating Up
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2">
                  {insight.topics_heating_up.map((t, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-green-500 shrink-0">↑</span> {t}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Cooling down */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-muted-foreground" /> Cooling Down
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2">
                  {insight.topics_cooling_down.map((t, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-muted-foreground shrink-0">↓</span> {t}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Content ideas */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Content Ideas — Built From Patterns
            </h3>
            <div className="flex flex-col gap-3">
              {insight.content_ideas.map((idea, i) => (
                <Card key={i}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <p className="font-medium text-sm">{idea.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{idea.angle}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant="outline" className="text-xs">
                          {CONTENT_TYPE_LABELS[idea.content_type] ?? idea.content_type}
                        </Badge>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", EFFORT_COLORS[idea.effort])}>
                          {idea.effort}
                        </span>
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-md p-3 mb-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Hook</p>
                      <p className="text-sm font-medium">&ldquo;{idea.hook}&rdquo;</p>
                    </div>
                    <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                      <p><span className="font-medium text-foreground">Why now:</span> {idea.why_now}</p>
                      {idea.repurpose_note && (
                        <p><span className="font-medium text-foreground">Repurpose:</span> {idea.repurpose_note}</p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {idea.platforms.map((p) => (
                          <Badge key={p} variant="secondary" className="text-xs capitalize">{p}</Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
