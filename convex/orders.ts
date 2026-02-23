/**
 * Order Sync Mutations and Queries
 * 
 * Handles syncing Shopify orders, refunds, and tracking inventory movements.
 * All timestamps are stored in ISO format but Shopify operates in PST.
 */

import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// ============ SYNC ORDER ============

/**
 * Sync a Shopify order to Convex
 * Creates/updates order, line items, and inventory movements
 */
export const syncOrder = mutation({
  args: {
    shopifyOrder: v.object({
      id: v.union(v.string(), v.number()),
      order_number: v.union(v.string(), v.number()),
      created_at: v.string(),
      processed_at: v.optional(v.string()),
      closed_at: v.optional(v.union(v.string(), v.null())),
      cancelled_at: v.optional(v.union(v.string(), v.null())),
      cancel_reason: v.optional(v.union(v.string(), v.null())),
      financial_status: v.string(),
      fulfillment_status: v.optional(v.union(v.string(), v.null())),
      total_price: v.string(),
      subtotal_price: v.string(),
      total_tax: v.string(),
      total_shipping_price_set: v.optional(v.object({
        shop_money: v.object({
          amount: v.string(),
          currency_code: v.string(),
        }),
      })),
      total_discounts: v.string(),
      currency: v.string(),
      customer: v.optional(v.union(v.object({
        id: v.union(v.string(), v.number()),
        email: v.optional(v.union(v.string(), v.null())),
        orders_count: v.optional(v.number()),
      }), v.null())),
      shipping_address: v.optional(v.union(v.object({
        country_code: v.optional(v.union(v.string(), v.null())),
        province_code: v.optional(v.union(v.string(), v.null())),
      }), v.null())),
      tags: v.optional(v.union(v.string(), v.null())),
      source_name: v.optional(v.union(v.string(), v.null())),
      refunds: v.optional(v.array(v.any())), // Will process separately
      line_items: v.array(v.object({
        id: v.union(v.string(), v.number()),
        sku: v.optional(v.union(v.string(), v.null())),
        variant_id: v.optional(v.union(v.string(), v.number(), v.null())),
        product_id: v.optional(v.union(v.string(), v.number(), v.null())),
        title: v.string(),
        variant_title: v.optional(v.union(v.string(), v.null())),
        quantity: v.number(),
        price: v.string(),
        total_discount: v.optional(v.string()),
        taxable: v.optional(v.boolean()),
        grams: v.optional(v.number()),
      })),
    }),
  },
  handler: async (ctx, args) => {
    const { shopifyOrder } = args;
    const now = new Date().toISOString();
    const shopifyOrderId = String(shopifyOrder.id);
    
    // Calculate totals
    const totalPrice = parseFloat(shopifyOrder.total_price);
    const subtotalPrice = parseFloat(shopifyOrder.subtotal_price);
    const totalTax = parseFloat(shopifyOrder.total_tax);
    const totalShipping = shopifyOrder.total_shipping_price_set?.shop_money
      ? parseFloat(shopifyOrder.total_shipping_price_set.shop_money.amount)
      : 0;
    const totalDiscounts = parseFloat(shopifyOrder.total_discounts);
    
    // Calculate refunded amount from refunds array
    let refundedAmount = 0;
    if (shopifyOrder.refunds && shopifyOrder.refunds.length > 0) {
      for (const refund of shopifyOrder.refunds) {
        if (refund.transactions) {
          for (const txn of refund.transactions) {
            if (txn.kind === 'refund' && txn.status === 'success') {
              refundedAmount += parseFloat(txn.amount || '0');
            }
          }
        }
      }
    }
    
    // Calculate total quantity
    const totalQuantity = shopifyOrder.line_items.reduce((sum, item) => sum + item.quantity, 0);
    
    // Check if order already exists
    const existingOrder = await ctx.db
      .query("orders")
      .withIndex("by_shopify_id", q => q.eq("shopifyOrderId", shopifyOrderId))
      .first();
    
    // Determine if this is a new customer (first order)
    const customerFirstOrder = shopifyOrder.customer?.orders_count === 1;
    
    // Prepare order data
    const orderData = {
      shopifyOrderId,
      orderNumber: String(shopifyOrder.order_number),
      createdAt: shopifyOrder.created_at,
      processedAt: shopifyOrder.processed_at || undefined,
      closedAt: shopifyOrder.closed_at || undefined,
      cancelledAt: shopifyOrder.cancelled_at || undefined,
      cancelReason: shopifyOrder.cancel_reason || undefined,
      financialStatus: shopifyOrder.financial_status,
      fulfillmentStatus: shopifyOrder.fulfillment_status || undefined,
      totalPrice,
      subtotalPrice,
      totalTax,
      totalShipping,
      totalDiscounts,
      currency: shopifyOrder.currency,
      customerId: shopifyOrder.customer ? String(shopifyOrder.customer.id) : undefined,
      customerEmail: shopifyOrder.customer?.email || undefined,
      customerFirstOrder,
      shippingCountry: shopifyOrder.shipping_address?.country_code || undefined,
      shippingState: shopifyOrder.shipping_address?.province_code || undefined,
      tags: shopifyOrder.tags || undefined,
      source: shopifyOrder.source_name || undefined,
      refundedAmount,
      netAmount: totalPrice - refundedAmount,
      lineItemCount: shopifyOrder.line_items.length,
      totalQuantity,
      syncedAt: now,
    };
    
    let orderId: Id<"orders">;
    const wasCancelled = existingOrder?.cancelledAt;
    const isNowCancelled = !!shopifyOrder.cancelled_at;
    
    if (existingOrder) {
      // Update existing order
      await ctx.db.patch(existingOrder._id, orderData);
      orderId = existingOrder._id;
    } else {
      // Create new order
      orderId = await ctx.db.insert("orders", orderData);
    }
    
    // Process line items
    const existingLineItems = await ctx.db
      .query("orderLineItems")
      .withIndex("by_order", q => q.eq("orderId", orderId))
      .collect();
    
    const existingLineItemMap = new Map(
      existingLineItems.map(item => [item.shopifyLineItemId, item])
    );
    
    // Track SKUs and quantities for inventory movements
    const lineItemsProcessed: Array<{ sku: string; quantity: number; lineItemId: Id<"orderLineItems"> }> = [];
    
    for (const lineItem of shopifyOrder.line_items) {
      const shopifyLineItemId = String(lineItem.id);
      const sku = lineItem.sku || `UNKNOWN-${shopifyLineItemId}`;
      const price = parseFloat(lineItem.price);
      const totalDiscount = parseFloat(lineItem.total_discount || '0');
      const totalLinePrice = price * lineItem.quantity;
      
      // Calculate refunded quantity for this line item
      let refundedQuantity = 0;
      if (shopifyOrder.refunds) {
        for (const refund of shopifyOrder.refunds) {
          if (refund.refund_line_items) {
            for (const refundItem of refund.refund_line_items) {
              if (String(refundItem.line_item_id) === shopifyLineItemId) {
                refundedQuantity += refundItem.quantity;
              }
            }
          }
        }
      }
      
      const lineItemData = {
        orderId,
        shopifyLineItemId,
        shopifyOrderId,
        sku,
        variantId: lineItem.variant_id ? String(lineItem.variant_id) : undefined,
        productId: lineItem.product_id ? String(lineItem.product_id) : undefined,
        title: lineItem.title,
        variantTitle: lineItem.variant_title || undefined,
        quantity: lineItem.quantity,
        price,
        totalPrice: totalLinePrice,
        totalDiscount,
        netPrice: totalLinePrice - totalDiscount,
        refundedQuantity,
        netQuantity: lineItem.quantity - refundedQuantity,
        taxable: lineItem.taxable ?? true,
        grams: lineItem.grams,
        syncedAt: now,
      };
      
      const existingLineItem = existingLineItemMap.get(shopifyLineItemId);
      let lineItemId: Id<"orderLineItems">;
      
      if (existingLineItem) {
        await ctx.db.patch(existingLineItem._id, lineItemData);
        lineItemId = existingLineItem._id;
      } else {
        lineItemId = await ctx.db.insert("orderLineItems", lineItemData);
      }
      
      lineItemsProcessed.push({ sku, quantity: lineItem.quantity, lineItemId });
    }
    
    // Create inventory movements for new orders (sale movement)
    if (!existingOrder && !isNowCancelled) {
      // New order that's not cancelled - record sales
      for (const item of lineItemsProcessed) {
        await ctx.db.insert("inventoryMovements", {
          sku: item.sku,
          movementType: "sale",
          quantity: -item.quantity, // Negative = stock out
          orderId,
          shopifyOrderId,
          orderNumber: String(shopifyOrder.order_number),
          createdAt: shopifyOrder.created_at,
          processedAt: now,
        });
        
        // Update inventory summary
        await updateInventorySummary(ctx, item.sku);
      }
    }
    
    // Handle cancellation movements
    if (!wasCancelled && isNowCancelled) {
      // Order just got cancelled - reverse the sale
      for (const item of lineItemsProcessed) {
        await ctx.db.insert("inventoryMovements", {
          sku: item.sku,
          movementType: "cancellation",
          quantity: item.quantity, // Positive = stock back in
          orderId,
          shopifyOrderId,
          orderNumber: String(shopifyOrder.order_number),
          reason: shopifyOrder.cancel_reason || "Order cancelled",
          createdAt: shopifyOrder.cancelled_at || now,
          processedAt: now,
        });
        
        await updateInventorySummary(ctx, item.sku);
      }
    }
    
    // Process refunds
    if (shopifyOrder.refunds && shopifyOrder.refunds.length > 0) {
      for (const refund of shopifyOrder.refunds) {
        await processRefundInternal(ctx, orderId, shopifyOrderId, refund, now);
      }
    }
    
    return {
      orderId,
      shopifyOrderId,
      orderNumber: String(shopifyOrder.order_number),
      isNew: !existingOrder,
      lineItemCount: lineItemsProcessed.length,
    };
  },
});

// ============ PROCESS REFUND ============

/**
 * Process a standalone refund webhook
 */
export const processRefund = mutation({
  args: {
    shopifyOrderId: v.string(),
    refund: v.object({
      id: v.union(v.string(), v.number()),
      created_at: v.string(),
      processed_at: v.optional(v.string()),
      note: v.optional(v.union(v.string(), v.null())),
      refund_line_items: v.optional(v.array(v.object({
        id: v.union(v.string(), v.number()),
        line_item_id: v.union(v.string(), v.number()),
        quantity: v.number(),
        subtotal: v.optional(v.number()),
        total_tax: v.optional(v.number()),
        line_item: v.optional(v.object({
          sku: v.optional(v.union(v.string(), v.null())),
        })),
      }))),
      transactions: v.optional(v.array(v.object({
        kind: v.string(),
        status: v.string(),
        amount: v.optional(v.string()),
      }))),
    }),
  },
  handler: async (ctx, args) => {
    const { shopifyOrderId, refund } = args;
    const now = new Date().toISOString();
    
    // Find the order
    const order = await ctx.db
      .query("orders")
      .withIndex("by_shopify_id", q => q.eq("shopifyOrderId", shopifyOrderId))
      .first();
    
    if (!order) {
      console.log(`Order ${shopifyOrderId} not found for refund processing`);
      return { success: false, error: "Order not found" };
    }
    
    return await processRefundInternal(ctx, order._id, shopifyOrderId, refund, now);
  },
});

/**
 * Internal refund processing (shared by syncOrder and processRefund)
 */
async function processRefundInternal(
  ctx: { db: any },
  orderId: Id<"orders">,
  shopifyOrderId: string,
  refund: {
    id: string | number;
    created_at: string;
    processed_at?: string;
    note?: string | null;
    refund_line_items?: Array<{
      id: string | number;
      line_item_id: string | number;
      quantity: number;
      subtotal?: number;
      total_tax?: number;
      line_item?: { sku?: string | null };
    }>;
    transactions?: Array<{
      kind: string;
      status: string;
      amount?: string;
    }>;
  },
  now: string
) {
  const shopifyRefundId = String(refund.id);
  
  // Check if we already processed this refund
  const existingRefund = await ctx.db
    .query("orderRefunds")
    .withIndex("by_shopify_refund_id", (q: any) => q.eq("shopifyRefundId", shopifyRefundId))
    .first();
  
  if (existingRefund) {
    return { success: true, refundId: existingRefund._id, alreadyProcessed: true };
  }
  
  // Get line items for SKU lookup
  const lineItems: Array<{
    _id: Id<"orderLineItems">;
    shopifyLineItemId: string;
    sku: string;
    quantity: number;
    refundedQuantity: number;
  }> = await ctx.db
    .query("orderLineItems")
    .withIndex("by_shopify_order_id", (q: any) => q.eq("shopifyOrderId", shopifyOrderId))
    .collect();
  
  const lineItemMap = new Map(
    lineItems.map((item) => [item.shopifyLineItemId, item])
  );
  
  // Process refund line items
  const refundLineItems: Array<{
    lineItemId: string;
    sku: string;
    quantity: number;
    subtotal: number;
    totalTax: number;
  }> = [];
  
  let totalRefunded = 0;
  
  if (refund.refund_line_items) {
    for (const refundItem of refund.refund_line_items) {
      const lineItemId = String(refundItem.line_item_id);
      const lineItem = lineItemMap.get(lineItemId);
      const sku = refundItem.line_item?.sku || lineItem?.sku || `UNKNOWN-${lineItemId}`;
      const subtotal = refundItem.subtotal || 0;
      const totalTax = refundItem.total_tax || 0;
      
      refundLineItems.push({
        lineItemId,
        sku,
        quantity: refundItem.quantity,
        subtotal,
        totalTax,
      });
      
      totalRefunded += subtotal + totalTax;
      
      // Create inventory movement for refund
      await ctx.db.insert("inventoryMovements", {
        sku,
        movementType: "refund",
        quantity: refundItem.quantity, // Positive = stock back in
        orderId,
        shopifyOrderId,
        reason: refund.note || "Refund processed",
        createdAt: refund.created_at,
        processedAt: now,
      });
      
      // Update the line item's refunded quantity
      if (lineItem) {
        const newRefundedQty = lineItem.refundedQuantity + refundItem.quantity;
        await ctx.db.patch(lineItem._id, {
          refundedQuantity: newRefundedQty,
          netQuantity: lineItem.quantity - newRefundedQty,
          syncedAt: now,
        });
      }
      
      // Update inventory summary
      await updateInventorySummary(ctx, sku);
    }
  }
  
  // Calculate total from transactions if available
  if (refund.transactions) {
    totalRefunded = 0;
    for (const txn of refund.transactions) {
      if (txn.kind === 'refund' && txn.status === 'success') {
        totalRefunded += parseFloat(txn.amount || '0');
      }
    }
  }
  
  // Create refund record
  const refundId = await ctx.db.insert("orderRefunds", {
    orderId,
    shopifyOrderId,
    shopifyRefundId,
    createdAt: refund.created_at,
    processedAt: refund.processed_at,
    note: refund.note || undefined,
    refundLineItems,
    totalRefunded,
    syncedAt: now,
  });
  
  // Update order's refunded amount
  const order = await ctx.db.get(orderId);
  if (order) {
    const newRefundedAmount = order.refundedAmount + totalRefunded;
    await ctx.db.patch(orderId, {
      refundedAmount: newRefundedAmount,
      netAmount: order.totalPrice - newRefundedAmount,
      syncedAt: now,
    });
  }
  
  return { success: true, refundId, refundLineItemCount: refundLineItems.length };
}

/**
 * Update inventory summary for a SKU
 */
async function updateInventorySummary(ctx: { db: any }, sku: string) {
  const now = new Date().toISOString();
  
  // Get all movements for this SKU
  const movements: Array<{
    sku: string;
    movementType: string;
    quantity: number;
    createdAt: string;
  }> = await ctx.db
    .query("inventoryMovements")
    .withIndex("by_sku", (q: any) => q.eq("sku", sku))
    .collect();
  
  // Calculate totals
  let totalSold = 0;
  let totalRefunded = 0;
  let totalCancelled = 0;
  let totalAdjustments = 0;
  let lastMovementAt: string | undefined;
  
  for (const m of movements) {
    if (!lastMovementAt || m.createdAt > lastMovementAt) {
      lastMovementAt = m.createdAt;
    }
    
    switch (m.movementType) {
      case "sale":
        totalSold += Math.abs(m.quantity);
        break;
      case "refund":
        totalRefunded += Math.abs(m.quantity);
        break;
      case "cancellation":
        totalCancelled += Math.abs(m.quantity);
        break;
      case "adjustment":
        totalAdjustments += m.quantity;
        break;
    }
  }
  
  const netSold = totalSold - totalRefunded - totalCancelled;
  
  // Update or create summary
  const existingSummary: { _id: Id<"inventorySummary"> } | null = await ctx.db
    .query("inventorySummary")
    .withIndex("by_sku", (q: any) => q.eq("sku", sku))
    .first();
  
  const summaryData = {
    sku,
    totalSold,
    totalRefunded,
    totalCancelled,
    totalAdjustments,
    netSold,
    lastMovementAt,
    updatedAt: now,
  };
  
  if (existingSummary) {
    await ctx.db.patch(existingSummary._id, summaryData);
  } else {
    await ctx.db.insert("inventorySummary", summaryData);
  }
}

// ============ QUERIES ============

/**
 * Get inventory summary by SKU
 */
export const getInventoryBySku = query({
  args: { sku: v.string() },
  handler: async (ctx, args) => {
    const summary = await ctx.db
      .query("inventorySummary")
      .withIndex("by_sku", q => q.eq("sku", args.sku))
      .first();
    
    if (!summary) {
      return null;
    }
    
    // Get recent movements
    const recentMovements = await ctx.db
      .query("inventoryMovements")
      .withIndex("by_sku", q => q.eq("sku", args.sku))
      .order("desc")
      .take(20);
    
    return {
      ...summary,
      recentMovements,
    };
  },
});

/**
 * Get all inventory summaries
 */
export const getAllInventorySummaries = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("inventorySummary").collect();
  },
});

/**
 * Get orders by date range
 */
export const getOrdersByDateRange = query({
  args: {
    startDate: v.string(), // ISO date string
    endDate: v.string(), // ISO date string
  },
  handler: async (ctx, args) => {
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_created_at")
      .filter(q => 
        q.and(
          q.gte(q.field("createdAt"), args.startDate),
          q.lte(q.field("createdAt"), args.endDate)
        )
      )
      .collect();
    
    return orders;
  },
});

/**
 * Count orders using index range (efficient)
 */
export const countOrdersInRange = query({
  args: {
    startTime: v.string(),
    endTime: v.string(),
  },
  handler: async (ctx, args) => {
    // Use index range expression for efficient querying
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_created_at", q => 
        q.gte("createdAt", args.startTime).lt("createdAt", args.endTime)
      )
      .take(5000);
    
    return { 
      count: orders.length,
      totalRevenue: orders.reduce((sum, o) => sum + (o.totalPrice || 0), 0)
    };
  },
});

/**
 * Get total order count (estimate via sampling)
 */
export const getTotalOrderCount = query({
  args: {},
  handler: async (ctx) => {
    const sample = await ctx.db.query("orders").take(10000);
    return { 
      sampleCount: sample.length, 
      message: sample.length === 10000 ? "10K+ orders exist" : `${sample.length} orders total` 
    };
  },
});

/**
 * Get order by Shopify ID
 */
export const getOrderByShopifyId = query({
  args: { shopifyOrderId: v.string() },
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("orders")
      .withIndex("by_shopify_id", q => q.eq("shopifyOrderId", args.shopifyOrderId))
      .first();
    
    if (!order) return null;
    
    // Get line items
    const lineItems = await ctx.db
      .query("orderLineItems")
      .withIndex("by_order", q => q.eq("orderId", order._id))
      .collect();
    
    // Get refunds
    const refunds = await ctx.db
      .query("orderRefunds")
      .withIndex("by_order", q => q.eq("orderId", order._id))
      .collect();
    
    return {
      ...order,
      lineItems,
      refunds,
    };
  },
});

/**
 * Get inventory movements by date range
 */
export const getMovementsByDateRange = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
    sku: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("inventoryMovements")
      .withIndex("by_created_at")
      .filter(q =>
        q.and(
          q.gte(q.field("createdAt"), args.startDate),
          q.lte(q.field("createdAt"), args.endDate)
        )
      );
    
    const movements = await query.collect();
    
    if (args.sku) {
      return movements.filter(m => m.sku === args.sku);
    }
    
    return movements;
  },
});

// ============ RECONCILIATION ============

/**
 * Reconcile inventory for a SKU
 * Recalculates all movements from orders
 */
export const reconcileInventory = mutation({
  args: { sku: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const results: Array<{ sku: string; before: any; after: any }> = [];
    
    // Get all SKUs to reconcile
    let skusToReconcile: string[] = [];
    
    if (args.sku) {
      skusToReconcile = [args.sku];
    } else {
      // Get all unique SKUs from line items
      const lineItems = await ctx.db.query("orderLineItems").collect();
      skusToReconcile = [...new Set(lineItems.map(li => li.sku))];
    }
    
    for (const sku of skusToReconcile) {
      // Get current summary
      const currentSummary = await ctx.db
        .query("inventorySummary")
        .withIndex("by_sku", q => q.eq("sku", sku))
        .first();
      
      // Recalculate from line items and refunds
      const lineItems = await ctx.db
        .query("orderLineItems")
        .withIndex("by_sku", q => q.eq("sku", sku))
        .collect();
      
      let totalSold = 0;
      let totalRefunded = 0;
      let totalCancelled = 0;
      
      for (const li of lineItems) {
        // Get the order to check if cancelled
        const order = await ctx.db.get(li.orderId);
        
        if (order?.cancelledAt) {
          // Order is cancelled - don't count as sold
          continue;
        }
        
        totalSold += li.quantity;
        totalRefunded += li.refundedQuantity;
      }
      
      const netSold = totalSold - totalRefunded;
      
      // Get manual adjustments from movements
      const adjustmentMovements = await ctx.db
        .query("inventoryMovements")
        .withIndex("by_sku", q => q.eq("sku", sku))
        .filter(q => q.eq(q.field("movementType"), "adjustment"))
        .collect();
      
      const totalAdjustments = adjustmentMovements.reduce((sum, m) => sum + m.quantity, 0);
      
      const newSummary = {
        sku,
        totalSold,
        totalRefunded,
        totalCancelled,
        totalAdjustments,
        netSold,
        lastReconciliationAt: now,
        updatedAt: now,
      };
      
      if (currentSummary) {
        await ctx.db.patch(currentSummary._id, newSummary);
      } else {
        await ctx.db.insert("inventorySummary", newSummary);
      }
      
      results.push({
        sku,
        before: currentSummary ? {
          totalSold: currentSummary.totalSold,
          totalRefunded: currentSummary.totalRefunded,
          netSold: currentSummary.netSold,
        } : null,
        after: {
          totalSold,
          totalRefunded,
          netSold,
        },
      });
    }
    
    return {
      reconciled: results.length,
      results,
    };
  },
});

/**
 * Manual inventory adjustment
 */
export const adjustInventory = mutation({
  args: {
    sku: v.string(),
    quantity: v.number(), // Positive = add stock, Negative = remove stock
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    
    // Create movement
    await ctx.db.insert("inventoryMovements", {
      sku: args.sku,
      movementType: "adjustment",
      quantity: args.quantity,
      reason: args.reason,
      createdAt: now,
      processedAt: now,
    });
    
    // Update summary
    await updateInventorySummary(ctx, args.sku);
    
    return { success: true };
  },
});

// ============ FAST UPSERT FOR BACKFILL ============

/**
 * Upsert an order (fast version for backfill, no inventory movements)
 */
export const upsertOrder = mutation({
  args: {
    shopifyOrderId: v.string(),
    orderNumber: v.string(),
    createdAt: v.string(),
    processedAt: v.optional(v.string()),
    closedAt: v.optional(v.string()),
    cancelledAt: v.optional(v.string()),
    cancelReason: v.optional(v.string()),
    financialStatus: v.string(),
    fulfillmentStatus: v.optional(v.string()),
    totalPrice: v.number(),
    subtotalPrice: v.number(),
    totalTax: v.number(),
    totalShipping: v.number(),
    totalDiscounts: v.number(),
    currency: v.string(),
    customerId: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    customerFirstOrder: v.optional(v.boolean()),
    shippingCountry: v.optional(v.string()),
    shippingState: v.optional(v.string()),
    shippingPostcode: v.optional(v.string()),
    customerOrdersCount: v.optional(v.number()),
    tags: v.optional(v.string()),
    source: v.optional(v.string()),
    refundedAmount: v.number(),
    netAmount: v.number(),
    lineItemCount: v.number(),
    totalQuantity: v.number(),
    syncedAt: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if exists
    const existing = await ctx.db
      .query("orders")
      .withIndex("by_shopify_id", q => q.eq("shopifyOrderId", args.shopifyOrderId))
      .first();
    
    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    } else {
      return await ctx.db.insert("orders", args);
    }
  },
});

/**
 * Upsert a line item (fast version for backfill)
 */
export const upsertLineItem = mutation({
  args: {
    orderId: v.union(v.id("orders"), v.null()),
    shopifyLineItemId: v.string(),
    shopifyOrderId: v.string(),
    sku: v.string(),
    variantId: v.optional(v.string()),
    productId: v.optional(v.string()),
    title: v.string(),
    variantTitle: v.optional(v.string()),
    quantity: v.number(),
    price: v.number(),
    totalPrice: v.number(),
    totalDiscount: v.number(),
    netPrice: v.number(),
    refundedQuantity: v.number(),
    netQuantity: v.number(),
    taxable: v.boolean(),
    grams: v.optional(v.number()),
    syncedAt: v.string(),
  },
  handler: async (ctx, args) => {
    // Look up orderId if not provided
    let orderId = args.orderId;
    if (!orderId) {
      const order = await ctx.db
        .query("orders")
        .withIndex("by_shopify_id", q => q.eq("shopifyOrderId", args.shopifyOrderId))
        .first();
      if (order) {
        orderId = order._id;
      }
    }
    
    // Check if exists
    const existing = await ctx.db
      .query("orderLineItems")
      .withIndex("by_shopify_line_item_id", q => q.eq("shopifyLineItemId", args.shopifyLineItemId))
      .first();
    
    const data = { ...args, orderId: orderId || args.orderId };
    
    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    } else {
      return await ctx.db.insert("orderLineItems", data as any);
    }
  },
});

/**
 * Clear all order data (for re-sync)
 */
export const clearOrderData = mutation({
  args: { confirm: v.literal("I understand this will delete all order data") },
  handler: async (ctx) => {
    // Delete all movements
    const movements = await ctx.db.query("inventoryMovements").collect();
    for (const m of movements) {
      await ctx.db.delete(m._id);
    }
    
    // Delete all summaries
    const summaries = await ctx.db.query("inventorySummary").collect();
    for (const s of summaries) {
      await ctx.db.delete(s._id);
    }
    
    // Delete all refunds
    const refunds = await ctx.db.query("orderRefunds").collect();
    for (const r of refunds) {
      await ctx.db.delete(r._id);
    }
    
    // Delete all line items
    const lineItems = await ctx.db.query("orderLineItems").collect();
    for (const li of lineItems) {
      await ctx.db.delete(li._id);
    }
    
    // Delete all orders
    const orders = await ctx.db.query("orders").collect();
    for (const o of orders) {
      await ctx.db.delete(o._id);
    }
    
    return {
      deleted: {
        orders: orders.length,
        lineItems: lineItems.length,
        refunds: refunds.length,
        movements: movements.length,
        summaries: summaries.length,
      },
    };
  },
});

// Quick line item sample (avoid hitting limits)
export const getLineItemCount = query({
  args: {},
  handler: async (ctx) => {
    // Just take first page to see if we have data
    const sample = await ctx.db.query("orderLineItems").take(5);
    return {
      hasData: sample.length > 0,
      sample: sample.map(item => ({ sku: item.sku, quantity: item.quantity, orderId: item.shopifyOrderId })),
    };
  },
});
