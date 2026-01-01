# Wave 6: Monetization & Scaling

**Duration**: 20-26 hours
**Dependencies**: Wave 1 (needs auth for billing)
**Priority**: High (enables revenue)

---

## Epic 6.1: Stripe Integration (8h)

### Tasks

#### 6.1.1 Stripe Account Setup (1h)
- [ ] Create Stripe account
- [ ] Configure products and prices
- [ ] Set up webhook endpoints
- [ ] Store keys in Cloudflare secrets

**Products:**
- Free: $0/month (baseline)
- Pro: $49/month
- Enterprise: $199/month (or custom)

**Environment:**
```
STRIPE_SECRET_KEY=sk_xxx
STRIPE_PUBLISHABLE_KEY=pk_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

**Acceptance Criteria:**
- Stripe account configured
- Products created
- Keys stored securely

#### 6.1.2 Checkout Flow (2h)
- [ ] Create checkout session endpoint
- [ ] `POST /api/v1/billing/checkout`
- [ ] Redirect to Stripe Checkout
- [ ] Handle success/cancel redirects
- [ ] Create/update subscription record

**Flow:**
```
Admin clicks "Upgrade"
  → POST /api/v1/billing/checkout
  → Redirect to Stripe Checkout
  → User completes payment
  → Stripe redirects to success URL
  → Webhook confirms payment
  → Subscription activated
```

**Acceptance Criteria:**
- Checkout flow complete
- Subscription created on success
- Errors handled gracefully

#### 6.1.3 Webhook Handling (2.5h)
- [ ] Webhook endpoint: `POST /api/v1/billing/webhook`
- [ ] Verify Stripe signature
- [ ] Handle events:
  - `checkout.session.completed` - Activate subscription
  - `customer.subscription.updated` - Plan change
  - `customer.subscription.deleted` - Cancellation
  - `invoice.payment_failed` - Payment issue
  - `invoice.paid` - Successful renewal

**Event Handler:**
```typescript
async function handleWebhook(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed':
      await activateSubscription(event.data.object);
      break;
    case 'customer.subscription.deleted':
      await cancelSubscription(event.data.object);
      break;
    // ...
  }
}
```

**Acceptance Criteria:**
- All events handled
- Signature verified
- Idempotent handling

#### 6.1.4 Customer Portal Integration (1.5h)
- [ ] Enable Stripe Customer Portal
- [ ] `POST /api/v1/billing/portal` - Get portal URL
- [ ] User can manage subscription
- [ ] Update payment method
- [ ] Cancel subscription

**Acceptance Criteria:**
- Portal accessible
- Users can self-manage
- Changes reflected in app

#### 6.1.5 Billing History UI (1h)
- [ ] Show billing history in admin
- [ ] Display invoices from Stripe
- [ ] Download invoice PDFs
- [ ] Show next billing date

**Acceptance Criteria:**
- History visible
- Invoices downloadable
- Current status clear

---

## Epic 6.2: Subscription Tier Management (6h)

### Tasks

#### 6.2.1 Tier Definition (1.5h)
- [ ] Define tier limits:

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| Boards | 2 | 10 | Unlimited |
| Feedback/month | 100 | 1000 | Unlimited |
| AI Processing | Basic | Full | Full + Priority |
| Integrations | 0 | 5 | Unlimited |
| Team Members | 2 | 10 | Unlimited |
| Custom Branding | ❌ | ✅ | ✅ |
| Badge Removal | ❌ | ✅ | ✅ |
| Priority Support | ❌ | ❌ | ✅ |

- [ ] Store tier config in code
- [ ] Plan tier on workspace

**Database:**
```sql
ALTER TABLE workspaces ADD COLUMN plan_tier TEXT DEFAULT 'free';
ALTER TABLE workspaces ADD COLUMN plan_expires_at TEXT;
```

**Acceptance Criteria:**
- Tiers clearly defined
- Limits documented
- Config in code

#### 6.2.2 Feature Flag System (2h)
- [ ] Create feature flag utility
- [ ] Check tier for feature access
- [ ] Graceful degradation for limits
- [ ] Clear upgrade prompts

**Utility:**
```typescript
function canUseFeature(workspace: Workspace, feature: string): boolean {
  const tier = workspace.plan_tier;
  const limits = TIER_LIMITS[tier];
  return limits[feature] !== false;
}

function getRemainingLimit(workspace: Workspace, resource: string): number {
  const tier = workspace.plan_tier;
  const limits = TIER_LIMITS[tier];
  const used = await getUsage(workspace.id, resource);
  return limits[resource] - used;
}
```

**Acceptance Criteria:**
- Features gated by tier
- Limits enforced
- Clear messaging

#### 6.2.3 Limit Enforcement (1.5h)
- [ ] Check limits on resource creation:
  - Board creation
  - Feedback submission
  - Team member invite
  - Integration setup
- [ ] Soft limits (warn at 80%)
- [ ] Hard limits (block at 100%)

**Example:**
```typescript
async function createBoard(workspaceId: string, data: BoardInput) {
  const remaining = await getRemainingLimit(workspaceId, 'boards');
  if (remaining <= 0) {
    throw new UpgradeRequiredError('Board limit reached');
  }
  // Create board...
}
```

**Acceptance Criteria:**
- Limits enforced
- Clear error messages
- Upgrade path shown

#### 6.2.4 Upgrade/Downgrade Flows (1h)
- [ ] Upgrade: Immediate access to new tier
- [ ] Downgrade: At end of billing period
- [ ] Handle over-limit on downgrade
- [ ] Grace period for adjustments

**Downgrade Logic:**
- If over new limits, show what will be affected
- Don't delete data, just restrict access
- Allow selection of what to keep within limits

**Acceptance Criteria:**
- Upgrades instant
- Downgrades handled gracefully
- No data loss

---

## Epic 6.3: Usage-Based Billing (4h)

### Tasks

#### 6.3.1 AI Processing Credits (1.5h)
- [ ] Define credit costs:
  - Embedding: 1 credit
  - Classification: 5 credits
  - Sentiment: 2 credits
  - Theme clustering: 10 credits
- [ ] Track usage per workspace
- [ ] Monthly credit allocation per tier
- [ ] Overage pricing

**Pricing:**
- Free: 500 credits/month
- Pro: 5000 credits/month
- Enterprise: Unlimited (fair use)
- Overage: $0.01/credit

**Acceptance Criteria:**
- Credits tracked
- Allocation by tier
- Overage billed

#### 6.3.2 API Request Metering (1h)
- [ ] Track API requests per key
- [ ] Daily/monthly aggregates
- [ ] Rate limits by tier:
  - Free: 1000 req/day
  - Pro: 10000 req/day
  - Enterprise: 100000 req/day

**Acceptance Criteria:**
- Requests metered
- Limits enforced
- Usage visible

#### 6.3.3 Storage Usage Tracking (1h)
- [ ] Track storage per workspace:
  - Feedback items
  - Attachments (R2)
  - Exports
- [ ] Limits by tier
- [ ] Cleanup old exports

**Acceptance Criteria:**
- Storage tracked
- Limits enforced
- Auto-cleanup working

#### 6.3.4 Usage Dashboard (0.5h)
- [ ] Show usage in admin
- [ ] Progress bars for limits
- [ ] Alerts at 80% usage
- [ ] Link to upgrade

**Acceptance Criteria:**
- Usage visible
- Alerts working
- Upgrade easy

---

## Epic 6.4: White-Label Controls (4h)

### Tasks

#### 6.4.1 Custom Domain Support (2h)
- [ ] CNAME configuration
- [ ] SSL certificate handling
- [ ] Domain verification
- [ ] Routing to correct workspace

**Setup Flow:**
1. User adds custom domain in admin
2. System provides CNAME target
3. User configures DNS
4. System verifies CNAME
5. SSL certificate issued
6. Domain active

**Acceptance Criteria:**
- Custom domains work
- SSL automatic
- Verification required

#### 6.4.2 Badge Removal (0.5h)
- [ ] Check tier before showing badge
- [ ] Simple toggle in admin
- [ ] Persist preference

**Acceptance Criteria:**
- Badge removable on paid tiers
- Toggle in settings
- Widget respects setting

#### 6.4.3 Custom CSS Theming (1h)
- [ ] CSS variable customization
- [ ] Primary color
- [ ] Font family
- [ ] Logo upload

**Customizable Properties:**
```css
:root {
  --cv-primary-color: #0066FF;
  --cv-secondary-color: #6B7280;
  --cv-font-family: 'Inter', sans-serif;
  --cv-border-radius: 8px;
}
```

**Acceptance Criteria:**
- Styling customizable
- Live preview
- Applied to widget

#### 6.4.4 Custom Email Templates (0.5h)
- [ ] Template customization
- [ ] Logo and colors
- [ ] Custom footer
- [ ] Preview before saving

**Acceptance Criteria:**
- Emails customizable
- Branding consistent
- Preview available

---

## Epic 6.5: Invoice Generation (4h)

### Tasks

#### 6.5.1 Invoice Creation (1.5h)
- [ ] Create invoice records
- [ ] Link to Stripe invoices
- [ ] Track payment status
- [ ] Handle refunds

**Database:**
```sql
CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  stripe_invoice_id TEXT UNIQUE,
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL,
  period_start TEXT,
  period_end TEXT,
  paid_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

**Acceptance Criteria:**
- Invoices tracked
- Synced with Stripe
- Status accurate

#### 6.5.2 PDF Invoice Generation (1.5h)
- [ ] Generate PDF invoices
- [ ] Include all required fields:
  - Invoice number
  - Dates
  - Line items
  - Tax (if applicable)
  - Company details
- [ ] Store in R2

**Acceptance Criteria:**
- PDFs generated
- All details included
- Downloadable

#### 6.5.3 Invoice Email Delivery (0.5h)
- [ ] Send invoice on payment
- [ ] Attach PDF
- [ ] Send reminders for unpaid

**Acceptance Criteria:**
- Emails sent
- PDF attached
- Reminders working

#### 6.5.4 Tax Handling (0.5h)
- [ ] Basic tax calculation
- [ ] EU VAT handling (future)
- [ ] Tax ID collection
- [ ] Tax exempt support

**Acceptance Criteria:**
- Basic taxes applied
- Tax ID storable
- Exempt configurable

---

## Definition of Done for Wave 6

- [ ] Stripe checkout working
- [ ] Webhooks handling all events
- [ ] Tier limits enforced
- [ ] Usage tracking functional
- [ ] Custom domains working
- [ ] Invoices generating and emailing

---

## Estimated Breakdown

| Epic | Hours | Complexity |
|------|-------|------------|
| 6.1 Stripe Integration | 8h | High |
| 6.2 Tier Management | 6h | Medium |
| 6.3 Usage Billing | 4h | Medium |
| 6.4 White-Label | 4h | Medium |
| 6.5 Invoicing | 4h | Medium |

**Total: 26h (optimistic: 20h)**
