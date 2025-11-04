import { cleanupOldContainers } from "./docker"

export async function startCleanupService() {
  // Run cleanup every hour
  const CLEANUP_INTERVAL = 60 * 60 * 1000 // 1 hour
  const MAX_PREVIEW_AGE = 24 * 60 * 60 * 1000 // 24 hours

  setInterval(async () => {
    try {
      console.log("Running container cleanup...")
      await cleanupOldContainers(MAX_PREVIEW_AGE)
      console.log("Container cleanup completed")
    } catch (error) {
      console.error("Cleanup service error:", error)
    }
  }, CLEANUP_INTERVAL)

  // Run immediately on startup
  await cleanupOldContainers(MAX_PREVIEW_AGE)
}
