import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Save a full app backup
export const save = mutation({
  args: {
    backupId: v.string(),
    userId: v.string(),
    data: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if backup exists
    const existing = await ctx.db
      .query("appBackups")
      .withIndex("by_backup_id", (q) => q.eq("backupId", args.backupId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        data: args.data,
        description: args.description,
        createdAt: new Date().toISOString(),
      });
      return existing._id;
    } else {
      return await ctx.db.insert("appBackups", {
        backupId: args.backupId,
        userId: args.userId,
        data: args.data,
        description: args.description,
        createdAt: new Date().toISOString(),
      });
    }
  },
});

// Get latest backup for user
export const getLatest = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const backups = await ctx.db
      .query("appBackups")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    
    if (backups.length === 0) return null;
    
    // Sort by createdAt descending and return latest
    backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return backups[0];
  },
});

// List all backups for user
export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const backups = await ctx.db
      .query("appBackups")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    
    // Sort by createdAt descending
    backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // Return without the large data field for listing
    return backups.map(b => ({
      _id: b._id,
      backupId: b.backupId,
      userId: b.userId,
      description: b.description,
      createdAt: b.createdAt,
    }));
  },
});

// Get specific backup by ID
export const getById = query({
  args: { backupId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("appBackups")
      .withIndex("by_backup_id", (q) => q.eq("backupId", args.backupId))
      .first();
  },
});

// Delete a backup
export const remove = mutation({
  args: { backupId: v.string() },
  handler: async (ctx, args) => {
    const backup = await ctx.db
      .query("appBackups")
      .withIndex("by_backup_id", (q) => q.eq("backupId", args.backupId))
      .first();
    
    if (backup) {
      await ctx.db.delete(backup._id);
      return true;
    }
    return false;
  },
});
