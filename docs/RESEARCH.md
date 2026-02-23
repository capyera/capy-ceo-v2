# Premium Inventory App Research Summary

## Apps Researched

### 1. Inventory Planner by Sage
**Shopify App Store Rating**: 4.4/5 (146 reviews)

**Core Features**:
- Demand forecasting with precision algorithms
- Automated replenishment suggestions
- Multi-location inventory planning
- SKU-level profitability analysis
- Cash flow planning
- Inventory turnover tracking
- Multi-channel sync (Amazon, Linnworks, ShipBob, Cin7)

**Pricing**: External billing, typically $249-$499/month

**What Merchants Love**:
- Efficient automation of inventory management tasks
- Accurate forecasting (avoids overstocking and stockouts)
- User-friendly platform
- Responsive, knowledgeable support team
- Valuable insights and reports

**UI/UX Patterns**:
- Clean dashboard with key metrics at top
- Tabbed navigation for different functions
- Data tables with inline actions
- Visual charts for trends

---

### 2. Cogsy
**Shopify App Store Rating**: 4.9/5 (13 reviews)

**Core Features**:
- Total inventory visibility (vendor to customer)
- Ops calendar for planning
- Stockout prevention
- Vendor/supplier management
- Demand planning
- Purchase order management

**Pricing**: ~$199-$599/month based on order volume

**What Makes It Premium**:
- Modern, beautiful interface
- Focus on decision support
- Integrations with major platforms
- Real-time visibility across supply chain

---

### 3. Cin7
**Pricing Tiers**:
- Standard: ~$349/month (6,000 orders/year, 5 users)
- Pro: ~$599/month (24,000 orders/year, 10 users)  
- Advanced: ~$999/month (120,000 orders/year, 15 users)

**Core Features**:
- Product management with AI descriptions
- Purchase order management
- Unlimited inventory locations
- Accounting integrations (Xero, QuickBooks)
- Standard & Advanced Warehouse Management
- Cin7 ForesightAI Forecasting (add-on)
- Kits & Bundles
- Bill of Materials (BOM) tracking
- Batch & expiration tracking
- Material Requirements Planning (MRP)
- Cost of Goods Sold (COGS) tracking
- Multi-currency support
- B2B Portal
- Point of Sale (POS)
- Return Merchandise Authorization (RMA)

**What Makes It Enterprise-Grade**:
- Unlimited SKUs
- EDI/3PL connections
- Advanced automations
- API access for custom integrations
- Professional services available

---

### 4. Skubana/Extensiv (Order Manager)
**Target**: High-volume DTC brands (9-figure revenue)

**Core Features**:
- Multi-channel order management
- Automated inventory allocation
- Demand forecasting
- 3PL/warehouse integrations
- Profitability analytics
- Custom workflows
- Multi-warehouse support

**Pricing**: Enterprise tier, typically $1,000+/month

---

### 5. TradeGecko (now QuickBooks Commerce)
**Status**: Acquired by Intuit, merged into QuickBooks Commerce

**Legacy Features**:
- Inventory management
- B2B ecommerce
- Order management
- Accounting integration

---

## Feature Comparison: What We Built vs. Competitors

| Feature | Capy Inventory | Inventory Planner | Cogsy | Cin7 |
|---------|---------------|-------------------|-------|------|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Inventory Tracking | ✅ | ✅ | ✅ | ✅ |
| Velocity Analysis | ✅ | ✅ | ✅ | ✅ |
| Bundle Management | ✅ | Partial | ✅ | ✅ |
| COGS Tracking | ✅ | ✅ | ✅ | ✅ |
| Purchase Orders | ✅ | ✅ | ✅ | ✅ |
| Supplier Management | ✅ | ✅ | ✅ | ✅ |
| Forecasting | ✅ | ✅ Premium | ✅ | Add-on |
| Reorder Points | ✅ | ✅ | ✅ | ✅ |
| Shopify Integration | ✅ | ✅ | ✅ | ✅ |
| Low Stock Alerts | ✅ | ✅ | ✅ | ✅ |
| Custom for Capy-Era | ✅ | ❌ | ❌ | ❌ |

## Key Takeaways

1. **Premium apps charge $300-500/month** for comprehensive inventory management
2. **Core features are table stakes**: Every app has dashboards, POs, forecasting
3. **Differentiation comes from**: AI forecasting, automation, integrations, UX
4. **Capy-Era-specific features** we built that generic apps don't have:
   - Pre-configured for the Capy-Era SKU system
   - Integrated with existing Convex database
   - Connected to Mars warehouse data
   - Matches the existing Google Sheet workflow
   - Built around the drop-based business model

## Why Build Custom Instead of Buy?

1. **Cost**: Save $300-500/month in perpetuity
2. **Customization**: Tailored to Capy-Era's exact workflow
3. **Integration**: Works with existing data sources out of the box
4. **Control**: Full ownership, can extend any time
5. **Speed**: No vendor dependency for feature requests
