# Phase 4: Landing Page

**Total Effort**: 8 hours
**Agent**: Frontend Specialist
**Wave**: 5 (Starts after Widget complete)
**Priority**: P0 - Required for distribution

---

## Design Direction

**Aesthetic**: Bold modern with editorial influence
**Tone**: Confident, aspirational, developer-friendly
**Typography**: Distinctive display font (Cabinet Grotesk, Satoshi, or similar) + refined body
**Differentiator**: Live interactive widget demo as hero (not screenshot)

**Color Palette**:
```css
--landing-bg: #0a0a0a;         /* Near black */
--landing-surface: #141414;     /* Elevated surfaces */
--landing-border: #262626;      /* Subtle borders */
--landing-text: #fafafa;        /* Primary text */
--landing-muted: #a3a3a3;       /* Secondary text */
--landing-accent: #3b82f6;      /* Blue accent */
--landing-accent-glow: rgba(59, 130, 246, 0.2);
```

---

## Epic 4.1: Hero Section (2h)

### Task 4.1.1: Hero Layout & Typography (1h)
**Description**: Create the hero section with compelling copy and layout.

**Acceptance Criteria**:
- [ ] Large headline with gradient text effect
- [ ] Subheadline explaining value prop
- [ ] Two CTA buttons (Get Started, View Demo)
- [ ] Responsive layout (stack on mobile)
- [ ] Subtle grid/dots background pattern

**Files**:
- `admin/src/pages/Landing.tsx` (or separate landing project)
- `admin/src/components/landing/Hero.tsx`

**Copy**:
```
Headline: "Feedback that builds products people love"
Subhead: "The AI-native feedback platform that's cheap to host,
         easy to embed, and understands your users."
CTA 1: "Start Free" → /signup
CTA 2: "See it in action" → scroll to demo
```

**Markup**:
```tsx
<section className="relative min-h-screen flex items-center justify-center overflow-hidden">
  {/* Background pattern */}
  <div className="absolute inset-0 bg-grid-pattern opacity-10" />

  {/* Gradient orb */}
  <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-accent/20 rounded-full blur-[120px]" />

  <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
    <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
      <span className="bg-gradient-to-r from-white via-white to-muted-foreground bg-clip-text text-transparent">
        Feedback that builds products
      </span>
      <br />
      <span className="text-accent">people love</span>
    </h1>

    <p className="mt-6 text-xl text-muted-foreground max-w-2xl mx-auto">
      The AI-native feedback platform that's cheap to host,
      easy to embed, and understands your users.
    </p>

    <div className="mt-10 flex flex-wrap justify-center gap-4">
      <Button size="lg" className="px-8">
        Start Free
      </Button>
      <Button size="lg" variant="outline" className="px-8">
        See it in action
      </Button>
    </div>
  </div>
</section>
```

**Dependencies**: Phase 1 Widget complete

---

### Task 4.1.2: Live Widget Demo (1h)
**Description**: Embed a live, functional widget in the hero.

**Acceptance Criteria**:
- [ ] Real widget embedded (from /widget.js)
- [ ] Pre-populated with sample feedback
- [ ] Interactive (can vote, but submission shows modal)
- [ ] Floating card effect with glow
- [ ] Animate in on scroll or page load

**Files**:
- `admin/src/components/landing/WidgetDemo.tsx`

**Implementation**:
```tsx
function WidgetDemo() {
  useEffect(() => {
    // Load widget script
    const script = document.createElement('script');
    script.src = `${API_URL}/widget.js`;
    script.dataset.workspace = 'demo';
    script.dataset.board = 'showcase';
    script.dataset.theme = 'dark';
    document.getElementById('widget-container')?.appendChild(script);

    return () => script.remove();
  }, []);

  return (
    <div className="relative mt-20">
      {/* Glow effect */}
      <div className="absolute inset-0 bg-accent/10 blur-3xl rounded-full" />

      {/* Widget container */}
      <div
        id="widget-container"
        className="relative bg-surface border border-border rounded-2xl shadow-2xl p-2 max-w-md mx-auto animate-float"
      />
    </div>
  );
}
```

**Dependencies**: Task 4.1.1

---

## Epic 4.2: Feature Highlights (1.5h)

### Task 4.2.1: Feature Grid (1h)
**Description**: Create a grid of key features with icons.

**Acceptance Criteria**:
- [ ] 6 feature cards in 3x2 grid (2x3 on mobile)
- [ ] Icon + title + description
- [ ] Subtle hover animation
- [ ] Staggered scroll reveal

**Features to Highlight**:
1. **Embeddable Widget** - Drop-in feedback collection
2. **AI Deduplication** - Automatically merge similar ideas
3. **Cloudflare Native** - Runs on the edge, costs pennies
4. **Multi-Board** - Separate boards for different products
5. **Moderation Flow** - Approve before publishing
6. **MCP Integration** - Let AI agents submit feedback

**Files**:
- `admin/src/components/landing/Features.tsx`

**Component**:
```tsx
const features = [
  {
    icon: <Code2 className="w-6 h-6" />,
    title: "Embeddable Widget",
    description: "One script tag. Any website. Beautiful feedback collection that just works.",
  },
  {
    icon: <Sparkles className="w-6 h-6" />,
    title: "AI Deduplication",
    description: "Automatically detect and merge similar feedback. No more duplicate ideas.",
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: "Edge-First",
    description: "Runs on Cloudflare's global edge. Fast everywhere, costs almost nothing.",
  },
  // ... more
];

function Features() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-16">
          Everything you need to understand your users
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className="p-6 bg-surface border border-border rounded-xl hover:border-accent/50 transition-colors"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center text-accent mb-4">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

**Dependencies**: Task 4.1.2

---

### Task 4.2.2: How It Works (30min)
**Description**: Simple 3-step explanation.

**Acceptance Criteria**:
- [ ] 3 numbered steps with illustrations/icons
- [ ] Code snippet showing embed
- [ ] Horizontal layout (vertical on mobile)

**Steps**:
1. **Add the widget** - One line of code
2. **Collect feedback** - Users submit and vote
3. **Ship what matters** - AI helps you prioritize

**Dependencies**: Task 4.2.1

---

## Epic 4.3: Competitor Comparison (1.5h)

### Task 4.3.1: Comparison Table (1h)
**Description**: Create comparison table vs UserVoice, Canny.

**Acceptance Criteria**:
- [ ] Compare key features
- [ ] Collective Vision, UserVoice, Canny columns
- [ ] Checkmarks, X marks, partial indicators
- [ ] Highlight Collective Vision advantages
- [ ] Pricing row at bottom

**Files**:
- `admin/src/components/landing/Comparison.tsx`

**Features to Compare**:
| Feature | Collective Vision | UserVoice | Canny |
|---------|-------------------|-----------|-------|
| Embeddable Widget | Yes | Yes | Yes |
| AI Deduplication | Yes | No | Partial |
| Self-Hosted Option | Yes (Cloudflare) | No | No |
| MCP Integration | Yes | No | No |
| Starting Price | $0/mo | $699/mo | $79/mo |

**Component**:
```tsx
function Comparison() {
  return (
    <section className="py-24 px-6 bg-surface">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-4">
          Why teams switch to Collective Vision
        </h2>
        <p className="text-center text-muted-foreground mb-12">
          More features. Lower cost. AI-native from day one.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-4 px-4">Feature</th>
                <th className="py-4 px-4 text-accent font-bold">Collective Vision</th>
                <th className="py-4 px-4">UserVoice</th>
                <th className="py-4 px-4">Canny</th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((row) => (
                <tr key={row.feature} className="border-b border-border/50">
                  <td className="py-4 px-4">{row.feature}</td>
                  <td className="py-4 px-4 text-center">
                    {row.cv ? <Check className="text-green-500 mx-auto" /> : <X className="text-red-500 mx-auto" />}
                  </td>
                  <td className="py-4 px-4 text-center">
                    {row.uv ? <Check className="text-green-500 mx-auto" /> : <X className="text-red-500 mx-auto" />}
                  </td>
                  <td className="py-4 px-4 text-center">
                    {row.canny ? <Check className="text-green-500 mx-auto" /> : <X className="text-red-500 mx-auto" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
```

**Dependencies**: Task 4.2.2

---

### Task 4.3.2: Social Proof (30min)
**Description**: Add testimonials or logos section.

**Acceptance Criteria**:
- [ ] "Trusted by" logo strip (placeholder for now)
- [ ] Or 2-3 testimonial cards
- [ ] Subtle animation

**Files**:
- `admin/src/components/landing/SocialProof.tsx`

**Dependencies**: Task 4.3.1

---

## Epic 4.4: Pricing Section (1.5h)

### Task 4.4.1: Pricing Cards (1h)
**Description**: Create 3-tier pricing display.

**Acceptance Criteria**:
- [ ] Free, Pro, Enterprise tiers
- [ ] Feature list per tier
- [ ] Highlighted "Popular" tier
- [ ] CTA buttons per tier
- [ ] Monthly/Annual toggle (optional)

**Tiers**:
```
FREE ($0/mo)
- 1 workspace
- 2 boards
- 500 feedback items
- Powered-by badge
- Community support

PRO ($29/mo)
- Unlimited workspaces
- Unlimited boards
- Unlimited feedback
- Remove branding
- AI deduplication
- Priority support

ENTERPRISE (Custom)
- Everything in Pro
- SSO/SAML
- API access
- Custom integrations
- Dedicated support
- SLA
```

**Files**:
- `admin/src/components/landing/Pricing.tsx`

**Dependencies**: Task 4.3.2

---

### Task 4.4.2: FAQ Accordion (30min)
**Description**: Add frequently asked questions section.

**Acceptance Criteria**:
- [ ] 5-6 common questions
- [ ] Accordion expand/collapse
- [ ] Smooth animation

**Questions**:
1. How is this different from UserVoice?
2. Can I self-host?
3. What's included in the free tier?
4. How does AI deduplication work?
5. Can I remove the "Powered by" badge?
6. Do you support SSO?

**Dependencies**: Task 4.4.1

---

## Epic 4.5: CTA & Footer (1h)

### Task 4.5.1: Final CTA Section (30min)
**Description**: Strong call-to-action before footer.

**Acceptance Criteria**:
- [ ] Large headline
- [ ] Email signup or "Get Started" button
- [ ] Background accent gradient

**Copy**:
```
"Ready to build products your users will love?"
[Get Started Free] [Talk to Sales]
```

**Dependencies**: Task 4.4.2

---

### Task 4.5.2: Footer (30min)
**Description**: Create site footer with links.

**Acceptance Criteria**:
- [ ] Logo
- [ ] Link sections: Product, Company, Legal
- [ ] Social links
- [ ] Copyright

**Files**:
- `admin/src/components/landing/Footer.tsx`

**Dependencies**: Task 4.5.1

---

## Epic 4.6: SEO Optimization (30min)

### Task 4.6.1: Meta Tags & OG (30min)
**Description**: Add SEO meta tags and Open Graph.

**Acceptance Criteria**:
- [ ] Title: "Collective Vision - AI-Native Feedback Platform"
- [ ] Description: Value prop summary
- [ ] OG image (create simple design)
- [ ] Twitter card meta
- [ ] Canonical URL
- [ ] Structured data (Organization, Product)

**Files**:
- `admin/index.html`
- Create `public/og-image.png`

**Meta Tags**:
```html
<title>Collective Vision - AI-Native Feedback Platform</title>
<meta name="description" content="The embeddable feedback widget that's cheap to host on Cloudflare and powered by AI. UserVoice alternative." />

<!-- Open Graph -->
<meta property="og:title" content="Collective Vision - AI-Native Feedback Platform" />
<meta property="og:description" content="Embeddable feedback collection with AI deduplication. Free to start." />
<meta property="og:image" content="https://collectivevision.io/og-image.png" />
<meta property="og:url" content="https://collectivevision.io" />

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Collective Vision" />
<meta name="twitter:description" content="AI-native feedback platform" />
<meta name="twitter:image" content="https://collectivevision.io/og-image.png" />

<!-- Structured Data -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Collective Vision",
  "description": "AI-native feedback platform",
  "applicationCategory": "BusinessApplication",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  }
}
</script>
```

**Dependencies**: Task 4.5.2

---

## Phase 4 Completion Checklist

- [ ] Hero section is compelling with live widget
- [ ] Features clearly communicate value
- [ ] Comparison shows advantages over competitors
- [ ] Pricing is clear and attractive
- [ ] FAQ answers common questions
- [ ] CTAs drive signup
- [ ] SEO meta tags are complete
- [ ] Lighthouse score > 90
- [ ] Mobile layout is polished

---

**Next Phase**: Phase 5 (Comments) can run in parallel
