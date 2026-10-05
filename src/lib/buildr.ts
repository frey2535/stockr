import { mapProject, scopeProjects, unwrapProjects } from "./buildr-parse";
import { buildrProjectPaths, preferBuildrError } from "./buildr-paths";
import { uid } from "./id";
import type { Project } from "./types";

export { buildrProjectPaths, preferBuildrError } from "./buildr-paths";

export const BUILDR_DEFAULT_URL = "https://buildrpm.com";
const DEAD_BUILDR_HOSTS = new Set(["api.buildr.app", "www.api.buildr.app"]);

function normalizeBase(url: string) {
  return url.trim().replace(/\/$/, "");
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function buildrApiBases() {
  const configured = process.env.BUILDR_API_URL ? normalizeBase(process.env.BUILDR_API_URL) : "";
  const bases = [configured, BUILDR_DEFAULT_URL].filter(Boolean);
  return Array.from(new Set(bases)).filter((base) => !DEAD_BUILDR_HOSTS.has(hostOf(base)));
}

function isHtml(response: Response, body: string) {
  const type = response.headers.get("content-type") || "";
  return type.includes("text/html") || /^\s*</.test(body);
}

function describeReachError(error: unknown) {
  const message = error instanceof Error ? error.message : "Could not reach Buildr.";
  const cause = error instanceof Error && "cause" in error ? String((error as { cause?: { code?: string; message?: string } }).cause?.code || "") : "";
  if (/ENOTFOUND|EAI_AGAIN|DNS|getaddrinfo|530/i.test(`${message} ${cause}`)) {
    return "Buildr hostname could not be resolved (Cloudflare 530 / DNS). Using buildrpm.com instead of api.buildr.app.";
  }
  return message;
}

function serviceToken() {
  return (process.env.BUILDR_API_KEY || process.env.STOCKR_BUILDR_SHARED_SECRET || "").trim();
}

async function readPayload(response: Response) {
  const text = await response.text();
  if (isHtml(response, text)) return { html: true as const, payload: null, text };
  try {
    return { html: false as const, payload: JSON.parse(text) as unknown, text };
  } catch {
    return { html: false as const, payload: null, text };
  }
}

export async function fetchBuildrProjects(companyId: string): Promise<{
  projects: Project[];
  source: "buildr" | "none";
  error?: string;
}> {
  const id = companyId.trim();
  if (!id) return { projects: [], source: "none", error: "Enter a Buildr company ID first." };

  const bases = buildrApiBases();
  if (!bases.length) {
    return { projects: [], source: "none", error: "No reachable Buildr API URL is configured." };
  }

  const key = serviceToken();
  const paths = buildrProjectPaths(id);
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Company-Id": id,
    ...(key ? { Authorization: `Bearer ${key}`, "X-Api-Key": key } : {}),
  };

  let lastError = "";
  for (const base of bases) {
    for (const path of paths) {
      try {
        const response = await fetch(`${base}${path}`, {
          headers,
          cache: "no-store",
        });
        const { html, payload } = await readPayload(response);
        if (html) {
          lastError = preferBuildrError(lastError, `Buildr ${base}${path} returned the website instead of the API.`);
          continue;
        }
        if (response.status === 401 || response.status === 403) {
          lastError = preferBuildrError(
            lastError,
            "Buildr asked for a login token. Deploy the company job list route so Stockr can sync by company ID.",
          );
          continue;
        }
        if (!response.ok) {
          const body = payload && typeof payload === "object" ? (payload as { message?: string; error?: string }) : {};
          lastError = preferBuildrError(
            lastError,
            body.message || body.error || `Buildr returned ${response.status} for ${base}${path}`,
          );
          continue;
        }
        const projects = scopeProjects(unwrapProjects(payload), id)
          .map((row, index) => mapProject(row, index, () => uid("prj")))
          .filter((row): row is Project => Boolean(row));
        if (projects.length) return { projects, source: "buildr" };
        lastError = "Buildr returned no projects for that company ID.";
      } catch (error) {
        lastError = preferBuildrError(lastError, describeReachError(error));
      }
    }
  }

  return { projects: [], source: "none", error: lastError || "Could not sync Buildr projects." };
}

export type BuildrFamilyAppBootstrap = {
  valid: boolean;
  error?: string;
  product_key?: string;
  company_id?: string;
  company_name?: string;
  user_id?: string;
  email?: string;
  name?: string;
  role?: string;
  password_hash?: string;
};

/** Exchange a Buildr SSO token for identity + password hash (POST body only). */
export async function bootstrapBuildrFamilyAppSso(
  token: string,
  audience = "stockr",
): Promise<BuildrFamilyAppBootstrap> {
  const trimmed = String(token || "").trim();
  if (!trimmed) return { valid: false, error: "token_required" };

  const bases = buildrApiBases();
  if (!bases.length) return { valid: false, error: "buildr_not_configured" };

  let lastError = "buildr_unavailable";
  for (const base of bases) {
    try {
      const response = await fetch(`${base}/functions/bootstrapFamilyAppSSO`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: trimmed, audience }),
      });
      const { html, payload, text } = await readPayload(response);
      if (html) {
        lastError = `Buildr ${base} returned the website instead of the API.`;
        continue;
      }
      const data = (payload && typeof payload === "object" ? payload : {}) as BuildrFamilyAppBootstrap;
      if (!response.ok) {
        lastError = data.error || `Buildr returned ${response.status}`;
        if (response.status >= 400 && response.status < 500) return { valid: false, error: lastError };
        continue;
      }
      if (!data.valid || !data.email || !data.company_id || !data.password_hash) {
        lastError = data.error || "invalid_bootstrap";
        return { valid: false, error: lastError };
      }
      return data;
    } catch (error) {
      lastError = describeReachError(error);
    }
  }

  return { valid: false, error: lastError };
}
