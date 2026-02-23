import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ============ SHOPIFY ORDER SYNC ============
  
  // Orders from Shopify
  orders: defineTable({
    shopifyOrderId: v.string(), // Shopify's order ID (numeric string)
    orderNumber: v.string(), // Human-readable order number (#1001, etc.)
    createdAt: v.string(), // ISO timestamp
    processedAt: v.optional(v.string()), // When payment was processed
    closedAt: v.optional(v.string()), // When order was closed
    cancelledAt: v.optional(v.string()), // When order was cancelled
    cancelReason: v.optional(v.string()), // Reason for cancellation
    financialStatus: v.string(), // pending, paid, partially_refunded, refunded, voided
    fulfillmentStatus: v.optional(v.string()), // null, partial, fulfilled
    totalPrice: v.number(), // Total including tax and shipping
    subtotalPrice: v.number(), // Subtotal before shipping/tax
    totalTax: v.number(), // Tax amount
    totalShipping: v.number(), // Shipping cost
    totalDiscounts: v.number(), // Total discounts applied
    currency: v.string(), // Currency code (USD, MYR, etc.)
    customerId: v.optional(v.string()), // Shopify customer ID
    customerEmail: v.optional(v.string()), // Customer email
    customerFirstOrder: v.optional(v.boolean()), // True if this is customer's first order
    shippingCountry: v.optional(v.string()), // Shipping country code
    shippingState: v.optional(v.string()), // Shipping state/province
    shippingPostcode: v.optional(v.string()), // Shipping postal/zip code
    customerOrdersCount: v.optional(v.number()), // Customer's lifetime orders at time of this order
    tags: v.optional(v.string()), // Order tags
    source: v.optional(v.string()), // Traffic source if available
    refundedAmount: v.number(), // Total amount refunded
    netAmount: v.number(), // totalPrice - refundedAmount
    lineItemCount: v.number(), // Number of line items
    totalQuantity: v.number(), // Total quantity of items
    syncedAt: v.string(), // When we last synced this order
  })
    .index("by_shopify_id", ["shopifyOrderId"])
    .index("by_order_number", ["orderNumber"])
    .index("by_created_at", ["createdAt"])
    .index("by_customer_id", ["customerId"])
    .index("by_financial_status", ["financialStatus"]),
  
  // Line items within orders
  orderLineItems: defineTable({
    orderId: v.id("orders"), // Reference to orders table
    shopifyLineItemId: v.string(), // Shopify's line item ID
    shopifyOrderId: v.string(), // Denormalized for easier querying
    sku: v.string(), // Product SKU
    variantId: v.optional(v.string()), // Shopify variant ID
    productId: v.optional(v.string()), // Shopify product ID
    title: v.string(), // Product title
    variantTitle: v.optional(v.string()), // Variant title
    quantity: v.number(), // Quantity ordered
    price: v.number(), // Unit price
    totalPrice: v.number(), // quantity * price
    totalDiscount: v.number(), // Discount applied to this line item
    netPrice: v.number(), // totalPrice - totalDiscount
    refundedQuantity: v.number(), // Quantity refunded (updated by refunds)
    netQuantity: v.number(), // quantity - refundedQuantity
    taxable: v.boolean(), // Whether this item is taxable
    grams: v.optional(v.number()), // Weight in grams
    syncedAt: v.string(), // When we last synced this line item
  })
    .index("by_order", ["orderId"])
    .index("by_shopify_order_id", ["shopifyOrderId"])
    .index("by_sku", ["sku"])
    .index("by_shopify_line_item_id", ["shopifyLineItemId"]),
  
  // Refunds on orders
  orderRefunds: defineTable({
    orderId: v.id("orders"), // Reference to orders table
    shopifyOrderId: v.string(), // Denormalized for easier querying
    shopifyRefundId: v.string(), // Shopify's refund ID
    createdAt: v.string(), // When refund was created
    processedAt: v.optional(v.string()), // When refund was processed
    note: v.optional(v.string()), // Refund note
    refundLineItems: v.array(v.object({
      lineItemId: v.string(), // Shopify line item ID
      sku: v.string(), // SKU of refunded item
      quantity: v.number(), // Quantity refunded
      subtotal: v.number(), // Subtotal refunded
      totalTax: v.number(), // Tax refunded
    })),
    totalRefunded: v.number(), // Total amount of this refund
    syncedAt: v.string(), // When we last synced this refund
  })
    .index("by_order", ["orderId"])
    .index("by_shopify_order_id", ["shopifyOrderId"])
    .index("by_shopify_refund_id", ["shopifyRefundId"])
    .index("by_created_at", ["createdAt"]),
  
  // Inventory movements (sales, refunds, cancellations, adjustments)
  inventoryMovements: defineTable({
    sku: v.string(), // Product SKU
    movementType: v.string(), // "sale" | "refund" | "cancellation" | "adjustment"
    quantity: v.number(), // Positive = stock in, Negative = stock out
    orderId: v.optional(v.id("orders")), // Reference to order (if applicable)
    shopifyOrderId: v.optional(v.string()), // Shopify order ID (if applicable)
    orderNumber: v.optional(v.string()), // Order number for display
    refundId: v.optional(v.id("orderRefunds")), // Reference to refund (if applicable)
    reason: v.optional(v.string()), // Reason for adjustment
    createdAt: v.string(), // When this movement occurred
    processedAt: v.string(), // When we processed this movement
  })
    .index("by_sku", ["sku"])
    .index("by_sku_and_created", ["sku", "createdAt"])
    .index("by_order", ["orderId"])
    .index("by_movement_type", ["movementType"])
    .index("by_created_at", ["createdAt"]),
  
  // SKU inventory summary (computed from movements)
  inventorySummary: defineTable({
    sku: v.string(), // Product SKU
    totalSold: v.number(), // Total units sold
    totalRefunded: v.number(), // Total units refunded
    totalCancelled: v.number(), // Total units from cancelled orders
    totalAdjustments: v.number(), // Manual adjustments
    netSold: v.number(), // totalSold - totalRefunded - totalCancelled
    lastMovementAt: v.optional(v.string()), // Last movement timestamp
    lastReconciliationAt: v.optional(v.string()), // Last reconciliation
    updatedAt: v.string(), // Last update timestamp
  })
    .index("by_sku", ["sku"]),
  
  // ============ EXISTING TABLES ============
  
  // App backup data (all localStorage data in one place)
  appBackups: defineTable({
    backupId: v.string(),
    userId: v.string(),
    data: v.string(), // JSON stringified app state
    createdAt: v.string(),
    description: v.optional(v.string()),
  }).index("by_user", ["userId"])
    .index("by_backup_id", ["backupId"]),

  // Bundle registry
  bundles: defineTable({
    bundleSku: v.string(),
    components: v.array(v.object({
      sku: v.string(),
      quantity: v.number(),
    })),
    isCustom: v.boolean(),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_sku", ["bundleSku"]),

  // Suppliers
  suppliers: defineTable({
    supplierId: v.string(),
    name: v.string(),
    contact: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    leadTimeDays: v.optional(v.number()),
    notes: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_supplier_id", ["supplierId"]),

  // Purchase Orders
  purchaseOrders: defineTable({
    poNumber: v.string(),
    supplierId: v.string(),
    status: v.string(),
    items: v.array(v.object({
      sku: v.string(),
      quantity: v.number(),
      unitCost: v.number(),
    })),
    totalCost: v.number(),
    orderDate: v.string(),
    expectedDate: v.optional(v.string()),
    receivedDate: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_po_number", ["poNumber"])
    .index("by_status", ["status"]),

  // Inventory adjustments/overrides
  inventoryAdjustments: defineTable({
    sku: v.string(),
    adjustmentType: v.string(),
    quantity: v.number(),
    reason: v.optional(v.string()),
    createdAt: v.string(),
    createdBy: v.optional(v.string()),
  }).index("by_sku", ["sku"]),

  // Product master data
  products: defineTable({
    sku: v.string(),
    name: v.string(),
    category: v.string(),
    subcategory: v.optional(v.string()),
    imageBase64: v.optional(v.string()),
    imageMimeType: v.optional(v.string()),
    cogs: v.number(),
    weight: v.number(),
    dimensions: v.object({
      length: v.number(),
      width: v.number(),
      height: v.number(),
    }),
    retailPrice: v.optional(v.number()),
    isActive: v.boolean(),
    notes: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_sku", ["sku"]),

  // Daily metrics (existing - schema matches Valencia daily reports)
  dailyMetrics: defineTable({
    date: v.string(),
    dayOfWeek: v.optional(v.string()),
    orders: v.number(),
    revenue: v.number(),
    adSpend: v.optional(v.number()),
    totalSpend: v.optional(v.number()),
    metaSpend: v.optional(v.number()),
    googleSpend: v.optional(v.number()),
    roas: v.number(),
    cm3: v.optional(v.number()),
    netProfit: v.optional(v.number()),
    newCustomers: v.optional(v.number()),
    returningCustomers: v.optional(v.number()),
    newCustomerOrders: v.optional(v.number()),
    returningCustomerOrders: v.optional(v.number()),
    newCustomerRevenue: v.optional(v.number()),
    returningCustomerRevenue: v.optional(v.number()),
    newCustomerAov: v.optional(v.number()),
    returningCustomerAov: v.optional(v.number()),
    newCustomerPercent: v.optional(v.number()),
    returningCustomerPercent: v.optional(v.number()),
    avgOrderValue: v.optional(v.number()),
    aov: v.optional(v.number()),
    unitsSold: v.optional(v.number()),
    cpa: v.optional(v.number()),
    cogsAndShipping: v.optional(v.number()),
    processingFees: v.optional(v.number()),
    dailyOpex: v.optional(v.number()),
    createdAt: v.optional(v.string()),
    updatedAt: v.optional(v.number()),
  }).index("by_date", ["date"]),

  // Inventory snapshots (point-in-time inventory state)
  inventorySnapshots: defineTable({
    timestamp: v.string(),
    inventory: v.array(v.object({
      sku: v.string(),
      current: v.number(),
      baseline: v.number(),
      sold: v.number(),
      pending: v.number(),
      velocity7d: v.number(),
      velocity30d: v.number(),
      daysOfStock: v.number(),
      parLevel: v.number(),
      status: v.string(),
    })),
  }).index("by_timestamp", ["timestamp"]),
});
