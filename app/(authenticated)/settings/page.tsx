import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Circle } from "lucide-react"
import { DebugButton } from "./debug-button"
import { YoutubeConnectButton } from "./youtube-connect-button"
import { isYouTubeConnected } from "@/lib/actions/youtube"

export default async function SettingsPage() {
  const ytConnected = await isYouTubeConnected()

  const integrations = [
    {
      name: "Metricool",
      description: "TikTok, Instagram, LinkedIn analytics",
      status: !!process.env.METRICOOL_API_TOKEN ? "connected" : "missing",
    },
    {
      name: "Anthropic (Claude)",
      description: "AI analysis, auditioning, briefing synthesis",
      status: !!process.env.ANTHROPIC_API_KEY ? "connected" : "missing",
    },
    {
      name: "YouTube Analytics",
      description: "YouTube video performance (last 30 days)",
      status: ytConnected ? "connected" : "not_connected",
      action: <YoutubeConnectButton connected={ytConnected} />,
    },
    {
      name: "Supadata",
      description: "TikTok / Instagram transcript extraction",
      status: "coming_soon",
    },
  ]

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">API connections and integrations</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Integrations</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {integrations.map((integration) => (
            <div key={integration.name} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3">
                {integration.status === "connected" ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-medium">{integration.name}</p>
                  <p className="text-xs text-muted-foreground">{integration.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {"action" in integration && integration.action}
                <Badge
                  variant={integration.status === "connected" ? "default" : "secondary"}
                  className="text-xs"
                >
                  {integration.status === "connected"
                    ? "Connected"
                    : integration.status === "coming_soon"
                    ? "Coming soon"
                    : integration.status === "not_connected"
                    ? "Not connected"
                    : "Not configured"}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="mt-6 p-4 bg-muted/50 rounded-lg text-xs text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Data freshness note</p>
        <p>
          Metricool data is 48–72 hours behind live platform stats. YouTube Analytics data is
          typically 24–48 hours behind. This tool is designed for weekly strategic analysis,
          not real-time optimization.
        </p>
      </div>

      <div className="mt-6">
        <p className="text-xs font-medium text-muted-foreground mb-2">Debug Metricool Connection</p>
        <DebugButton />
      </div>
    </div>
  )
}
