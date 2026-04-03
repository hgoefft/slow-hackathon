import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDistanceToNow } from "date-fns"
import { supportsTranscript } from "@/lib/transcript-utils"
import { TranscriptButton } from "./transcript-button"
import type { PostWithTranscript } from "@/lib/actions/sync"

function fmt(n: number | null | undefined) {
  if (n == null) return "—"
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

function getPrimaryMetric(post: PostWithTranscript, platform: string) {
  if (platform === "linkedin") return post.impressions
  return post.views
}

function getPrimaryLabel(platform: string) {
  if (platform === "linkedin") return "Impressions"
  return "Views"
}

export function PlatformTable({
  posts,
  platform,
  variant = "top",
}: {
  posts: PostWithTranscript[]
  platform: string
  variant?: "top" | "low"
}) {
  if (!posts.length) return <p className="text-sm text-muted-foreground">No data</p>

  const showTranscript = supportsTranscript(platform)

  return (
    <div className="rounded-md border text-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[35%]">Post</TableHead>
            <TableHead className="text-right">{getPrimaryLabel(platform)}</TableHead>
            <TableHead className="text-right">Likes</TableHead>
            <TableHead className="text-right">Comments</TableHead>
            {platform !== "linkedin" && <TableHead className="text-right">Saves</TableHead>}
            {platform === "linkedin" && <TableHead className="text-right">Clicks</TableHead>}
            {showTranscript && <TableHead className="text-right w-[70px]">Transcript</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {posts.map((post) => {
            const hasTranscript = !!post.contentPiece?.attributes?.transcript
            return (
              <TableRow key={post.id}>
                <TableCell className="max-w-[200px]">
                  <p className="truncate text-xs">{post.caption ?? `Post ${post.externalId.slice(0, 8)}`}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDistanceToNow(post.publishedAt, { addSuffix: true })}
                  </p>
                </TableCell>
                <TableCell className="text-right font-medium">{fmt(getPrimaryMetric(post, platform))}</TableCell>
                <TableCell className="text-right">{fmt(post.likes)}</TableCell>
                <TableCell className="text-right">{fmt(post.comments)}</TableCell>
                {platform !== "linkedin" && <TableCell className="text-right">{fmt(post.saves)}</TableCell>}
                {platform === "linkedin" && <TableCell className="text-right">{fmt(post.clicks)}</TableCell>}
                {showTranscript && (
                  <TableCell className="text-right">
                    <TranscriptButton postId={post.id} initialHasTranscript={hasTranscript} />
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
