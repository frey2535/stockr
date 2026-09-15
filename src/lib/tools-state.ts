import type { Project, StoreState, Tool } from "./types";

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
