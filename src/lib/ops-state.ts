import type { Material, Project, StockRule, StoreState } from "./types";

export const OPS_BLOB_ID = "prj__stockr_ops__";
export const OPS_BLOB_MARKER = "__stockr_ops__";

export type CatalogIdExtra = {
  id: string;
  mpn?: string;
  upc?: string;
  supplier_number?: string;
};

export type OpsBlob = {
  stockRules: StockRule[];
  catalogIds: CatalogIdExtra[];
};

export function isOpsBlob(project: Pick<Project, "id" | "project_number">) {
  return project.id === OPS_BLOB_ID || project.project_number === OPS_BLOB_MARKER;
}

function parseOpsBlob(name: string | undefined): OpsBlob {
  if (!name) return { stockRules: [], catalogIds: [] };
  try {
    const parsed = JSON.parse(name) as Partial<OpsBlob>;
    return {
      stockRules: Array.isArray(parsed.stockRules) ? parsed.stockRules : [],
      catalogIds: Array.isArray(parsed.catalogIds) ? parsed.catalogIds : [],
    };
  } catch {
    return { stockRules: [], catalogIds: [] };
  }
}

export function opsFromProjects(projects: Project[], fallback: OpsBlob): OpsBlob {
  const blob = projects.find(isOpsBlob);
  if (!blob) return fallback;
  const parsed = parseOpsBlob(blob.name);
  return {
    stockRules: parsed.stockRules.length ? parsed.stockRules : fallback.stockRules,
    catalogIds: parsed.catalogIds.length ? parsed.catalogIds : fallback.catalogIds,
  };
}

export function projectsWithoutOpsBlob(projects: Project[]) {
  return projects.filter((project) => !isOpsBlob(project));
}

export function catalogExtrasFromMaterials(materials: Material[]): CatalogIdExtra[] {
  return (materials || [])
    .filter((row) => row.mpn || row.upc || row.supplier_number)
    .map((row) => ({
      id: row.id,
      mpn: row.mpn || "",
      upc: row.upc || "",
      supplier_number: row.supplier_number || "",
    }));
}

export function mergeCatalogExtras(materials: Material[], extras: CatalogIdExtra[]): Material[] {
  if (!extras.length) return materials;
  const byId = new Map(extras.map((row) => [row.id, row]));
  return materials.map((material) => {
    const extra = byId.get(material.id);
    if (!extra) return material;
    const aliases = new Set(material.aliases || []);
    for (const value of [extra.mpn, extra.upc, extra.supplier_number]) {
      if (value) aliases.add(value);
    }
    return {
      ...material,
      mpn: material.mpn || extra.mpn || "",
      upc: material.upc || extra.upc || "",
      supplier_number: material.supplier_number || extra.supplier_number || "",
      aliases: Array.from(aliases),
    };
  });
}

export function encodeOpsForPersist(state: StoreState): StoreState {
  const stockRules = state.stockRules || [];
  const catalogIds = catalogExtrasFromMaterials(state.materials || []);
  return {
    ...state,
    stockRules,
    projects: [
      ...projectsWithoutOpsBlob(state.projects || []),
      {
        id: OPS_BLOB_ID,
        name: JSON.stringify({ stockRules, catalogIds } satisfies OpsBlob),
        project_number: OPS_BLOB_MARKER,
        status: "completed",
      },
    ],
  };
}

export function decodeOpsFromPersist(state: StoreState): StoreState {
  const projects = state.projects || [];
  const fallback: OpsBlob = {
    stockRules: state.stockRules || [],
    catalogIds: catalogExtrasFromMaterials(state.materials || []),
  };
  const ops = opsFromProjects(projects, fallback);
  return {
    ...state,
    stockRules: ops.stockRules,
    materials: mergeCatalogExtras(state.materials || [], ops.catalogIds),
    projects: projectsWithoutOpsBlob(projects),
  };
}
