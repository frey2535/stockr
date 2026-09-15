export type LocationType = "warehouse" | "vehicle";
export type TxType = "add" | "transfer" | "use" | "adjust" | "shrink";
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

export type PlanId = "starter" | "pro" | "fleet";
export type MemberRole = "owner" | "admin" | "member";

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
