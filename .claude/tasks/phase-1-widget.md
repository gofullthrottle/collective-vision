# Phase 1: Widget Polish

**Total Effort**: 8 hours
**Agent**: Frontend Specialist
**Wave**: 1-2 (Starts after Phase 0 validation)
**Priority**: P0 - Core product surface

---

## Design Direction

**Aesthetic**: Refined minimalism with subtle depth
**Tone**: Professional but approachable
**Differentiator**: Satisfying micro-interactions, smooth transitions
**Bundle Target**: < 20KB gzipped

**Color System** (CSS Variables):
```css
--cv-bg: #ffffff;
--cv-bg-subtle: #f8fafc;
--cv-border: #e2e8f0;
--cv-text: #0f172a;
--cv-text-muted: #64748b;
--cv-accent: #3b82f6;
--cv-accent-hover: #2563eb;
--cv-success: #22c55e;
--cv-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
```

---

## Epic 1.1: Design System Definition (1h)

### Task 1.1.1: Define CSS Variables & Typography (30min)
**Description**: Create the foundational design tokens as CSS custom properties.

**Acceptance Criteria**:
- [ ] Define color palette (light theme, dark theme ready)
- [ ] Define spacing scale (4px base: 4, 8, 12, 16, 24, 32, 48)
- [ ] Define typography scale (12, 14, 16, 18, 24px)
- [ ] Define border-radius tokens (4, 8, 12px)
- [ ] Define shadow tokens (sm, md, lg)
- [ ] All tokens scoped to `.cv-widget` container

**Files**:
- `src/worker.ts:5-249` (WIDGET_JS constant)

**Code Pattern**:
```css
.cv-widget {
  /* Colors */
  --cv-bg: #ffffff;
  --cv-bg-subtle: #f8fafc;
  --cv-bg-hover: #f1f5f9;
  --cv-border: #e2e8f0;
  --cv-border-focus: #3b82f6;
  --cv-text: #0f172a;
  --cv-text-secondary: #475569;
  --cv-text-muted: #94a3b8;
  --cv-accent: #3b82f6;
  --cv-accent-hover: #2563eb;
  --cv-accent-text: #ffffff;
  --cv-success: #22c55e;
  --cv-error: #ef4444;

  /* Spacing */
  --cv-space-1: 4px;
  --cv-space-2: 8px;
  --cv-space-3: 12px;
  --cv-space-4: 16px;
  --cv-space-6: 24px;
  --cv-space-8: 32px;

  /* Typography */
  --cv-font: system-ui, -apple-system, sans-serif;
  --cv-text-xs: 12px;
  --cv-text-sm: 14px;
  --cv-text-base: 16px;
  --cv-text-lg: 18px;
  --cv-text-xl: 24px;

  /* Radii */
  --cv-radius-sm: 4px;
  --cv-radius-md: 8px;
  --cv-radius-lg: 12px;
  --cv-radius-full: 9999px;

  /* Shadows */
  --cv-shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --cv-shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --cv-shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);

  /* Transitions */
  --cv-transition-fast: 150ms ease;
  --cv-transition-base: 200ms ease;
  --cv-transition-slow: 300ms ease;
}
```

**Dependencies**: None

---

### Task 1.1.2: Define Animation Keyframes (30min)
**Description**: Create reusable animation keyframes for micro-interactions.

**Acceptance Criteria**:
- [ ] Fade-in animation for widget mount
- [ ] Slide-up animation for list items (staggered)
- [ ] Scale-pop animation for vote button
- [ ] Pulse animation for loading states
- [ ] Shake animation for errors

**Files**:
- `src/worker.ts` (WIDGET_JS)

**Code Pattern**:
```css
@keyframes cv-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes cv-slide-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes cv-scale-pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

@keyframes cv-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes cv-number-up {
  from { transform: translateY(0); opacity: 1; }
  to { transform: translateY(-100%); opacity: 0; }
}
```

**Dependencies**: Task 1.1.1

---

## Epic 1.2: Container & Layout Redesign (2h)

### Task 1.2.1: Widget Container Shell (1h)
**Description**: Create the main widget container with proper styling.

**Acceptance Criteria**:
- [ ] Clean white background with subtle shadow
- [ ] Rounded corners (12px)
- [ ] Proper max-width (400px default, configurable)
- [ ] Fade-in animation on mount
- [ ] Header with "Share your feedback" title
- [ ] Tabs: "Ideas" | "Submit" (optional, can be single view)

**Files**:
- `src/worker.ts` (WIDGET_JS)

**Markup Structure**:
```html
<div class="cv-widget" data-theme="light">
  <div class="cv-container">
    <header class="cv-header">
      <h2 class="cv-title">Share your feedback</h2>
      <p class="cv-subtitle">Help us improve</p>
    </header>
    <main class="cv-main">
      <!-- Content: list or form -->
    </main>
    <footer class="cv-footer">
      <!-- Powered by badge -->
    </footer>
  </div>
</div>
```

**Dependencies**: Task 1.1.2

---

### Task 1.2.2: Responsive Layout & Theming (1h)
**Description**: Make widget responsive and support theme customization.

**Acceptance Criteria**:
- [ ] Widget adapts to container width (100% up to max-width)
- [ ] Touch-friendly on mobile (min 44px tap targets)
- [ ] Support `data-theme="dark"` attribute
- [ ] Support `data-accent="#custom"` for accent color override
- [ ] Proper scrolling for long lists (max-height with overflow)

**Files**:
- `src/worker.ts` (WIDGET_JS)

**Code Pattern**:
```css
.cv-widget[data-theme="dark"] {
  --cv-bg: #0f172a;
  --cv-bg-subtle: #1e293b;
  --cv-text: #f8fafc;
  --cv-border: #334155;
}

@media (max-width: 480px) {
  .cv-widget {
    --cv-text-base: 15px;
  }
  .cv-button {
    min-height: 44px;
  }
}
```

**Dependencies**: Task 1.2.1

---

## Epic 1.3: Feedback List & Vote Interactions (2h)

### Task 1.3.1: Feedback Item Card (1h)
**Description**: Design the individual feedback item card.

**Acceptance Criteria**:
- [ ] Clean card layout with subtle border
- [ ] Title (bold, 16px) and description (muted, 14px)
- [ ] Vote count badge on left side
- [ ] Status indicator (if available)
- [ ] Hover state with slight lift
- [ ] Staggered slide-up animation on load

**Files**:
- `src/worker.ts` (WIDGET_JS)

**Markup Structure**:
```html
<article class="cv-item" style="animation-delay: 0.1s">
  <button class="cv-vote-btn" aria-label="Upvote">
    <svg class="cv-vote-icon"><!-- Arrow up --></svg>
    <span class="cv-vote-count">12</span>
  </button>
  <div class="cv-item-content">
    <h3 class="cv-item-title">Dark mode support</h3>
    <p class="cv-item-desc">Add dark mode toggle in settings</p>
    <div class="cv-item-meta">
      <span class="cv-status cv-status--planned">Planned</span>
    </div>
  </div>
</article>
```

**CSS Pattern**:
```css
.cv-item {
  display: flex;
  gap: var(--cv-space-3);
  padding: var(--cv-space-4);
  border: 1px solid var(--cv-border);
  border-radius: var(--cv-radius-md);
  background: var(--cv-bg);
  animation: cv-slide-up var(--cv-transition-base) ease-out forwards;
  opacity: 0;
  transition: box-shadow var(--cv-transition-fast),
              transform var(--cv-transition-fast);
}

.cv-item:hover {
  box-shadow: var(--cv-shadow-md);
  transform: translateY(-1px);
}
```

**Dependencies**: Task 1.2.2

---

### Task 1.3.2: Vote Button with Animation (1h)
**Description**: Create the vote button with satisfying micro-interaction.

**Acceptance Criteria**:
- [ ] Vertical layout: arrow icon above count
- [ ] Arrow changes to filled/accent when voted
- [ ] Count animates up when voting (number slides up, new slides in)
- [ ] Scale-pop animation on click
- [ ] Disabled state after voting (or toggle to unvote)
- [ ] Accessible: proper ARIA labels

**Files**:
- `src/worker.ts` (WIDGET_JS)

**JavaScript Pattern**:
```javascript
async function handleVote(btn, itemId) {
  const countEl = btn.querySelector('.cv-vote-count');
  const currentCount = parseInt(countEl.textContent);

  // Optimistic update with animation
  btn.classList.add('cv-voted', 'cv-vote-animating');
  countEl.textContent = currentCount + 1;

  try {
    const res = await fetch(`${API_BASE}/${WORKSPACE}/${BOARD}/feedback/${itemId}/votes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ externalUserId: getUserId() })
    });
    const data = await res.json();
    countEl.textContent = data.vote_count;
  } catch (e) {
    // Rollback on error
    btn.classList.remove('cv-voted');
    countEl.textContent = currentCount;
  }

  setTimeout(() => btn.classList.remove('cv-vote-animating'), 300);
}
```

**Dependencies**: Task 1.3.1

---

## Epic 1.4: Submit Form Redesign (1.5h)

### Task 1.4.1: Form Layout & Styling (45min)
**Description**: Create a clean, inviting submit form.

**Acceptance Criteria**:
- [ ] Floating label inputs (or clean placeholder approach)
- [ ] Title input (required, max 200 chars)
- [ ] Description textarea (optional, max 2000 chars)
- [ ] Character count indicator
- [ ] Submit button with loading state
- [ ] Clear focus states with accent color

**Files**:
- `src/worker.ts` (WIDGET_JS)

**Markup Structure**:
```html
<form class="cv-form" id="cv-submit-form">
  <div class="cv-field">
    <input
      type="text"
      id="cv-title"
      class="cv-input"
      placeholder="What's your idea?"
      maxlength="200"
      required
    />
    <span class="cv-char-count">0/200</span>
  </div>
  <div class="cv-field">
    <textarea
      id="cv-description"
      class="cv-textarea"
      placeholder="Add more details (optional)"
      maxlength="2000"
      rows="3"
    ></textarea>
    <span class="cv-char-count">0/2000</span>
  </div>
  <button type="submit" class="cv-submit-btn">
    <span class="cv-btn-text">Submit Idea</span>
    <span class="cv-btn-loading" hidden>
      <svg class="cv-spinner">...</svg>
    </span>
  </button>
</form>
```

**Dependencies**: Task 1.2.2

---

### Task 1.4.2: Form Validation & Submission (45min)
**Description**: Implement form validation and submission with feedback.

**Acceptance Criteria**:
- [ ] Real-time validation on blur
- [ ] Error states with red border and message
- [ ] Submit button disabled when invalid
- [ ] Loading spinner during submission
- [ ] Success state transitions to thank-you view
- [ ] Error handling with retry option

**Files**:
- `src/worker.ts` (WIDGET_JS)

**JavaScript Pattern**:
```javascript
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const title = form.querySelector('#cv-title').value.trim();
  const description = form.querySelector('#cv-description').value.trim();

  if (!title) {
    showFieldError('cv-title', 'Title is required');
    return;
  }

  setSubmitLoading(true);

  try {
    const res = await fetch(`${API_BASE}/${WORKSPACE}/${BOARD}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, externalUserId: getUserId() })
    });

    if (!res.ok) throw new Error('Submission failed');

    showThankYouState();
  } catch (e) {
    showFormError('Something went wrong. Please try again.');
  } finally {
    setSubmitLoading(false);
  }
});
```

**Dependencies**: Task 1.4.1

---

## Epic 1.5: Powered-By Badge & Thank-You State (1h)

### Task 1.5.1: Powered-By Badge (30min)
**Description**: Add the viral distribution badge.

**Acceptance Criteria**:
- [ ] "Powered by Collective Vision" text with link
- [ ] Subtle styling (small, muted, bottom of widget)
- [ ] Opens in new tab
- [ ] Can be hidden via `data-hide-badge="true"` (paid tier)
- [ ] Accessible link with proper focus state

**Files**:
- `src/worker.ts` (WIDGET_JS)

**Markup**:
```html
<footer class="cv-footer">
  <a href="https://collectivevision.io?ref=widget"
     target="_blank"
     rel="noopener"
     class="cv-powered-by">
    Powered by <strong>Collective Vision</strong>
  </a>
</footer>
```

**CSS**:
```css
.cv-powered-by {
  display: block;
  text-align: center;
  padding: var(--cv-space-3);
  font-size: var(--cv-text-xs);
  color: var(--cv-text-muted);
  text-decoration: none;
  border-top: 1px solid var(--cv-border);
}

.cv-powered-by:hover {
  color: var(--cv-accent);
}

.cv-widget[data-hide-badge="true"] .cv-footer {
  display: none;
}
```

**Dependencies**: Task 1.2.1

---

### Task 1.5.2: Thank-You State (30min)
**Description**: Create engaging post-submission confirmation.

**Acceptance Criteria**:
- [ ] Checkmark animation (draw effect)
- [ ] "Thanks for your feedback!" message
- [ ] CTA: "Building your own product? Try Collective Vision free"
- [ ] Button to submit another idea
- [ ] Auto-transitions back to list after 5 seconds (optional)

**Files**:
- `src/worker.ts` (WIDGET_JS)

**Markup**:
```html
<div class="cv-thank-you" hidden>
  <div class="cv-success-icon">
    <svg><!-- Animated checkmark --></svg>
  </div>
  <h3 class="cv-thank-you-title">Thanks for your feedback!</h3>
  <p class="cv-thank-you-text">We'll review your idea and get back to you.</p>
  <div class="cv-thank-you-actions">
    <button class="cv-btn cv-btn--secondary" onclick="showListView()">
      View all ideas
    </button>
    <button class="cv-btn cv-btn--primary" onclick="showSubmitForm()">
      Submit another
    </button>
  </div>
  <a href="https://collectivevision.io?ref=thankyou"
     target="_blank"
     class="cv-thank-you-cta">
    Building your own product? Try Collective Vision free →
  </a>
</div>
```

**Dependencies**: Task 1.4.2

---

## Epic 1.6: Mobile Responsiveness (30min)

### Task 1.6.1: Mobile Polish (30min)
**Description**: Ensure widget works beautifully on mobile devices.

**Acceptance Criteria**:
- [ ] All tap targets are at least 44x44px
- [ ] Text is readable without zooming (min 16px inputs)
- [ ] No horizontal scroll
- [ ] Vote button easy to tap
- [ ] Form inputs don't cause zoom on focus (iOS)
- [ ] Smooth scrolling for feedback list

**Files**:
- `src/worker.ts` (WIDGET_JS)

**CSS Pattern**:
```css
@media (max-width: 480px) {
  .cv-widget {
    font-size: 16px; /* Prevent iOS zoom */
  }

  .cv-vote-btn {
    min-width: 44px;
    min-height: 44px;
  }

  .cv-input,
  .cv-textarea {
    font-size: 16px; /* Prevent iOS zoom on focus */
  }

  .cv-submit-btn {
    width: 100%;
    min-height: 48px;
  }

  .cv-item {
    padding: var(--cv-space-3);
  }
}

/* Smooth scrolling for list */
.cv-list {
  max-height: 400px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
}
```

**Dependencies**: All previous tasks

---

## Phase 1 Completion Checklist

- [ ] Widget has distinctive, polished design
- [ ] Vote interaction is satisfying
- [ ] Submit form is clean and functional
- [ ] Powered-by badge is visible
- [ ] Thank-you state encourages virality
- [ ] Mobile experience is smooth
- [ ] Bundle size < 20KB gzipped
- [ ] No console errors

---

**Next Phase**: Phase 2 (Admin API) - can run in parallel
