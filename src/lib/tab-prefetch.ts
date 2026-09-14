import { prefetchApi } from "./api-cache";
import { WORKSPACE_PAGE_SIZE } from "./types";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function prefetchTab(href: string) {
  const page = `${href.split("?")[0]}`;
  if (page === "/dashboard" || page === "/locations") {
    prefetchApi("/api/dashboard");
    return;
  }
  if (page === "/inventory") {
    prefetchApi(`/api/inventory?limit=${WORKSPACE_PAGE_SIZE}&offset=0`);
    return;
  }
  if (page === "/activity") {
    prefetchApi(`/api/activity?limit=${WORKSPACE_PAGE_SIZE}&offset=0`);
    return;
  }
  if (page === "/transfers") {
    prefetchApi("/api/activity?");
    return;
  }
  if (page === "/catalog") {
    prefetchApi(`/api/catalog?limit=${WORKSPACE_PAGE_SIZE}&offset=0`);
    return;
  }
  if (page === "/purchase-orders") {
    prefetchApi("/api/purchase-orders");
    return;
  }
  if (page === "/reports") {
    prefetchApi(`/api/reports?from=${daysAgo(90)}&to=${daysAgo(0)}`);
  }
}
