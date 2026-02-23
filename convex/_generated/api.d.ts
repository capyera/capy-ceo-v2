/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as appBackup from "../appBackup.js";
import type * as inventory from "../inventory.js";
import type * as inventoryAdjustments from "../inventoryAdjustments.js";
import type * as inventoryMovements from "../inventoryMovements.js";
import type * as inventorySnapshot from "../inventorySnapshot.js";
import type * as orders from "../orders.js";
import type * as products from "../products.js";
import type * as purchaseOrders from "../purchaseOrders.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  appBackup: typeof appBackup;
  inventory: typeof inventory;
  inventoryAdjustments: typeof inventoryAdjustments;
  inventoryMovements: typeof inventoryMovements;
  inventorySnapshot: typeof inventorySnapshot;
  orders: typeof orders;
  products: typeof products;
  purchaseOrders: typeof purchaseOrders;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
