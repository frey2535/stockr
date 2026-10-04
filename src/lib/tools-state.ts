import type { Project, StoreState, Tool, ToolCondition } from "./types";

export const TOOL_CONDITIONS: { id: ToolCondition; label: string }[] = [
  { id: "good", label: "Good" },
  { id: "operating_issues", label: "Operating but has issues" },
  { id: "broken", label: "Broken" },
  { id: "lost", label: "Lost" },
  { id: "stolen", label: "Stolen" },
  { id: "in_repair", label: "In repair" },
  { id: "retired", label: "Retired" },
];

export function toolConditionLabel(condition?: string) {
  return TOOL_CONDITIONS.find((row) => row.id === condition)?.label || "Good";
}

export function nextToolNumber(tools: Tool[]) {
  const used = tools
    .map((tool) => String(tool.tool_number || "").trim())
    .map((value) => {
      const match = value.match(/(\d+)\s*$/);
      return match ? Number(match[1]) : 0;
    });
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `T-${String(next).padStart(3, "0")}`;
}

export function mergeToolLists(tableTools: Tool[], blobTools: Tool[]) {
  const byId = new Map<string, Tool>();
  for (const tool of blobTools) {
    if (tool?.id) byId.set(tool.id, tool);
  }
  for (const tool of tableTools) {
    if (tool?.id) byId.set(tool.id, { ...byId.get(tool.id), ...tool });
  }
  return Array.from(byId.values());
}

export const TOOLS_BLOB_ID = "prj__stockr_tools__";
export const TOOLS_BLOB_MARKER = "__stockr_tools__";

export function isToolsBlob(project: Pick<Project, "id" | "project_number">) {
  return project.id === TOOLS_BLOB_ID || project.project_number === TOOLS_BLOB_MARKER;
}

function parseToolsBlob(name: string | undefined): Tool[] {
  if (!name) return [];
  try {
    const parsed = JSON.parse(name) as unknown;
    return Array.isArray(parsed) ? (parsed as Tool[]) : [];
  } catch {
    return [];
  }
}

export function toolsFromProjects(projects: Project[], fallback: Tool[] = []) {
  const blob = projects.find(isToolsBlob);
  const fromBlob = parseToolsBlob(blob?.name);
  return fromBlob.length ? fromBlob : fallback;
}

export function projectsWithoutToolsBlob(projects: Project[]) {
  return projects.filter((project) => !isToolsBlob(project));
}

export function encodeToolsForPersist(state: StoreState): StoreState {
  const tools = state.tools || [];
  return {
    ...state,
    tools,
    projects: [
      ...projectsWithoutToolsBlob(state.projects || []),
      {
        id: TOOLS_BLOB_ID,
        name: JSON.stringify(tools),
        project_number: TOOLS_BLOB_MARKER,
        status: "completed",
      },
    ],
  };
}

export function decodeToolsFromPersist(state: StoreState): StoreState {
  const projects = state.projects || [];
  return {
    ...state,
    tools: toolsFromProjects(projects, state.tools || []),
    projects: projectsWithoutToolsBlob(projects),
  };
}
