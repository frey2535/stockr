import { uid } from "./id";
import type { Project } from "./types";

type RemoteProject = {
  id?: string;
  name?: string;
  title?: string;
  project_number?: string;
  number?: string;
  job_number?: string;
  status?: string;
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

export async function fetchBuildrProjects(companyId: string): Promise<{
  projects: Project[];
  source: "buildr" | "none";
  error?: string;
}> {
  const id = companyId.trim();
  if (!id) return { projects: [], source: "none", error: "Enter a Buildr company ID first." };

  const base = (process.env.BUILDR_API_URL || "https://api.buildr.app").replace(/\/$/, "");
  const key = process.env.BUILDR_API_KEY?.trim();
  const paths = [
    `/v1/companies/${encodeURIComponent(id)}/projects`,
    `/companies/${encodeURIComponent(id)}/projects`,
    `/api/companies/${encodeURIComponent(id)}/projects`,
  ];

  let lastError = "";
  for (const path of paths) {
    try {
      const response = await fetch(`${base}${path}`, {
        headers: {
          Accept: "application/json",
          ...(key ? { Authorization: `Bearer ${key}` } : {}),
        },
        cache: "no-store",
      });
      if (!response.ok) {
        lastError = `Buildr returned ${response.status} for ${path}`;
        continue;
      }
      const payload = (await response.json().catch(() => null)) as unknown;
      const projects = unwrapProjects(payload)
        .map((row, index) => mapProject(row, index))
        .filter((row): row is Project => Boolean(row));
      if (projects.length) return { projects, source: "buildr" };
      lastError = "Buildr returned no projects for that company.";
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Could not reach Buildr.";
    }
  }

  return { projects: [], source: "none", error: lastError || "Could not sync Buildr projects." };
}
