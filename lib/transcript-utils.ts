export const TRANSCRIPT_PLATFORMS = ["tiktok", "instagram", "youtube"]

export function supportsTranscript(platform: string): boolean {
  return TRANSCRIPT_PLATFORMS.includes(platform)
}
