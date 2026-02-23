# Capy-Era Order Sync Infrastructure

Production-grade Shopify order synchronization system that tracks all orders, refunds, and inventory movements in Convex.

## Architecture Overview

```
┌─────────────────┐     Webhooks      ┌────────────────────┐
│   Shopify       │ ─────────────────▶│ Cloudflare Worker  │
│   (Orders)      │                   │ (capy-api-proxy)   │
└─────────────────┘                   └─────────┬──────────┘
                                                │
                                                │ Convex Mutations
                                                ▼
                                      ┌─────────────────────┐
                                      │      Convex         │
                                      │  - orders           │
                                      │  - orderLineItems   │
                                      │  - orderRefunds     │
                                      │  - inventoryMovements│
                                      │  - inventorySummary │
                                      └─────────────────────┘
```

## Components

### 1. Convex Schema (`convex/schema.ts`)

**Tables:**

| Table | Description |
|-------|-------------|
| `orders` | Main order records from Shopify |
| `orderLineItems` | Individual line items within orders |
| `orderRefunds` | Refund records with line item details |
| `inventoryMovements` | All inventory changes (sales, refunds, cancellations, adjustments) |
| `inventorySummary` | Computed summary per SKU |

### 2. Convex Mutations (`convex/orders.ts`)

**Mutations:**

| Function | Description |
|----------|-------------|
| `syncOrder` | Creates/updates an order and all related line items |
| `processRefund` | Processes a refund webhook |
| `reconcileInventory` | Recalculates inventory from order data |
| `adjustInventory` | Manual inventory adjustment |
| `clearOrderData` | Dangerous: clears all order data for re-sync |

**Queries:**

| Function | Description |
|----------|-------------|
| `getInventoryBySku` | Get inventory summary + recent movements for a SKU |
| `getAllInventorySummaries` | Get all SKU summaries |
| `getOrdersByDateRange` | Fetch orders in a date range |
| `getOrderByShopifyId` | Get full order details |
| `getMovementsByDateRange` | Fetch inventory movements |

### 3. Cloudflare Worker Webhooks (`capy-api-proxy/src/index.ts`)

**Webhook Endpoints:**

| Endpoint | Shopify Topic | Description |
|----------|---------------|-------------|
| `POST /webhooks/orders/create` | `orders/create` | New order placed |
| `POST /webhooks/orders/updated` | `orders/updated` | Order status changed |
| `POST /webhooks/refunds/create` | `refunds/create` | Refund processed |

### 4. Scripts

| Script | Description |
|--------|-------------|
| `scripts/backfill-orders.mjs` | Backfill historical orders from Shopify |
| `scripts/reconcile-inventory.mjs` | Compare Convex vs Shopify inventory |

## Setup Guide

### Step 1: Deploy Convex Schema

```bash
cd capy-inventory
npx convex deploy
```

### Step 2: Configure Cloudflare Worker Secrets

```bash
cd capy-api-proxy

# Set the webhook secret (generate a secure random string)
npx wrangler secret put SHOPIFY_WEBHOOK_SECRET

# Set the Convex URL
npx wrangler secret put CONVEX_URL
# Enter: https://adventurous-fennec-839.convex.cloud
```

### Step 3: Deploy Cloudflare Worker

```bash
npx wrangler deploy
```

### Step 4: Register Shopify Webhooks

In Shopify Admin → Settings → Notifications → Webhooks, create:

| Topic | URL |
|-------|-----|
| `orders/create` | `https://capy-api-proxy.jamescapyera.workers.dev/webhooks/orders/create` |
| `orders/updated` | `https://capy-api-proxy.jamescapyera.workers.dev/webhooks/orders/updated` |
| `refunds/create` | `https://capy-api-proxy.jamescapyera.workers.dev/webhooks/refunds/create` |

Copy the webhook signing secret and set it as `SHOPIFY_WEBHOOK_SECRET`.

### Step 5: Backfill Historical Orders

```bash
cd scripts

# Dry run first
node backfill-orders.mjs --dry-run

# Actual backfill (last 90 days)
node backfill-orders.mjs

# Custom date range
node backfill-orders.mjs --days=365
```

### Step 6: Verify with Reconciliation

```bash
node reconcile-inventory.mjs

# Fix any discrepancies
node reconcile-inventory.mjs --fix
```

## Inventory Logic

### Movement Types

| Type | Quantity Sign | Description |
|------|---------------|-------------|
| `sale` | Negative (-) | Stock out from sale |
| `refund` | Positive (+) | Stock returned from refund |
| `cancellation` | Positive (+) | Stock returned from order cancellation |
| `adjustment` | Either (+/-) | Manual stock adjustment |

### Net Sold Calculation

```
Net Sold = Total Sold - Total Refunded - Total Cancelled + Adjustments
```

### Order Status Handling

| Status | Inventory Impact |
|--------|------------------|
| `paid` | Creates `sale` movements |
| `partially_refunded` | Adds `refund` movements |
| `refunded` | Adds `refund` movements |
| `voided` | No change (not yet shipped) |
| `cancelled` | Creates `cancellation` movements |

## Timezone Handling

- **Shopify operates in PST** (America/Los_Angeles)
- All timestamps stored in **ISO 8601 format (UTC)**
- Scripts display PST for convenience

## Monitoring

### Health Check

```bash
curl https://capy-api-proxy.jamescapyera.workers.dev/health
```

### Check Webhook Status

```bash
# Check if webhooks are properly configured
curl https://capy-api-proxy.jamescapyera.workers.dev/health | jq .checks.webhooks
```

### View Recent Movements

Use Convex dashboard or query:

```javascript
// In Convex dashboard
orders:getMovementsByDateRange({ 
  startDate: "2024-01-01T00:00:00Z", 
  endDate: "2024-12-31T23:59:59Z" 
})
```

## Daily Maintenance

### Recommended Cron Schedule

```
# Daily reconciliation at 6 AM PST
0 14 * * * node /path/to/scripts/reconcile-inventory.mjs --fix

# Weekly full backfill (catch any missed webhooks)
0 15 * * 0 node /path/to/scripts/backfill-orders.mjs --days=7
```

## Troubleshooting

### Webhook Not Received

1. Check Cloudflare Worker logs
2. Verify webhook URL is accessible
3. Check HMAC signature configuration

### Inventory Discrepancy

```bash
# Check specific SKU
node reconcile-inventory.mjs --sku=CAPY-001 --verbose

# Fix all discrepancies
node reconcile-inventory.mjs --fix
```

### Re-sync All Orders

```bash
# ⚠️ Dangerous: Clears all order data
# Use Convex dashboard to run:
orders:clearOrderData({ confirm: "I understand this will delete all order data" })

# Then backfill
node backfill-orders.mjs --days=365
```

## Security

- HMAC signature verification on all webhooks
- API keys stored in Cloudflare Worker secrets
- Convex handles authentication for mutations

## Files Modified

- `capy-inventory/convex/schema.ts` - Added order sync tables
- `capy-inventory/convex/orders.ts` - New mutations and queries
- `capy-api-proxy/src/index.ts` - Added webhook endpoints
- `scripts/backfill-orders.mjs` - New backfill script
- `scripts/reconcile-inventory.mjs` - New reconciliation script
