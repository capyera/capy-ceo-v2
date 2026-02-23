// Multi-Warehouse Types

export type WarehouseType = 'mars' | 'fba' | 'tts' | 'us3pl';

export interface Warehouse {
  id: string;
  code: WarehouseType;
  name: string;
  location: string;
  type: 'primary' | 'fulfillment' | 'marketplace';
  leadTimeDays: number;
  isActive: boolean;
  capabilities: WarehouseCapability[];
  costPerUnit?: number; // Storage/fulfillment cost
  apiConnected: boolean;
  lastSyncAt?: Date;
}

export type WarehouseCapability = 
  | 'shopify_fulfillment' 
  | 'amazon_fba' 
  | 'tiktok_fulfillment'
  | 'b2b_wholesale'
  | 'international';

export interface WarehouseInventory {
  id: string;
  sku: string;
  productName: string;
  warehouseId: string;
  warehouseCode: WarehouseType;
  
  // Stock levels
  quantity: number;
  reservedQty: number; // Allocated to orders
  availableQty: number; // quantity - reservedQty
  inboundQty: number; // In transit to warehouse
  
  // FBA-specific
  fbaInboundWorking?: number;
  fbaInboundShipped?: number;
  fbaInboundReceiving?: number;
  fbaUnfulfillable?: number;
  
  // Velocity & forecasting
  velocity3d: number;
  velocity7d: number;
  velocity14d: number;
  velocity30d: number;
  
  // Calculated fields
  daysOfStock: number;
  reorderPoint: number;
  stockStatus: StockStatus;
  
  lastUpdated: Date;
}

export type StockStatus = 
  | 'out_of_stock' 
  | 'critical' 
  | 'low' 
  | 'watch' 
  | 'good' 
  | 'overstock';

export interface CrossWarehouseInventory {
  sku: string;
  productName: string;
  category: string;
  
  // Totals across all warehouses
  totalQuantity: number;
  totalAvailable: number;
  totalInbound: number;
  totalReserved: number;
  
  // Combined velocity (all channels)
  combinedVelocity: number;
  totalDaysOfStock: number;
  
  // Per-warehouse breakdown
  warehouses: {
    [key in WarehouseType]?: {
      quantity: number;
      available: number;
      inbound: number;
      velocity: number;
      daysOfStock: number;
      status: StockStatus;
    };
  };
  
  // Allocation recommendations
  recommendedTransfers?: WarehouseTransfer[];
  stockoutRisk: StockoutRisk;
}

export interface WarehouseTransfer {
  id: string;
  fromWarehouse: WarehouseType;
  toWarehouse: WarehouseType;
  sku: string;
  productName: string;
  quantity: number;
  status: 'draft' | 'pending' | 'in_transit' | 'received' | 'cancelled';
  reason: TransferReason;
  estimatedArrival?: Date;
  createdAt: Date;
  cost?: number;
}

export type TransferReason = 
  | 'rebalance' 
  | 'stockout_prevention' 
  | 'fba_replenishment' 
  | 'seasonal_prep'
  | 'manual';

export interface StockoutRisk {
  level: 'none' | 'low' | 'medium' | 'high' | 'critical';
  daysUntilStockout: number;
  affectedWarehouses: WarehouseType[];
  estimatedLostRevenue?: number;
  recommendedAction?: string;
}

// Demand Planning Types
export interface DemandForecast {
  sku: string;
  productName: string;
  
  // Time-series forecast
  daily: DailyForecast[];
  weekly: WeeklyForecast[];
  monthly: MonthlyForecast[];
  
  // Forecast metadata
  forecastMethod: ForecastMethod;
  confidenceLevel: number; // 0-1
  lastUpdated: Date;
  
  // Seasonal patterns
  seasonalityIndex: number[]; // 12 months
  trendDirection: 'up' | 'down' | 'stable';
  trendStrength: number; // % change
}

export interface DailyForecast {
  date: string;
  predictedUnits: number;
  lowerBound: number;
  upperBound: number;
  isPromoDay?: boolean;
  isLaunchDay?: boolean;
}

export interface WeeklyForecast {
  weekStart: string;
  predictedUnits: number;
  lowerBound: number;
  upperBound: number;
}

export interface MonthlyForecast {
  month: string;
  year: number;
  predictedUnits: number;
  predictedRevenue: number;
  lowerBound: number;
  upperBound: number;
  seasonalFactor: number;
}

export type ForecastMethod = 
  | 'velocity_based' 
  | 'seasonal_decomposition' 
  | 'new_product_analog'
  | 'promotion_adjusted'
  | 'hybrid';

export interface InventoryPlan {
  sku: string;
  productName: string;
  
  // Current state
  currentInventory: number;
  currentVelocity: number;
  
  // Forecast demand (next 90 days)
  forecastDemand: number;
  
  // Supply
  onOrderQty: number;
  expectedReceiptDate?: Date;
  
  // Gap analysis
  inventoryGap: number; // negative = shortage
  coverageDays: number;
  
  // Recommendations
  recommendedOrderQty: number;
  recommendedOrderDate: Date;
  urgency: 'immediate' | 'this_week' | 'next_week' | 'on_track';
  
  // Risk
  stockoutProbability: number; // 0-1
  potentialLostSales: number;
}

export interface SeasonalPattern {
  sku: string;
  monthlyIndices: number[]; // 12 values, average = 1.0
  weekdayIndices: number[]; // 7 values, average = 1.0
  peakMonths: number[]; // Month indices (0-11)
  lowMonths: number[];
  yearOverYearGrowth: number;
}

export interface PromotionEvent {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  type: 'launch' | 'sale' | 'holiday' | 'marketing_push';
  expectedLift: number; // Multiplier (e.g., 1.5 = 50% increase)
  affectedSkus: string[];
  notes?: string;
}
