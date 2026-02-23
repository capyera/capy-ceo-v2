export interface Product {
  id: string;
  sku: string;
  name: string;
  category: 'plushie' | 'charm' | 'jumbo' | 'clothing' | 'accessory' | 'bundle';
  subcategory?: string;
  type: 'evergreen' | 'limited';
  price: number;
  cost: number;
  imageUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryItem {
  id: string;
  sku: string;
  productName: string;
  category: string;
  currentQty: number;
  inboundQty: number;
  poQty: number;
  totalAvailable: number;
  velocity3d: number;
  velocity7d: number;
  velocity14d: number;
  velocity30d: number;
  par3d: number;
  par7d: number;
  par14d: number;
  par30d: number;
  reorderPoint: number;
  reorderQty: number;
  lastUpdated: Date;
  cost?: number;
  price?: number;
}

export interface Bundle {
  id: string;
  sku: string;
  name: string;
  components: BundleComponent[];
  price: number;
  isActive: boolean;
}

export interface BundleComponent {
  sku: string;
  name: string;
  quantity: number;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  leadTimeDays: number;
  minOrderQty?: number;
  products: string[]; // SKUs they supply
  notes?: string;
  createdAt: Date;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplier: Supplier;
  items: PurchaseOrderItem[];
  status: 'draft' | 'sent' | 'confirmed' | 'partial' | 'complete' | 'cancelled';
  totalCost: number;
  expectedDate: Date;
  createdAt: Date;
  notes?: string;
}

export interface PurchaseOrderItem {
  sku: string;
  name: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  totalCost: number;
}

export interface COGSRecord {
  id: string;
  sku: string;
  productName: string;
  unitCost: number;
  unitPrice: number;
  margin: number;
  marginPercent: number;
  totalUnitsSold: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  period: string;
}

export interface Forecast {
  month: string;
  year: number;
  revenue: number;
  units: number;
  skuBreakdown: ForecastSKU[];
}

export interface ForecastSKU {
  sku: string;
  name: string;
  forecastUnits: number;
  currentInventory: number;
  inboundUnits: number;
  gap: number;
  canFulfill: boolean;
}

export interface DashboardStats {
  totalSKUs: number;
  totalUnits: number;
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  inboundValue: number;
  averageVelocity: number;
  turnoverRate: number;
}

export interface AlertItem {
  id: string;
  type: 'stockout' | 'low_stock' | 'reorder' | 'overstock' | 'velocity_change';
  severity: 'critical' | 'warning' | 'info';
  sku: string;
  productName: string;
  message: string;
  createdAt: Date;
  isRead: boolean;
}
