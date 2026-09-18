import { uid } from "./id";
import type { Project } from "./types";

export const BUILDR_DEFAULT_URL = "https://buildrpm.com";
const DEAD_BUILDR_HOSTS = new Set(["api.buildr.app", "www.api.buildr.app"]);

type RemoteProject = {
  id?: string;
  name?: string;
  title?: string;
  project_number?: string;
  number?: string;
  job_number?: string;
  status?: string;
  company_id?: string;
};

function mapStatus(value: string | undefined): Project["status"] {
  const status = (value || "").toLowerCase();
  if (status.includes("bid") || status.includes("estimat")) return "bidding";
  if (status.includes("complete") || status.includes("closed") || status.includes("done")) {
    return "completed";
  }
  return "active";
}

function mapProject(row: RemoteProject, index: number): Project | null {
  const name = (row.name || row.title || "").trim();
  if (!name) return null;
  return {
    id: String(row.id || uid("prj")),
    name,
    project_number: String(row.project_number || row.number || row.job_number || `B-${index + 1}`),
    status: mapStatus(row.status),
  };
}

function unwrapProjects(payload: unknown): RemoteProject[] {
  if (Array.isArray(payload)) return payload as RemoteProject[];
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of ["projects", "data", "items", "results"]) {
      if (Array.isArray(record[key])) return record[key] as RemoteProject[];
    }
  }
  return [];
}

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
  const paths = [
    "/projects",
    `/projects?company_id=${encodeURIComponent(id)}`,
    `/companies/${encodeURIComponent(id)}/projects`,
    `/v1/companies/${encodeURIComponent(id)}/projects`,
    `/api/companies/${encodeURIComponent(id)}/projects`,
  ];

  let lastError = "";
  for (const base of bases) {
    for (const path of paths) {
      try {
        const response = await fetch(`${base}${path}`, {
          headers: {
            Accept: "application/json",
            ...(key ? { Authorization: `Bearer ${key}` } : {}),
          },
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
          // This is the live API; do not keep guessing dead company-scoped HTML routes.
          if (path.startsWith("/projects")) {
            return { projects: [], source: "none", error: lastError };
          }
          continue;
        }
        if (!response.ok) {
          lastError = `Buildr returned ${response.status} for ${base}${path}`;
          continue;
        }
        const rows = unwrapProjects(payload);
        const scoped = rows.filter((row) => row.company_id === id);
        const projects = (scoped.length ? scoped : rows)
          .map((row, index) => mapProject(row, index))
          .filter((row): row is Project => Boolean(row));
        if (projects.length) return { projects, source: "buildr" };
        lastError = "Buildr returned no projects for that company.";
      } catch (error) {
        lastError = describeReachError(error);
      }
    }
  }

  return { projects: [], source: "none", error: lastError || "Could not sync Buildr projects." };
}
