export type LocationType = "warehouse" | "vehicle";
export type TxType = "add" | "transfer" | "use" | "adjust" | "shrink";
export type POStatus = "draft" | "ordered" | "partial" | "received" | "cancelled";
export type AccessCodeType = "trial" | "permanent";
export type ProjectStatus = "active" | "bidding" | "completed";

export type Settings = {
  company_name: string;
  logo_url: string;
  primary_color: string;
  accent_color: string;
  buildr_linked: boolean;
  buildr_company_id: string;
};

export type Location = {
  id: string;
  name: string;
  type: LocationType;
  description?: string;
  assigned_to?: string;
};

export type Material = {
  id: string;
  name: string;
  description?: string;
  category?: string;
  sub_category?: string;
  manufacturer?: string;
  supplier?: string;
  unit: string;
  unit_cost?: number | null;
  barcode?: string;
  reorder_point?: number | null;
  min_stock_level?: number | null;
  image_url?: string;
  aliases?: string[];
};

export type InventoryItem = {
  id: string;
  material_id: string;
  location_id: string;
  quantity: number;
};

export type Transaction = {
  id: string;
  type: TxType;
  material_id: string;
  quantity: number;
  from_location_id?: string | null;
  to_location_id?: string | null;
  project?: string | null;
  notes?: string;
  created_at: string;
  created_by: string;
};

export type POLine = {
  material_id: string;
  expected_quantity: number;
  received_quantity: number;
  unit_cost?: number;
};

export type PurchaseOrder = {
  id: string;
  po_number: string;
  supplier: string;
  expected_delivery?: string;
  status: POStatus;
  lines: POLine[];
  created_at: string;
};

export type AccessCode = {
  id: string;
  code: string;
  type: AccessCodeType;
  label: string;
  expires_at?: string | null;
  is_active: boolean;
  created_at: string;
};

export type Project = {
  id: string;
  name: string;
  project_number?: string;
  status: ProjectStatus;
};

export type StoreState = {
  settings: Settings;
  locations: Location[];
  materials: Material[];
  inventory: InventoryItem[];
  transactions: Transaction[];
  purchaseOrders: PurchaseOrder[];
  accessCodes: AccessCode[];
  projects: Project[];
};

export type InventoryAction = {
  type: TxType;
  materialId: string;
  quantity: number;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  project?: string | null;
  notes?: string;
};
