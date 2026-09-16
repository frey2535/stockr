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

export function shouldOfferUpdate(currentSha: string, remoteSha: string) {
  const current = (currentSha || "").trim();
  const remote = (remoteSha || "").trim();
  if (!remote || remote === "local") return false;
  if (!current || current === "local") return false;
  return current !== remote;
}
