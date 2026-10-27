export const FAMILY_LAUNCH_PARAM = "from";
export const FAMILY_LAUNCH_VALUE = "buildr";
export const FAMILY_LAUNCH_COOKIE = "stockr_family_launch";
export const FAMILY_LAUNCH_RETURN_COOKIE = "stockr_family_return";
export const FAMILY_LAUNCH_CHANNEL = "stockr-family-launch";

const BUILDR_HOSTS = new Set(["buildrpm.com", "www.buildrpm.com", "buildr.app", "www.buildr.app"]);

export type FamilyLaunchInstance = {
  id: string;
  fromFamilyLaunch: boolean;
  native: boolean;
  standalone: boolean;
  hasOpener: boolean;
  embedded: boolean;
  launchedAt: number;
};

export function familyLaunchCookieOptions() {
  return {
    path: "/",
    maxAge: 120,
    sameSite: "lax" as const,
    httpOnly: false,
  };
}

export function applyFamilyLaunchCookies(
  cookies: { set: (name: string, value: string, options: ReturnType<typeof familyLaunchCookieOptions>) => unknown },
  referrer = "",
) {
  const options = familyLaunchCookieOptions();
  cookies.set(FAMILY_LAUNCH_COOKIE, "1", options);
  const back = familyLaunchReturnUrl(referrer);
  if (back) cookies.set(FAMILY_LAUNCH_RETURN_COOKIE, encodeURIComponent(back), options);
}

export function familyLaunchLandingPath(next: string | null | undefined) {
  const path = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  const url = new URL(path, "https://stockr.invalid");
  url.searchParams.set(FAMILY_LAUNCH_PARAM, FAMILY_LAUNCH_VALUE);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function isFamilyLaunchSearch(search: string) {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return (
    params.get(FAMILY_LAUNCH_PARAM) === FAMILY_LAUNCH_VALUE || params.get("source") === "buildr"
  );
}

export function isFamilyLaunchCookie(cookieHeader: string) {
  return cookieHeader.split(";").some((part) => {
    const [name, value] = part.trim().split("=", 2);
    return name === FAMILY_LAUNCH_COOKIE && value === "1";
  });
}

export function isBuildrHost(hostname: string) {
  const host = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
  return BUILDR_HOSTS.has(host) || host.endsWith(".buildrpm.com") || host.endsWith(".buildr.app");
}

export function familyLaunchReturnUrl(referrer: string) {
  try {
    const url = new URL(referrer);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!isBuildrHost(url.hostname)) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function familyLaunchReturnFromCookie(cookieHeader: string) {
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(`${FAMILY_LAUNCH_RETURN_COOKIE}=`)) continue;
    return familyLaunchReturnUrl(decodeURIComponent(trimmed.slice(FAMILY_LAUNCH_RETURN_COOKIE.length + 1)));
  }
  return null;
}

export function familyLaunchRank(instance: FamilyLaunchInstance) {
  if (!instance.fromFamilyLaunch) return -1;
  if (instance.native) return 400;
  if (instance.standalone) return 300;
  if (instance.hasOpener && !instance.embedded) return 200;
  if (instance.embedded) return 10;
  return 100;
}

export function compareFamilyLaunch(left: FamilyLaunchInstance, right: FamilyLaunchInstance) {
  const rank = familyLaunchRank(left) - familyLaunchRank(right);
  if (rank !== 0) return rank;
  return left.launchedAt - right.launchedAt;
}

export function familyLaunchShouldYield(
  self: FamilyLaunchInstance,
  peers: FamilyLaunchInstance[],
  installedApp = false,
) {
  if (!self.fromFamilyLaunch) return false;
  if (self.native || self.standalone) return false;
  if (installedApp) return true;
  if (!peers.length) return false;
  const winner = peers.reduce((best, peer) => (compareFamilyLaunch(peer, best) > 0 ? peer : best));
  return compareFamilyLaunch(winner, self) > 0;
}

export function stripFamilyLaunchSearch(href: string) {
  const url = new URL(href, "https://stockr.invalid");
  url.searchParams.delete(FAMILY_LAUNCH_PARAM);
  if (url.searchParams.get("source") === "buildr") url.searchParams.delete("source");
  return `${url.pathname}${url.search}${url.hash}`;
}
