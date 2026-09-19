import { mapProject, scopeProjects, unwrapProjects } from "./buildr-parse";
import { uid } from "./id";
import type { Project } from "./types";

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

  const key = process.env.BUILDR_API_KEY?.trim();
  const token = key || id;
  const paths = [
    "/projects",
    `/projects?company_id=${encodeURIComponent(id)}`,
    `/projects?companyId=${encodeURIComponent(id)}`,
    `/jobs?company_id=${encodeURIComponent(id)}`,
    `/api/projects?company_id=${encodeURIComponent(id)}`,
    `/api/v1/projects?company_id=${encodeURIComponent(id)}`,
    `/companies/${encodeURIComponent(id)}/projects`,
    `/v1/companies/${encodeURIComponent(id)}/projects`,
    `/api/companies/${encodeURIComponent(id)}/projects`,
  ];
  const headerSets: Record<string, string>[] = [
    {
      Accept: "application/json",
      "X-Company-Id": id,
      ...(key ? { Authorization: `Bearer ${key}`, "X-Api-Key": key } : {}),
    },
    {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "X-Api-Key": token,
      "X-Company-Id": id,
    },
  ];

  let lastError = "";
  for (const base of bases) {
    for (const path of paths) {
      for (const headers of headerSets) {
        try {
          const response = await fetch(`${base}${path}`, {
            headers,
            cache: "no-store",
          });
          const { html, payload } = await readPayload(response);
          if (html) {
            lastError = `Buildr ${base}${path} returned the website instead of the API.`;
            continue;
          }
          if (response.status === 401 || response.status === 403) {
            lastError = key
              ? "Buildr rejected the API key. Check BUILDR_API_KEY."
              : "Buildr requires a service token. Add BUILDR_API_KEY to Stockr Cloudflare secrets.";
            continue;
          }
          if (!response.ok) {
            lastError = `Buildr returned ${response.status} for ${base}${path}`;
            continue;
          }
          const projects = scopeProjects(unwrapProjects(payload), id)
            .map((row, index) => mapProject(row, index, () => uid("prj")))
            .filter((row): row is Project => Boolean(row));
          if (projects.length) return { projects, source: "buildr" };
          lastError = "Buildr returned no projects for that company.";
        } catch (error) {
          lastError = describeReachError(error);
        }
      }
    }
  }

  return { projects: [], source: "none", error: lastError || "Could not sync Buildr projects." };
}
