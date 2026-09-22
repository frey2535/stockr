export type LocationType = "warehouse" | "vehicle";
export type TxType =
  | "add"
  | "receive"
  | "return"
  | "transfer"
  | "use"
  | "adjust"
  | "count"
  | "shrink";
export type POStatus = "draft" | "ordered" | "partial" | "received" | "cancelled";
export type AccessCodeType = "trial" | "permanent";
export type ProjectStatus = "active" | "bidding" | "completed";
export type ToolStatus = "available" | "checked_out" | "maintenance";

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
  mpn?: string;
  upc?: string;
  supplier_number?: string;
  reorder_point?: number | null;
  min_stock_level?: number | null;
  image_url?: string;
  aliases?: string[];
};

export type IdentifiedProduct = {
  name: string;
  brand?: string;
  manufacturer?: string;
  category?: string;
  description?: string;
  image_url?: string;
  barcode: string;
  upc?: string;
  mpn?: string;
  source: string;
};

export type StockRule = {
  id: string;
  material_id: string;
  location_id: string;
  min: number;
  max?: number | null;
};

export type RestockNeed = {
  id: string;
  materialId: string;
  materialName: string;
  unit: string;
  locationId: string;
  locationName: string;
  locationType: LocationType;
  onHand: number;
  min: number;
  max: number;
  need: number;
  suggestion:
    | {
        kind: "transfer";
        fromLocationId: string;
        fromLocationName: string;
        quantity: number;
        available: number;
      }
    | { kind: "draft_po"; supplier: string; quantity: number };
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

export type Tool = {
  id: string;
  name: string;
  description?: string;
  category?: string;
  barcode?: string;
  assigned_location_id: string;
  assigned_to?: string;
  status: ToolStatus;
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
  tools: Tool[];
  stockRules: StockRule[];
};

export type WorkspaceCounts = {
  locations: number;
  materials: number;
  inventoryRows: number;
  transactions: number;
  purchaseOrders: number;
  tools: number;
};

export type WorkspaceShell = {
  settings: Settings;
  locations: Location[];
  projects: Project[];
  accessCodes: AccessCode[];
  tools: Tool[];
  stockRules: StockRule[];
  counts: WorkspaceCounts;
};

export const WORKSPACE_PAGE_SIZE = 50;

export type InventoryAction = {
  type: TxType;
  materialId: string;
  quantity: number;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  project?: string | null;
  notes?: string;
};

export type RestockApply = {
  kind: "transfer" | "draft_po";
  materialId: string;
  locationId: string;
  quantity: number;
  fromLocationId?: string;
  supplier?: string;
};

export type PlanId = "starter" | "pro" | "fleet";
export type MemberRole = "owner" | "admin" | "inventory_admin" | "warehouse_manager" | "foreman" | "technician" | "viewer" | "member";

export type AccountUser = {
  id: string;
  email: string;
  name: string;
};

export type AccountCompany = {
  id: string;
  name: string;
  slug: string;
  plan: PlanId;
  planStatus: "trialing" | "active" | "past_due";
};

export type TeamMember = {
  id: string;
  email: string;
  name: string;
  role: MemberRole;
};

export type DataBackend = "supabase" | "sqlite";

export type Account = {
  user: AccountUser;
  company: AccountCompany;
  role: MemberRole;
  members: TeamMember[];
  dataBackend: DataBackend;
  platformOwner: boolean;
};

export type PlatformCompany = {
  id: string;
  name: string;
  slug: string;
  plan: PlanId;
  planStatus: AccountCompany["planStatus"];
  memberCount: number;
};


export type InventoryPermission =
  | "inventory.read"
  | "inventory.adjust"
  | "inventory.transfer"
  | "inventory.reserve"
  | "inventory.count"
  | "requests.create"
  | "requests.fulfill"
  | "catalog.manage"
  | "tools.manage"
  | "purchasing.manage"
  | "reports.view"
  | "settings.manage";

export type StorageZone = {
  id: string;
  company_id: string;
  location_id: string;
  name: string;
  code?: string | null;
  sort_order: number;
};

export type StorageBin = {
  id: string;
  company_id: string;
  location_id: string;
  zone_id?: string | null;
  name: string;
  code: string;
  barcode?: string | null;
  description?: string | null;
  is_active: boolean;
};

export type InventoryReservation = {
  id: string;
  company_id: string;
  material_id: string;
  location_id: string;
  project_id?: string | null;
  quantity: number;
  status: "active" | "released" | "consumed";
  notes?: string | null;
  created_by: string;
  created_at: string;
};

export type MaterialRequestStatus =
  | "requested"
  | "approved"
  | "picking"
  | "staged"
  | "in_transit"
  | "fulfilled"
  | "cancelled";

export type MaterialRequest = {
  id: string;
  company_id: string;
  project_id?: string | null;
  destination_location_id?: string | null;
  requested_by: string;
  priority: "normal" | "urgent" | "critical";
  status: MaterialRequestStatus;
  notes?: string | null;
  created_at: string;
};

export type MaterialRequestLine = {
  id: string;
  request_id: string;
  company_id: string;
  material_id: string;
  quantity_requested: number;
  quantity_fulfilled: number;
};

export type CycleCountStatus = "open" | "submitted" | "approved" | "cancelled";

export type CycleCountSession = {
  id: string;
  company_id: string;
  location_id: string;
  zone_id?: string | null;
  bin_id?: string | null;
  status: CycleCountStatus;
  created_by: string;
  created_at: string;
  submitted_at?: string | null;
};

export type CycleCountLine = {
  id: string;
  session_id: string;
  company_id: string;
  material_id: string;
  expected_quantity: number;
  counted_quantity?: number | null;
};

export type FieldOpsPayload = {
  zones: StorageZone[];
  bins: StorageBin[];
  reservations: InventoryReservation[];
  requests: Array<MaterialRequest & { lines: MaterialRequestLine[] }>;
  countSessions: Array<CycleCountSession & { lines: CycleCountLine[] }>;
  materials: Array<{ id: string; name: string }>;
};
