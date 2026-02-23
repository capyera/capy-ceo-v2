import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Upsert a purchase order
 */
export const upsert = mutation({
  args: {
    poNumber: v.string(),
    supplierId: v.string(),
    status: v.string(), // draft, sent, confirmed, partial, complete, cancelled
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
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    
    // Look for existing PO
    const existing = await ctx.db
      .query("purchaseOrders")
      .withIndex("by_po_number", (q) => q.eq("poNumber", args.poNumber))
      .first();

    if (existing) {
      // Update existing PO
      await ctx.db.patch(existing._id, {
        supplierId: args.supplierId,
        status: args.status,
        items: args.items,
        totalCost: args.totalCost,
        orderDate: args.orderDate,
        expectedDate: args.expectedDate,
        receivedDate: args.receivedDate,
        notes: args.notes,
        updatedAt: now,
      });
      return existing._id;
    } else {
      // Create new PO
      return await ctx.db.insert("purchaseOrders", {
        poNumber: args.poNumber,
        supplierId: args.supplierId,
        status: args.status,
        items: args.items,
        totalCost: args.totalCost,
        orderDate: args.orderDate,
        expectedDate: args.expectedDate,
        receivedDate: args.receivedDate,
        notes: args.notes,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

/**
 * Get all purchase orders
 */
export const getAll = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("purchaseOrders")
        .withIndex("by_status", (q) => q.eq("status", args.status))
        .collect();
    }
    return await ctx.db.query("purchaseOrders").collect();
  },
});

/**
 * Get PO by number
 */
export const getByNumber = query({
  args: {
    poNumber: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("purchaseOrders")
      .withIndex("by_po_number", (q) => q.eq("poNumber", args.poNumber))
      .first();
  },
});

/**
 * Get pending units by SKU (sum of all confirmed/partial POs)
 */
export const getPendingBySku = query({
  args: {},
  handler: async (ctx) => {
    const pos = await ctx.db
      .query("purchaseOrders")
      .filter((q) => 
        q.or(
          q.eq(q.field("status"), "confirmed"),
          q.eq(q.field("status"), "partial"),
          q.eq(q.field("status"), "sent")
        )
      )
      .collect();

    const skuTotals: Record<string, { pending: number; pos: string[] }> = {};

    for (const po of pos) {
      for (const item of po.items) {
        if (!skuTotals[item.sku]) {
          skuTotals[item.sku] = { pending: 0, pos: [] };
        }
        skuTotals[item.sku].pending += item.quantity;
        if (!skuTotals[item.sku].pos.includes(po.poNumber)) {
          skuTotals[item.sku].pos.push(po.poNumber);
        }
      }
    }

    return skuTotals;
  },
});

/**
 * Update PO status
 */
export const updateStatus = mutation({
  args: {
    poNumber: v.string(),
    status: v.string(),
    receivedDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const po = await ctx.db
      .query("purchaseOrders")
      .withIndex("by_po_number", (q) => q.eq("poNumber", args.poNumber))
      .first();

    if (!po) throw new Error(`PO ${args.poNumber} not found`);

    await ctx.db.patch(po._id, {
      status: args.status,
      receivedDate: args.receivedDate,
      updatedAt: new Date().toISOString(),
    });

    return po._id;
  },
});

/**
 * Delete a PO
 */
export const remove = mutation({
  args: {
    poNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const po = await ctx.db
      .query("purchaseOrders")
      .withIndex("by_po_number", (q) => q.eq("poNumber", args.poNumber))
      .first();

    if (po) {
      await ctx.db.delete(po._id);
      return true;
    }
    return false;
  },
});

/**
 * Get summary stats
 */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("purchaseOrders").collect();
    
    const byStatus: Record<string, number> = {};
    let totalPending = 0;
    let totalValue = 0;

    for (const po of all) {
      byStatus[po.status] = (byStatus[po.status] || 0) + 1;
      
      if (["confirmed", "partial", "sent"].includes(po.status)) {
        totalPending += po.items.reduce((sum, i) => sum + i.quantity, 0);
        totalValue += po.totalCost;
      }
    }

    return {
      totalPOs: all.length,
      byStatus,
      totalPendingUnits: totalPending,
      totalPendingValue: totalValue,
    };
  },
});
