"use server"

const BASE_URL = "https://app.metricool.com/api"
const TOKEN = process.env.METRICOOL_API_TOKEN!
const USER_ID = 4682845
const BLOG_ID = 6067141

function isoRange(days = 30) {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - days)
  const fromStr = from.toISOString().split("T")[0] + "T00:00:00"
  const toStr = to.toISOString().split("T")[0] + "T23:59:59"
  return { from: encodeURIComponent(fromStr), to: encodeURIComponent(toStr) }
}

async function tryEndpoint(label: string, url: string) {
  const res = await fetch(url, {
    headers: { "X-Mc-Auth": TOKEN },
    cache: "no-store",
  })
  let data: unknown
  const text = await res.text()
  try { data = JSON.parse(text) } catch { data = text.slice(0, 200) }
  const count = Array.isArray(data) ? data.length : "n/a"
  const sample = Array.isArray(data) ? (data[0] ?? null) : data
  return { label, status: res.status, count, sample }
}

export async function debugMetricool() {
  const { from, to } = isoRange(30)
  const base = `blogId=${BLOG_ID}&userId=${USER_ID}&integrationSource=MCP`

  const results = await Promise.all([
    tryEndpoint("tiktok v2", `${BASE_URL}/v2/analytics/posts/tiktok?from=${from}&to=${to}&${base}`),
    tryEndpoint("instagram v2", `${BASE_URL}/v2/analytics/posts/instagram?from=${from}&to=${to}&${base}`),
    tryEndpoint("linkedin v2", `${BASE_URL}/v2/analytics/posts/linkedin?from=${from}&to=${to}&${base}`),
    // Also test old instagram endpoint to compare
    tryEndpoint("instagram old", `${BASE_URL}/stats/instagram/posts?userId=${USER_ID}&blogId=${BLOG_ID}&start=20260303&end=20260402`),
  ])

  return results
}
