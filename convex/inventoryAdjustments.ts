import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Upsert a baseline inventory level for a SKU
 * This represents the starting inventory at a point in time
 */
export const upsertBaseline = mutation({
  args: {
    sku: v.string(),
    quantity: v.number(),
    warehouse: v.string(),
    asOfDate: v.string(), // YYYY-MM-DD
    createdAt: v.string(),
  },
  handler: async (ctx, args) => {
    // Look for existing baseline for this SKU + warehouse
    const existing = await ctx.db
      .query("inventoryAdjustments")
      .withIndex("by_sku", (q) => q.eq("sku", args.sku))
      .filter((q) => 
        q.and(
          q.eq(q.field("adjustmentType"), "initial_baseline"),
          q.eq(q.field("reason"), args.warehouse)
        )
      )
      .first();

    if (existing) {
      // Update existing baseline
      await ctx.db.patch(existing._id, {
        quantity: args.quantity,
        createdAt: args.createdAt,
      });
      return existing._id;
    } else {
      // Create new baseline
      return await ctx.db.insert("inventoryAdjustments", {
        sku: args.sku,
        adjustmentType: "initial_baseline",
        quantity: args.quantity,
        reason: args.warehouse, // Store warehouse in reason field
        createdAt: args.createdAt,
        createdBy: `import-${args.asOfDate}`,
      });
    }
  },
});

/**
 * Get all baselines for a warehouse
 */
export const getBaselines = query({
  args: {
    warehouse: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("inventoryAdjustments")
      .filter((q) => q.eq(q.field("adjustmentType"), "initial_baseline"));

    const all = await query.collect();
    
    if (args.warehouse) {
      return all.filter(a => a.reason === args.warehouse);
    }
    return all;
  },
});

/**
 * Get baseline for a specific SKU
 */
export const getBaselineBySku = query({
  args: {
    sku: v.string(),
    warehouse: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const baselines = await ctx.db
      .query("inventoryAdjustments")
      .withIndex("by_sku", (q) => q.eq("sku", args.sku))
      .filter((q) => q.eq(q.field("adjustmentType"), "initial_baseline"))
      .collect();

    if (args.warehouse) {
      return baselines.find(b => b.reason === args.warehouse) || null;
    }
    return baselines[0] || null;
  },
});

/**
 * Clear all baselines (use with caution)
 */
export const clearBaselines = mutation({
  args: {
    warehouse: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("inventoryAdjustments")
      .filter((q) => q.eq(q.field("adjustmentType"), "initial_baseline"))
      .collect();

    let deleted = 0;
    for (const baseline of all) {
      if (!args.warehouse || baseline.reason === args.warehouse) {
        await ctx.db.delete(baseline._id);
        deleted++;
      }
    }
    return { deleted };
  },
});

/**
 * Add a manual adjustment
 */
export const addAdjustment = mutation({
  args: {
    sku: v.string(),
    adjustmentType: v.string(), // "add", "remove", "correction", "damage", etc.
    quantity: v.number(), // Positive = add, Negative = remove
    reason: v.optional(v.string()),
    createdBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("inventoryAdjustments", {
      sku: args.sku,
      adjustmentType: args.adjustmentType,
      quantity: args.quantity,
      reason: args.reason,
      createdAt: new Date().toISOString(),
      createdBy: args.createdBy,
    });
  },
});

/**
 * Get all adjustments for a SKU
 */
export const getBySku = query({
  args: {
    sku: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("inventoryAdjustments")
      .withIndex("by_sku", (q) => q.eq("sku", args.sku))
      .collect();
  },
});

/**
 * Get adjustment summary by SKU
 */
export const getSummary = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("inventoryAdjustments").collect();
    
    const summary: Record<string, {
      baseline: number;
      adjustments: number;
      total: number;
    }> = {};

    for (const adj of all) {
      if (!summary[adj.sku]) {
        summary[adj.sku] = { baseline: 0, adjustments: 0, total: 0 };
      }
      
      if (adj.adjustmentType === "initial_baseline") {
        summary[adj.sku].baseline = adj.quantity;
      } else {
        summary[adj.sku].adjustments += adj.quantity;
      }
      summary[adj.sku].total = summary[adj.sku].baseline + summary[adj.sku].adjustments;
    }

    return summary;
  },
});
