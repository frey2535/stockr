import { decodeOpsFromPersist, encodeOpsForPersist, projectsWithoutOpsBlob } from "./ops-state";
import {
  decodeToolsFromPersist,
  encodeToolsForPersist,
  projectsWithoutToolsBlob,
} from "./tools-state";
import type { Project, StoreState } from "./types";

export function encodeStateForPersist(state: StoreState): StoreState {
  return encodeToolsForPersist(encodeOpsForPersist(state));
}

export function decodeStateFromPersist(state: StoreState): StoreState {
  return decodeOpsFromPersist(decodeToolsFromPersist(state));
}

export function visibleProjects(projects: Project[]) {
  return projectsWithoutOpsBlob(projectsWithoutToolsBlob(projects));
}
