import { getPerformanceData } from "@/lib/actions/sync"
import { getAllLatestInsights } from "@/lib/actions/learnings"
import { SyncButton } from "./sync-button"
import { PlatformTable } from "./platform-table"
import { WinnerCard } from "./winner-card"
import { LearningsPanel } from "./learnings-panel"
import { RefreshCw, TrendingUp, Eye, Heart, FileText } from "lucide-react"

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  youtube: "YouTube",
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export default async function DashboardPage() {
  const [data, allInsights] = await Promise.all([
    getPerformanceData(),
    getAllLatestInsights(),
  ])
  const platforms = data ? Object.keys(data) : []

  // Aggregate snapshot stats
  let totalPosts = 0
  let totalViews = 0
  let totalLikes = 0
  let totalComments = 0

  if (data) {
    for (const [platform, posts] of Object.entries(data)) {
      totalPosts += posts.length
      for (const post of posts) {
        totalViews += platform === "linkedin" ? (post.impressions ?? 0) : (post.views ?? 0)
        totalLikes += post.likes ?? 0
        totalComments += post.comments ?? 0
      }
    }
  }

  const snapshotStats = [
    { label: "Total Posts", value: fmt(totalPosts), icon: FileText },
    { label: "Total Views", value: fmt(totalViews), icon: Eye },
    { label: "Total Likes", value: fmt(totalLikes), icon: Heart },
    { label: "Comments", value: fmt(totalComments), icon: TrendingUp },
  ]

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Performance</h1>
          <p className="text-muted-foreground text-sm mt-1">Last 30 days · data is 48–72h behind live</p>
        </div>
        <SyncButton />
      </div>

      {/* Empty state */}
      {!data || platforms.length === 0 ? (
        <div className="border border-dashed rounded-lg p-16 text-center">
          <RefreshCw className="h-8 w-8 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium mb-2">No data yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Click "Sync Data" to pull your TikTok, Instagram, and LinkedIn posts from Metricool.
          </p>
          <p className="text-xs text-muted-foreground">
            Note: Metricool data is 48–72 hours behind live platform stats.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {/* Snapshot stats bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {snapshotStats.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-lg border bg-card p-4 flex items-start gap-3">
                <div className="rounded-md bg-muted p-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* AI Learnings panel */}
          <LearningsPanel initial={allInsights} />

          {/* Per-platform sections */}
          {platforms.map((platform) => {
            const posts = data[platform]
            const sorted = [...posts].sort(
              (a, b) =>
                (platform === "linkedin" ? (b.impressions ?? 0) : (b.views ?? 0)) -
                (platform === "linkedin" ? (a.impressions ?? 0) : (a.views ?? 0))
            )
            const top3 = sorted.slice(0, 3)
            const top10 = sorted.slice(0, 10)
            const bottom10 = [...posts]
              .sort(
                (a, b) =>
                  (platform === "linkedin" ? (a.impressions ?? 0) : (a.views ?? 0)) -
                  (platform === "linkedin" ? (b.impressions ?? 0) : (b.views ?? 0))
              )
              .slice(0, 10)

            return (
              <section key={platform}>
                <h2 className="text-lg font-semibold mb-4">{PLATFORM_LABELS[platform] ?? platform}</h2>

                {/* Winners row */}
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  Top Performers
                </p>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {top3.map((post, i) => (
                    <WinnerCard key={post.id} post={post} platform={platform} rank={i + 1} />
                  ))}
                </div>

                {/* Full top/bottom tables */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      All Top 10
                    </p>
                    <PlatformTable posts={top10} platform={platform} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Lowest 10
                    </p>
                    <PlatformTable posts={bottom10} platform={platform} variant="low" />
                  </div>
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
