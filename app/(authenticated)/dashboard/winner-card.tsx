import { formatDistanceToNow } from "date-fns"
import { ExternalLink } from "lucide-react"
import type { PostWithTranscript } from "@/lib/actions/sync"

function fmt(n: number | null | undefined) {
  if (n == null) return "—"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function getPrimaryMetric(post: PostWithTranscript, platform: string) {
  return platform === "linkedin" ? post.impressions : post.views
}

function getPrimaryLabel(platform: string) {
  return platform === "linkedin" ? "Impressions" : "Views"
}

export function WinnerCard({
  post,
  platform,
  rank,
}: {
  post: PostWithTranscript
  platform: string
  rank: number
}) {
  const primary = getPrimaryMetric(post, platform)
  const label = getPrimaryLabel(platform)
  const caption = post.caption ?? `Post ${post.externalId.slice(0, 8)}`

  return (
    <div className="rounded-lg border bg-card overflow-hidden flex flex-col">
      {/* Thumbnail */}
      <div className="relative bg-muted aspect-[9/16] max-h-48 overflow-hidden">
        {post.thumbnailUrl ? (
          <img
            src={post.thumbnailUrl}
            alt={caption}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
            No thumbnail
          </div>
        )}
        <div className="absolute top-2 left-2 bg-background/90 text-foreground text-xs font-bold rounded px-1.5 py-0.5">
          #{rank}
        </div>
      </div>

      {/* Content */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <p className="text-xs line-clamp-2 text-foreground leading-relaxed">{caption}</p>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(post.publishedAt, { addSuffix: true })}
        </p>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-xs mt-auto pt-1 border-t">
          <span className="font-semibold text-primary">
            {fmt(primary)} <span className="font-normal text-muted-foreground">{label}</span>
          </span>
          <span className="text-muted-foreground">{fmt(post.likes)} likes</span>
          {post.saves != null && (
            <span className="text-muted-foreground">{fmt(post.saves)} saves</span>
          )}
        </div>
      </div>

      {/* Link */}
      {post.url && (
        <a
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-3 py-2 text-xs text-muted-foreground hover:text-foreground border-t transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          View post
        </a>
      )}
    </div>
  )
}
