import type { Project } from "./types";

export type RemoteProject = {
  id?: string;
  name?: string;
  title?: string;
  project_name?: string;
  job_name?: string;
  label?: string;
  display_name?: string;
  project_number?: string;
  number?: string;
  job_number?: string;
  status?: string;
  project_status?: string;
  company_id?: string;
  companyId?: string;
  company?: { id?: string };
};

export function mapStatus(value: string | undefined): Project["status"] {
  const status = (value || "").toLowerCase();
  if (status.includes("bid") || status.includes("estimat")) return "bidding";
  if (status === "completed" || status === "complete" || status === "closed" || status === "done" || status === "archived") {
    return "completed";
  }
  return "active";
}

export function projectName(row: RemoteProject) {
  return [row.name, row.title, row.project_name, row.job_name, row.label, row.display_name]
    .map((value) => String(value || "").trim())
    .find(Boolean) || "";
}

export function mapProject(row: RemoteProject, index: number, fallbackId: (i: number) => string): Project | null {
  const name = projectName(row);
  if (!name) return null;
  return {
    id: String(row.id || fallbackId(index)),
    name,
    project_number: String(row.project_number || row.number || row.job_number || `B-${index + 1}`),
    status: mapStatus(row.status || row.project_status),
  };
}

export function unwrapProjects(payload: unknown): RemoteProject[] {
  if (Array.isArray(payload)) return payload as RemoteProject[];
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  for (const key of ["projects", "jobs", "data", "items", "results", "records"]) {
    const value = record[key];
    if (Array.isArray(value)) return value as RemoteProject[];
    if (value && typeof value === "object") {
      const nested = unwrapProjects(value);
      if (nested.length) return nested;
    }
  }
  return [];
}

export function scopeProjects(rows: RemoteProject[], companyId: string) {
  const id = companyId.trim();
  if (!id) return rows;
  const matches = rows.filter((row) => {
    const cid = row.company_id || row.companyId || row.company?.id;
    return cid != null && String(cid) === id;
  });
  return matches.length ? matches : rows;
}
