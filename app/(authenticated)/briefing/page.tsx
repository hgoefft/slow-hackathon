import { BriefingClient } from "./briefing-client"
import { isGmailConnected } from "@/lib/actions/gmail"
import { getStoredBriefings, getLatestBriefingInsight } from "@/lib/actions/briefing"

export default async function BriefingPage() {
  const [gmailConnected, storedBriefings, latestInsight] = await Promise.all([
    isGmailConnected(),
    getStoredBriefings(),
    getLatestBriefingInsight(),
  ])

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Weekly Briefings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Patterns, themes, and content ideas across your last 8 weeks of briefing emails
        </p>
      </div>
      <BriefingClient
        gmailConnected={gmailConnected}
        storedBriefings={storedBriefings}
        latestInsight={latestInsight}
      />
    </div>
  )
}
