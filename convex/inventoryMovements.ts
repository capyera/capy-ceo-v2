import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Record a sale (deduct from inventory)
 */
export const recordSale = mutation({
  args: {
    sku: v.string(),
    quantity: v.number(),
    saleDate: v.string(), // YYYY-MM-DD
    source: v.optional(v.string()), // shopify_sync, manual, etc.
    orderId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    
    // Check for existing sale record for this SKU + date to avoid duplicates
    const existing = await ctx.db
      .query("inventoryMovements")
      .withIndex("by_sku", (q) => q.eq("sku", args.sku))
      .filter((q) => 
        q.and(
          q.eq(q.field("movementType"), "sale"),
          q.eq(q.field("reason"), `sales_${args.saleDate}`)
        )
      )
      .first();

    if (existing) {
      // Update existing record
      await ctx.db.patch(existing._id, {
        quantity: -args.quantity, // Negative for sales
        processedAt: now,
      });
      return existing._id;
    }

    // Create new movement record
    return await ctx.db.insert("inventoryMovements", {
      sku: args.sku,
      movementType: "sale",
      quantity: -args.quantity, // Negative for sales (stock out)
      reason: `sales_${args.saleDate}`,
      createdAt: `${args.saleDate}T23:59:59Z`,
      processedAt: now,
    });
  },
});

/**
 * Record a refund (add back to inventory)
 */
export const recordRefund = mutation({
  args: {
    sku: v.string(),
    quantity: v.number(),
    refundDate: v.string(),
    orderId: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();

    return await ctx.db.insert("inventoryMovements", {
      sku: args.sku,
      movementType: "refund",
      quantity: args.quantity, // Positive for refunds (stock in)
      shopifyOrderId: args.orderId,
      reason: args.reason || `refund_${args.refundDate}`,
      createdAt: `${args.refundDate}T12:00:00Z`,
      processedAt: now,
    });
  },
});

/**
 * Record an adjustment (manual correction)
 */
export const recordAdjustment = mutation({
  args: {
    sku: v.string(),
    quantity: v.number(), // Positive = add, Negative = remove
    reason: v.string(),
    adjustedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();

    return await ctx.db.insert("inventoryMovements", {
      sku: args.sku,
      movementType: "adjustment",
      quantity: args.quantity,
      reason: args.reason,
      createdAt: now,
      processedAt: now,
    });
  },
});

/**
 * Record inbound (goods received)
 */
export const recordInbound = mutation({
  args: {
    sku: v.string(),
    quantity: v.number(),
    poNumber: v.optional(v.string()),
    warehouse: v.optional(v.string()),
    receivedDate: v.string(),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();

    return await ctx.db.insert("inventoryMovements", {
      sku: args.sku,
      movementType: "inbound",
      quantity: args.quantity, // Positive for inbound
      reason: args.poNumber ? `PO_${args.poNumber}` : `inbound_${args.receivedDate}`,
      createdAt: `${args.receivedDate}T12:00:00Z`,
      processedAt: now,
    });
  },
});

/**
 * Get all movements for a SKU
 */
export const getBySku = query({
  args: {
    sku: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("inventoryMovements")
      .withIndex("by_sku", (q) => q.eq("sku", args.sku))
      .collect();
  },
});

/**
 * Get movements by date range
 */
export const getByDateRange = query({
  args: {
    fromDate: v.string(),
    toDate: v.string(),
    movementType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let movements = await ctx.db
      .query("inventoryMovements")
      .withIndex("by_created_at")
      .filter((q) => 
        q.and(
          q.gte(q.field("createdAt"), args.fromDate),
          q.lte(q.field("createdAt"), `${args.toDate}T23:59:59Z`)
        )
      )
      .collect();

    if (args.movementType) {
      movements = movements.filter(m => m.movementType === args.movementType);
    }

    return movements;
  },
});

/**
 * Get current inventory levels (baseline + movements)
 */
export const getCurrentLevels = query({
  args: {},
  handler: async (ctx) => {
    // Get all baselines
    const baselines = await ctx.db
      .query("inventoryAdjustments")
      .filter((q) => q.eq(q.field("adjustmentType"), "initial_baseline"))
      .collect();

    // Get all movements
    const movements = await ctx.db
      .query("inventoryMovements")
      .collect();

    // Calculate current levels
    const levels: Record<string, {
      baseline: number;
      sold: number;
      refunded: number;
      adjusted: number;
      inbound: number;
      current: number;
    }> = {};

    // Initialize from baselines
    for (const b of baselines) {
      levels[b.sku] = {
        baseline: b.quantity,
        sold: 0,
        refunded: 0,
        adjusted: 0,
        inbound: 0,
        current: b.quantity,
      };
    }

    // Apply movements
    for (const m of movements) {
      if (!levels[m.sku]) {
        levels[m.sku] = {
          baseline: 0,
          sold: 0,
          refunded: 0,
          adjusted: 0,
          inbound: 0,
          current: 0,
        };
      }

      const level = levels[m.sku];
      
      switch (m.movementType) {
        case "sale":
          level.sold += Math.abs(m.quantity);
          level.current += m.quantity; // quantity is negative for sales
          break;
        case "refund":
          level.refunded += m.quantity;
          level.current += m.quantity;
          break;
        case "adjustment":
          level.adjusted += m.quantity;
          level.current += m.quantity;
          break;
        case "inbound":
          level.inbound += m.quantity;
          level.current += m.quantity;
          break;
      }
    }

    return levels;
  },
});

/**
 * Clear all movements for a date (for re-sync)
 */
export const clearByDate = mutation({
  args: {
    saleDate: v.string(),
  },
  handler: async (ctx, args) => {
    const movements = await ctx.db
      .query("inventoryMovements")
      .filter((q) => q.eq(q.field("reason"), `sales_${args.saleDate}`))
      .collect();

    for (const m of movements) {
      await ctx.db.delete(m._id);
    }

    return { deleted: movements.length };
  },
});

/**
 * Get summary stats
 */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const movements = await ctx.db.query("inventoryMovements").collect();
    
    const byType: Record<string, { count: number; units: number }> = {};
    
    for (const m of movements) {
      if (!byType[m.movementType]) {
        byType[m.movementType] = { count: 0, units: 0 };
      }
      byType[m.movementType].count++;
      byType[m.movementType].units += m.quantity;
    }

    return {
      totalMovements: movements.length,
      byType,
    };
  },
});

// Sales report by date - what James needs
export const getSalesReport = query({
  args: {
    fromDate: v.string(),
    toDate: v.string(),
  },
  handler: async (ctx, args) => {
    const movements = await ctx.db
      .query("inventoryMovements")
      .filter(q => q.eq(q.field("movementType"), "sale"))
      .collect();
    
    // Filter by date range and group by date + SKU
    const byDate: Record<string, Record<string, number>> = {};
    const dateRevenue: Record<string, number> = {};
    
    for (const m of movements) {
      const date = m.createdAt?.split('T')[0] || 'unknown';
      if (date < args.fromDate || date > args.toDate) continue;
      
      byDate[date] = byDate[date] || {};
      byDate[date][m.sku] = (byDate[date][m.sku] || 0) + Math.abs(m.quantity);
    }
    
    // Format for display
    const report = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, skus]) => ({
        date,
        totalUnits: Object.values(skus).reduce((a, b) => a + b, 0),
        skuCount: Object.keys(skus).length,
        topSellers: Object.entries(skus)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 10)
          .map(([sku, qty]) => ({ sku, qty })),
      }));
    
    return report;
  },
});
