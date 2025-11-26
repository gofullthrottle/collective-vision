# Mintlify-Style Distribution & SEO Research Prompt

## Purpose

Understand how **Mintlify** became the default choice for hosted documentation and a top-ranking result for queries like “AI documentation,” then translate those lessons into a **concrete distribution + SEO strategy for an AI-first feedback platform** (Collective Vision).

You are an AI assistant with access to the open web via `web_search`. Your job is to perform **focused, hypothesis-driven research**, not an unbounded historical biography.

---

## PHASE 1: BASELINE MINTLIFY PROFILE

### 1.1 Product & Positioning Snapshot

Using `web_search`, gather from Mintlify’s:
- Homepage, marketing pages, docs, blog, and press/funding announcements.

Extract, in structured bullet form:
- Core product description (what problem, for whom).
- Primary positioning statements and taglines over time (e.g., “AI documentation,” “developer hub,” etc.).
- Key buyer personas (Founders, PMs, DevRel, Eng leaders).
- Main competitors mentioned or implicitly targeted.

Deliverable:
- **“Mintlify in One Page”**: concise overview with sections for Product, Audience, Positioning, and Core Value Props.

---

## PHASE 2: DISTRIBUTION WEDGE & GO-TO-MARKET

### 2.1 Initial Wedge & Early Users

Investigate:
- Earliest visible customers (logos on site, case studies, YC/VC portfolio mentions).
- Any “open-source first” or startup-heavy skew.
- How they made it irrationally easy for early adopters to standardize on Mintlify (e.g., templates, migrations, free tier).

Questions to answer:
- What specific workflow or pain (e.g., “writing and maintaining API docs”) was the initial wedge?
- Which segments adopted first (solo devs, YC startups, mid-market SaaS, open source maintainers)?
- What made Mintlify clearly better than the status quo (self-hosted docs, Notion, GitBook, etc.)?

Deliverable:
- **Early Wedge Summary**: 10–15 bullets explaining who adopted first, why, and how that led to word-of-mouth.

### 2.2 Distribution Channels

For each of the following, document if/how Mintlify used it:
- Founder distribution: Twitter/X, podcasts, blogs, YC Demo Day, founder stories.
- Product-led loops: in-product “Powered by Mintlify” links, referral incentives, shareable templates.
- Partner/channel plays: accelerators, dev tool ecosystems, VC platforms, infra partners (e.g., Vercel/Netlify).

Deliverable:
- Table: `Channel | Evidence | Likely Impact (Low/Med/High) | Notes`.

---

## PHASE 3: SEO & CONTENT STRATEGY

### 3.1 Search Footprint & Target Intents

Use `web_search` to analyze Mintlify’s Google presence:
- Top pages ranking for queries like:
  - “API documentation”, “API docs”, “developer documentation”, “API reference”, “AI documentation”, “developer portal”.
- Landing pages and comparison pages (e.g., `.../api-docs`, `.../swagger-alternative`, etc.).

For each major query:
- Identify the **Mintlify URL** that ranks.
- Classify the search **intent** (informational, commercial, transactional).
- Summarize the page structure (headline, social proof, CTAs, examples).

Deliverable:
- **SEO Intent Map**: table `Query | Intent | Mintlify URL | Page Type | Notes`.

### 3.2 Backlinks & “Everywhere You Look” Strategy

Focus on how the **hosted docs product itself** creates backlinks:
- Sample 30–50 real customer docs sites (via `site:mintlify.app`, links from their homepage, or “Powered by Mintlify” mentions).
- For each:
  - Note whether the docs are on a custom domain or a Mintlify subdomain.
  - Check if there is a visible “Powered by Mintlify” or similar attribution link.
  - Note the URL pattern (e.g., `docs.company.com` vs `company.mintlify.app`).

Questions to answer:
- How does Mintlify balance brand visibility vs. white-labelling?
- Where do backlinks to `mintlify.com` (or subdomains) most reliably come from?
- How does this translate into SEO authority around “AI documentation” and related queries?

Deliverable:
- **Backlink Mechanics Summary**: bullet list explaining:
  - Hosted subdomains vs. custom domains.
  - Attribution & “Powered by” link patterns.
  - How these design choices accumulate authority.

### 3.3 Content & Thought Leadership

Survey Mintlify’s:
- Blog posts, guides, and “What is API documentation?” style content.

Extract:
- Canonical evergreen pieces (e.g., “How to write great API docs”).
- AI-focused posts (e.g., “AI for docs”, “AI writer”, “AI copilot for docs”).
- Any technical deep dives that appeal specifically to developers.

Deliverable:
- Table: `Article Title | Topic | Target Persona | Funnel Stage (TOFU/MOFU/BOFU) | Notes on Angle`.

---

## PHASE 4: PRODUCT MECHANICS & VIRAL LOOPS

### 4.1 Embed, Branding, and Standardization

Investigate the product experience itself:
- How is Mintlify embedded into customer sites (script snippet, Git repo integration, CLI, etc.)?
- How much friction is there to “get something usable live” (e.g., templates, importers)?
- Where and how does the Mintlify brand show up inside customer-facing docs?

Questions:
- What are the **product-level decisions** that encourage:
  - Docs to be hosted on Mintlify instead of self-hosted?
  - Docs to be discoverable and linkable by search engines?
  - Readers to notice Mintlify and click through?

Deliverable:
- **Product Virality Diagram**: textual description of the loop:
  - “Developer chooses Mintlify → Docs hosted on Mintlify/custom domain → Visitors see powered-by link → New teams adopt → More backlinks → Higher SERP rankings → More top-of-funnel traffic.”

### 4.2 Pricing & Free Tier Design

From pricing and docs:
- Enumerate plans, per-seat or usage-based components, and free tier limits.
- Identify what makes it rational to **standardize on Mintlify**:
  - “Good enough” free for early-stage teams.
  - Clear upgrade path for scaling orgs.

Deliverable:
- Table: `Plan | Price | Limits | Sweet Spot Customer | Notes on Conversion Path`.

---

## PHASE 5: TIMELINE & EVOLUTION

Using `web_search` (press, funding announcements, product launch posts, changelogs, Twitter/X):
- Build a rough **timeline** of:
  - Founding and early launches.
  - Major product expansions (AI features, developer portal, etc.).
  - Funding rounds and associated narrative shifts.

Deliverable:
- Chronological list: `Year/Month | Milestone | Category (Product, GTM, Funding) | Strategic Impact`.

---

## PHASE 6: ANALOG PATTERNS (COMPARATIVE CHECK)

Briefly compare Mintlify’s model with 2–3 similar “embed everywhere” products:
- **Intercom / Crisp / Drift** (chat widgets).
- **Typeform / Tally / SurveyMonkey** (forms/surveys).
- **Hotjar / Microsoft Clarity** (analytics/heatmaps).

For each:
- How do they turn a JavaScript snippet into:
  - Distribution (embedded widgets on thousands of domains)?
  - Backlinks and SEO authority?
  - Category ownership in search?

Deliverable:
- Table: `Product | Snippet Type | Attribution Pattern | Main Loop Summary | Lessons Relevant to Feedback Platform`.

---

## PHASE 7: SYNTHESIS FOR COLLECTIVE VISION

### 7.1 The Mintlify Playbook (for Docs)

Summarize Mintlify’s strategy in **3–5 pages equivalent** (bullets, not prose):
- **1. Wedge**: where they started and why.
- **2. Distribution Mechanics**: key loops, channels, and product decisions that compound.
- **3. SEO Strategy**: which intents they targeted, how their pages are structured, and how backlinks accumulate.
- **4. Product & Pricing Design**: how the product and pricing reinforce those loops.
- **5. Evolution**: major shifts over time and what they unlocked.

### 7.2 Collective Vision Playbook (for Feedback)

Translate the Mintlify lessons into a **1–2 page tactical plan** for an AI-first feedback product:
- **Positioning & Wedge**
  - What is the “Mintlify for feedback” wedge? (e.g., “beautiful, AI-native feedback boards with 2-line embed”).
- **Distribution Loops**
  - How to make the feedback widget and public board:
    - Easy to embed.
    - Visibly “powered by” Collective Vision (with clear opt-in/out strategies).
    - A generator of backlinks and discovery.
- **SEO Strategy**
  - Target intent clusters: “user feedback board,” “feature voting,” “AI feedback,” “product ideas portal,” etc.
  - Landing page structure and comparison pages to build.
- **Product & Pricing**
  - Free tier and usage limits designed to maximize:
    - Adoption as the default feedback system.
    - Presence of your branding/links on as many domains as possible.
- **Experiment Backlog**
  - 10–20 concrete experiments (pricing, “Powered by” positioning, templates, onboarding flows) prioritized by impact vs. effort.

Deliverables:
- **Mintlify Playbook** (3–5 pages, structured bullets).
- **Collective Vision Distribution Thesis** (1 page).
- **Experiment Backlog** (table with `Experiment | Hypothesis | Metric | Effort | Priority`).

---

## EXECUTION INSTRUCTIONS

When running this prompt:
1. **Start with PHASE 1–3** to build a solid, structured picture of Mintlify’s product, distribution, and SEO.
2. **Be systematic and tabular**: prefer tables and bullet lists over long paragraphs.
3. **Keep research bounded**: if you hit diminishing returns on any phase, summarize and move on.
4. **Prioritize synthesis**: spend at least 30–40% of the total effort on PHASE 7 (translation to Collective Vision), not just raw description.
5. **Flag assumptions**: clearly mark any inferences that are not directly supported by data as “Hypothesis”.
