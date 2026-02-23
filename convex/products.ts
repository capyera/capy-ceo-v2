import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all products
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("products").collect();
  },
});

// Get product by SKU
export const getBySku = query({
  args: { sku: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("products")
      .withIndex("by_sku", (q) => q.eq("sku", args.sku))
      .first();
  },
});

// Upsert a single product
export const upsert = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("products")
      .withIndex("by_sku", (q) => q.eq("sku", args.sku))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        category: args.category,
        subcategory: args.subcategory,
        imageBase64: args.imageBase64,
        imageMimeType: args.imageMimeType,
        cogs: args.cogs,
        weight: args.weight,
        dimensions: args.dimensions,
        retailPrice: args.retailPrice,
        isActive: args.isActive,
        notes: args.notes,
        updatedAt: args.updatedAt,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("products", args);
    }
  },
});

// Bulk upsert products (for initial sync)
export const bulkUpsert = mutation({
  args: {
    products: v.array(
      v.object({
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
      })
    ),
  },
  handler: async (ctx, args) => {
    let upserted = 0;
    for (const product of args.products) {
      const existing = await ctx.db
        .query("products")
        .withIndex("by_sku", (q) => q.eq("sku", product.sku))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          name: product.name,
          category: product.category,
          subcategory: product.subcategory,
          imageBase64: product.imageBase64,
          imageMimeType: product.imageMimeType,
          cogs: product.cogs,
          weight: product.weight,
          dimensions: product.dimensions,
          retailPrice: product.retailPrice,
          isActive: product.isActive,
          notes: product.notes,
          updatedAt: product.updatedAt,
        });
      } else {
        await ctx.db.insert("products", product);
      }
      upserted++;
    }
    return { upserted };
  },
});

// Delete product by SKU
export const deleteBySku = mutation({
  args: { sku: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("products")
      .withIndex("by_sku", (q) => q.eq("sku", args.sku))
      .first();
    
    if (existing) {
      await ctx.db.delete(existing._id);
      return true;
    }
    return false;
  },
});
