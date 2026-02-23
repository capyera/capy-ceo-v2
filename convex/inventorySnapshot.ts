import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Save a point-in-time inventory snapshot
 */
export const save = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    // Delete old snapshots (keep last 48 hours = 192 snapshots at 15min intervals)
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const oldSnapshots = await ctx.db
      .query("inventorySnapshots")
      .filter((q) => q.lt(q.field("timestamp"), cutoff))
      .collect();
    
    for (const snap of oldSnapshots) {
      await ctx.db.delete(snap._id);
    }

    // Save new snapshot
    return await ctx.db.insert("inventorySnapshots", {
      timestamp: args.timestamp,
      inventory: args.inventory,
    });
  },
});

/**
 * Get latest snapshot
 */
export const getLatest = query({
  args: {},
  handler: async (ctx) => {
    const snapshots = await ctx.db
      .query("inventorySnapshots")
      .order("desc")
      .first();
    return snapshots;
  },
});

/**
 * Get inventory for a specific SKU (from latest snapshot)
 */
export const getBySku = query({
  args: { sku: v.string() },
  handler: async (ctx, args) => {
    const latest = await ctx.db
      .query("inventorySnapshots")
      .order("desc")
      .first();
    
    if (!latest) return null;
    
    return latest.inventory.find(i => i.sku === args.sku) || null;
  },
});

/**
 * Get all SKUs with a specific status
 */
export const getByStatus = query({
  args: { status: v.string() },
  handler: async (ctx, args) => {
    const latest = await ctx.db
      .query("inventorySnapshots")
      .order("desc")
      .first();
    
    if (!latest) return [];
    
    return latest.inventory.filter(i => i.status === args.status);
  },
});

/**
 * Get critical/low stock items
 */
export const getAlerts = query({
  args: {},
  handler: async (ctx) => {
    const latest = await ctx.db
      .query("inventorySnapshots")
      .order("desc")
      .first();
    
    if (!latest) return { critical: [], low: [], watch: [] };
    
    return {
      critical: latest.inventory.filter(i => 
        i.status === 'critical' || i.status === 'out_of_stock'
      ),
      low: latest.inventory.filter(i => i.status === 'low'),
      watch: latest.inventory.filter(i => i.status === 'watch'),
      timestamp: latest.timestamp,
    };
  },
});

/**
 * Get summary stats
 */
export const getSummary = query({
  args: {},
  handler: async (ctx) => {
    const latest = await ctx.db
      .query("inventorySnapshots")
      .order("desc")
      .first();
    
    if (!latest) return null;
    
    const inv = latest.inventory;
    
    return {
      timestamp: latest.timestamp,
      totalSkus: inv.length,
      totalUnits: inv.reduce((s, i) => s + i.current, 0),
      totalPending: inv.reduce((s, i) => s + i.pending, 0),
      byStatus: {
        outOfStock: inv.filter(i => i.status === 'out_of_stock').length,
        critical: inv.filter(i => i.status === 'critical').length,
        low: inv.filter(i => i.status === 'low').length,
        watch: inv.filter(i => i.status === 'watch').length,
        good: inv.filter(i => i.status === 'good').length,
        overstock: inv.filter(i => i.status === 'overstock').length,
      },
      topVelocity: inv
        .filter(i => i.velocity7d > 0)
        .sort((a, b) => b.velocity7d - a.velocity7d)
        .slice(0, 10)
        .map(i => ({ sku: i.sku, v7d: i.velocity7d, current: i.current, days: i.daysOfStock })),
      mostUrgent: inv
        .filter(i => i.current > 0 && i.daysOfStock < 30)
        .sort((a, b) => a.daysOfStock - b.daysOfStock)
        .slice(0, 10)
        .map(i => ({ sku: i.sku, current: i.current, days: i.daysOfStock, status: i.status })),
    };
  },
});

/**
 * Get full dashboard data
 */
export const getDashboard = query({
  args: {},
  handler: async (ctx) => {
    const latest = await ctx.db
      .query("inventorySnapshots")
      .order("desc")
      .first();
    
    if (!latest) return null;

    // Get pending POs
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

    // Get baselines
    const baselines = await ctx.db
      .query("inventoryAdjustments")
      .filter((q) => q.eq(q.field("adjustmentType"), "initial_baseline"))
      .collect();

    return {
      snapshot: latest,
      pendingPOs: pos.map(p => ({
        poNumber: p.poNumber,
        supplier: p.supplierId,
        items: p.items.length,
        totalUnits: p.items.reduce((s, i) => s + i.quantity, 0),
        status: p.status,
      })),
      baselineDate: baselines[0]?.createdBy?.replace('import-', '') || 'unknown',
      lastUpdated: latest.timestamp,
    };
  },
});
