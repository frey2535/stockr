export function wantsUpdatePreview(search: string) {
  return new URLSearchParams(search).get("update_now") === "1";
}

export function nextRefreshUrl(href: string, now: number, targetSha?: string) {
  const nextUrl = new URL(href, "https://stockr.currentflowconsulting.org");
  nextUrl.searchParams.delete("update_now");
  nextUrl.searchParams.set("t", String(now));
  if (targetSha) nextUrl.searchParams.set("build", targetSha);
  return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
}
