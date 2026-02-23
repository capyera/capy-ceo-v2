/**
 * Convex client for syncing product data to the cloud
 */

const CONVEX_URL = 'https://adventurous-fennec-839.convex.cloud';

interface ConvexProduct {
  sku: string;
  name: string;
  category: string;
  subcategory?: string;
  imageBase64?: string;
  imageMimeType?: string;
  cogs: number;
  weight: number;
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
  retailPrice?: number;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Call a Convex mutation
 */
async function callMutation(name: string, args: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: name,
      args,
      format: 'json',
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Convex mutation failed: ${error}`);
  }
  
  const result = await response.json();
  return result.value;
}

/**
 * Call a Convex query
 */
async function callQuery(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const response = await fetch(`${CONVEX_URL}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: name,
      args,
      format: 'json',
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Convex query failed: ${error}`);
  }
  
  const result = await response.json();
  return result.value;
}

export const convexProducts = {
  /**
   * Fetch all products from Convex
   */
  async list(): Promise<ConvexProduct[]> {
    const result = await callQuery('products:list');
    return (result as ConvexProduct[]) || [];
  },

  /**
   * Upsert a single product to Convex
   */
  async upsert(product: ConvexProduct): Promise<void> {
    await callMutation('products:upsert', product);
  },

  /**
   * Bulk upsert products to Convex
   */
  async bulkUpsert(products: ConvexProduct[]): Promise<{ upserted: number }> {
    // Convex has limits, chunk into batches of 50
    const chunkSize = 50;
    let totalUpserted = 0;
    
    for (let i = 0; i < products.length; i += chunkSize) {
      const chunk = products.slice(i, i + chunkSize);
      const result = await callMutation('products:bulkUpsert', { products: chunk }) as { upserted: number };
      totalUpserted += result.upserted;
    }
    
    return { upserted: totalUpserted };
  },

  /**
   * Delete a product from Convex
   */
  async delete(sku: string): Promise<boolean> {
    const result = await callMutation('products:deleteBySku', { sku });
    return result as boolean;
  },
};
