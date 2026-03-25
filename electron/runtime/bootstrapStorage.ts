/**
 * Ensures writable folders exist at app startup.
 * Extracted from main process startup logic.
 * Populated in Phase 3 as startup storage needs are identified.
 */
export async function bootstrapStorage(): Promise<void> {
  // No writable directory creation logic was found in the source main/index.ts.
  // The userData path adjustment (dev suffix) lives in main.ts startup.
  // This stub will be filled in when Phase 3 identifies concrete storage bootstrap needs.
}
