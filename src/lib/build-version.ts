export type BuildVersion = {
  sha: string;
  builtAt: string;
  name: string;
};

export function currentBuildVersion(): BuildVersion {
  const sha =
    process.env.STOCKR_BUILD_ID ||
    process.env.CF_PAGES_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_STOCKR_BUILD_SHA ||
    "local";
  return {
    sha,
    builtAt: process.env.STOCKR_BUILT_AT || "",
    name: "Stockr",
  };
}

export function isReleaseSha(sha: string) {
  const value = (sha || "").trim();
  return Boolean(value) && value !== "local";
}

export function shouldOfferUpdate(currentSha: string, remoteSha: string) {
  if (!isReleaseSha(currentSha) || !isReleaseSha(remoteSha)) return false;
  return currentSha.trim() !== remoteSha.trim();
}

export function shouldAnnounceAppliedUpdate(
  seenSha: string,
  runningSha: string,
  hasExistingData = false,
) {
  if (!isReleaseSha(runningSha)) return false;
  const seen = (seenSha || "").trim();
  if (seen === runningSha.trim()) return false;
  if (isReleaseSha(seen)) return true;
  return hasExistingData;
}
