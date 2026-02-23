import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * List all inventory items for the dashboard
 * Combines baselines, movements, POs, and velocity data
 */
export const listInventory = query({
  args: {},
  handler: async (ctx) => {
    // Get baselines
    const baselines = await ctx.db
      .query("inventoryAdjustments")
      .filter((q) => q.eq(q.field("adjustmentType"), "initial_baseline"))
      .collect();

    // Get all movements
    const movements = await ctx.db
      .query("inventoryMovements")
      .collect();

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

    // Get latest snapshot for velocity data
    const snapshot = await ctx.db
      .query("inventorySnapshots")
      .order("desc")
      .first();

    // Build velocity lookup from snapshot
    const velocityMap: Record<string, { v7d: number; v30d: number }> = {};
    if (snapshot) {
      for (const item of snapshot.inventory) {
        velocityMap[item.sku] = {
          v7d: item.velocity7d,
          v30d: item.velocity30d,
        };
      }
    }

    // Calculate pending PO quantities per SKU
    const pendingBySku: Record<string, number> = {};
    for (const po of pos) {
      for (const item of po.items) {
        pendingBySku[item.sku] = (pendingBySku[item.sku] || 0) + item.quantity;
      }
    }

    // Calculate current levels
    const levels: Record<string, {
      baseline: number;
      sold: number;
      refunded: number;
      adjusted: number;
      inbound: number;
    }> = {};

    // Initialize from baselines
    for (const b of baselines) {
      levels[b.sku] = {
        baseline: b.quantity,
        sold: 0,
        refunded: 0,
        adjusted: 0,
        inbound: 0,
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
        };
      }

      const level = levels[m.sku];
      
      switch (m.movementType) {
        case "sale":
          level.sold += Math.abs(m.quantity);
          break;
        case "refund":
          level.refunded += m.quantity;
          break;
        case "adjustment":
          level.adjusted += m.quantity;
          break;
        case "inbound":
          level.inbound += m.quantity;
          break;
      }
    }

    // Build inventory list
    const inventory = [];
    
    for (const [sku, level] of Object.entries(levels)) {
      const currentQty = level.baseline - level.sold + level.refunded + level.adjusted + level.inbound;
      const inboundQty = pendingBySku[sku] || 0;
      const velocity = velocityMap[sku] || { v7d: 0, v30d: 0 };
      
      const v7d = velocity.v7d;
      const v30d = velocity.v30d;
      
      // Current DOS = existing stock only / velocity
      const currentDOS = v7d > 0 ? Math.round(currentQty / v7d) : 999;
      // Total DOS = (existing + inbound) / velocity  
      const totalDOS = v7d > 0 ? Math.round((currentQty + inboundQty) / v7d) : 999;
      
      inventory.push({
        sku,
        productName: getProductName(sku),
        category: getCategoryFromSKU(sku),
        subcategory: getSubcategoryFromSKU(sku),
        currentQty,
        inboundQty,
        poQty: inboundQty,
        totalAvailable: currentQty + inboundQty,
        velocity3d: v7d * 1.1, // Estimate
        velocity7d: v7d,
        velocity14d: (v7d + v30d) / 2,
        velocity30d: v30d,
        daysOfStock: currentDOS,        // Current inventory only
        daysOfStockTotal: totalDOS,     // Including inbound
        updatedAt: Date.now(),
      });
    }

    // Sort by days of stock (most urgent first)
    inventory.sort((a, b) => a.daysOfStock - b.daysOfStock);

    return inventory;
  },
});

/**
 * Get inventory for a specific SKU
 */
export const getBySku = query({
  args: { sku: v.string() },
  handler: async (ctx, args) => {
    // Get baseline
    const baseline = await ctx.db
      .query("inventoryAdjustments")
      .withIndex("by_sku", (q) => q.eq("sku", args.sku))
      .filter((q) => q.eq(q.field("adjustmentType"), "initial_baseline"))
      .first();

    // Get movements
    const movements = await ctx.db
      .query("inventoryMovements")
      .withIndex("by_sku", (q) => q.eq("sku", args.sku))
      .collect();

    // Calculate current
    let current = baseline?.quantity || 0;
    for (const m of movements) {
      current += m.quantity;
    }

    // Get pending POs
    const pos = await ctx.db
      .query("purchaseOrders")
      .filter((q) => 
        q.or(
          q.eq(q.field("status"), "confirmed"),
          q.eq(q.field("status"), "partial")
        )
      )
      .collect();

    let pending = 0;
    for (const po of pos) {
      const item = po.items.find(i => i.sku === args.sku);
      if (item) pending += item.quantity;
    }

    return {
      sku: args.sku,
      baseline: baseline?.quantity || 0,
      movements: movements.length,
      currentQty: current,
      pendingQty: pending,
      totalAvailable: current + pending,
    };
  },
});

// Helper functions
function getProductName(sku: string): string {
  const names: Record<string, string> = {
    'OG-M-001': 'Orange Capybara 10"',
    'OG-M-002': 'Strawberry Capybara 10"',
    'OG-M-003': 'Watermelon Capybara 10"',
    'OG-M-004': 'Sakura Capybara 10"',
    'OG-M-005': 'Violet Capybara 10"',
    'OG-M-006': 'Lily Capybara 10"',
    'OG-M-007': 'Matcha Capybara 10"',
    'OG-M-008': 'Blueberry Capybara 10"',
    'OG-M-009': 'Cherry Capybara 10"',
    'OG-M-010': 'Avocado Capybara 10"',
    'OG-M-011': 'Croissant Capybara 10"',
    'OG-M-012': 'Coffee Capybara 10"',
    'LE-M-006': 'Secret Crush Valentine',
    'LE-M-007': 'Rose Valentine',
    'LE-M-008': 'White Choco Valentine',
    'LE-M-009': 'Lucky Clover Capybara',
    'LE-M-010': 'Pot of Gold Capybara',
    'LE-M-011': 'Rainbow Capybara',
  };
  
  // Check for keychains
  if (sku.includes('KEY')) {
    const base = sku.replace('KEY', 'M').replace('-0', '-00');
    const baseName = names[base];
    if (baseName) return baseName.replace(' 10"', ' Bag Charm');
    return sku + ' Bag Charm';
  }
  
  // Check for jumbo
  if (sku.includes('-L-')) {
    const base = sku.replace('-L-', '-M-');
    const baseName = names[base];
    if (baseName) return baseName.replace(' 10"', ' Jumbo');
    return sku + ' Jumbo';
  }
  
  return names[sku] || sku;
}

function getCategoryFromSKU(sku: string): string {
  if (sku.startsWith('OH-K')) return 'clothing';
  if (sku.startsWith('OH')) return 'clothing';
  if (sku.startsWith('OT')) return 'clothing';
  if (sku.startsWith('SC0')) return 'clothing';
  if (sku.includes('KEY')) return 'plushies';
  if (sku.includes('-L-')) return 'plushies';
  if (sku.includes('-M-')) return 'plushies';
  if (sku.includes('TOTE') || sku.includes('BAG')) return 'accessories';
  if (sku.includes('STK') || sku.includes('Card')) return 'accessories';
  return 'other';
}

function getSubcategoryFromSKU(sku: string): string | undefined {
  if (sku.includes('KEY')) return 'Bag Charm';
  if (sku.includes('-L-')) return 'Jumbo';
  if (sku.includes('-M-')) return '10" Plushie';
  if (sku.startsWith('OH-K')) return 'Kids Hoodie';
  if (sku.startsWith('OH10')) return 'Adult Hoodie';
  if (sku.startsWith('OT')) return 'Oversized T-shirt';
  if (sku.startsWith('SC0')) return 'Sweatshirt';
  if (sku.includes('TOTE')) return 'Totebag';
  return undefined;
}
