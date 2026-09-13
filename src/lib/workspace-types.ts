import type { Location, Material, Transaction } from "./types";

export type DashboardPayload = {
  totalItems: number;
  value: number;
  vehicles: number;
  warehouses: number;
  materialCount: number;
  alerts: Array<Material & { totalQty: number; status: "critical" | "reorder" }>;
  locations: Array<Location & { units: number; materialCount: number }>;
  recent: Transaction[];
  recentMaterials: Material[];
};

export type InventoryListPayload = {
  rows: {
    material: Material;
    byLocation: { location: Location; quantity: number }[];
    total: number;
  }[];
  total: number;
};

export type ActivityListPayload = {
  rows: Transaction[];
  total: number;
  materialNames: Record<string, string>;
};

export type CatalogListPayload = {
  rows: Material[];
  total: number;
  categories: string[];
  subcategories: string[];
  onHand: Record<string, number>;
};

export type MaterialLookupPayload = {
  rows: Material[];
};

export type PurchaseOrderListPayload = {
  rows: import("./types").PurchaseOrder[];
  total: number;
  materials: Material[];
};

export type ReportsPayload = {
  valuation: { location: string; type: string; totalQty: number; totalValue: number }[];
  grand: number;
  usage: [string, { qty: number; value: number }][];
  shrinkage: Array<Transaction & { materialName: string; locationName: string }>;
};
