import type { Location, Project, StoreState, Tool, ToolCondition } from "./types";

export type ToolListView = "employee" | "location";

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

export function toolLocation(tool: Pick<Tool, "assigned_location_id">, locations: Location[]) {
  const id = String(tool.assigned_location_id || "").trim();
  return id ? locations.find((location) => location.id === id) || null : null;
}

export function toolHasAssignedLocation(tool: Pick<Tool, "assigned_location_id">, locations: Location[]) {
  return Boolean(toolLocation(tool, locations));
}

export function toolEmployeeName(tool: Pick<Tool, "assigned_to">) {
  return String(tool.assigned_to || "").trim();
}

function employeeGroupsFrom(tools: Tool[]) {
  const groups = new Map<string, Tool[]>();
  for (const tool of tools) {
    const employee = toolEmployeeName(tool);
    if (!employee) continue;
    groups.set(employee, [...(groups.get(employee) || []), tool]);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, rows]) => ({ name, tools: rows }));
}

export function groupToolsForView(tools: Tool[], locations: Location[], view: ToolListView) {
  if (view === "employee") {
    return {
      employeeGroups: employeeGroupsFrom(tools),
      locationGroups: [] as Array<{ location: Location; tools: Tool[] }>,
      employeeOnly: [] as Tool[],
      unassigned: tools.filter((tool) => !toolEmployeeName(tool)),
    };
  }

  const employeeOnly = tools.filter((tool) => toolEmployeeName(tool) && !toolHasAssignedLocation(tool, locations));
  return {
    employeeGroups: employeeGroupsFrom(employeeOnly),
    locationGroups: locations.map((location) => ({
      location,
      tools: tools.filter((tool) => tool.assigned_location_id === location.id),
    })),
    employeeOnly,
    unassigned: tools.filter((tool) => !toolEmployeeName(tool) && !toolHasAssignedLocation(tool, locations)),
  };
}

export function toolsVisibleInView(grouped: ReturnType<typeof groupToolsForView>) {
  return [
    ...grouped.employeeGroups.flatMap((group) => group.tools),
    ...grouped.locationGroups.flatMap((group) => group.tools),
    ...grouped.unassigned,
  ];
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
