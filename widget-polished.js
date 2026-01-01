(function () {
  var script = document.currentScript;
  if (!script) return;

  var workspace = script.dataset.workspace || "default";
  var board = script.dataset.board || "main";
  var apiBase = script.dataset.apiBase;
  var theme = script.dataset.theme || "light";
  var accentColor = script.dataset.accent || "#3b82f6";
  var poweredByUrl = script.dataset.badgeUrl || "https://collective-vision.ai";
  var ctaUrl = script.dataset.ctaUrl || script.dataset.badgeCtaUrl || "https://collective-vision.ai/signup";
  var ctaText = script.dataset.ctaText || "Building your own product? Create a roadmap like this in 30 seconds.";
  var hideBadge = script.dataset.hideBadge === "true";

  if (!apiBase) {
    try {
      var srcUrl = new URL(script.src);
      apiBase = srcUrl.origin;
    } catch (e) {
      apiBase = "";
    }
  }

  // Inject styles
  var styleId = "cv-widget-styles";
  if (!document.getElementById(styleId)) {
    var style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      :root {
        --cv-bg: #ffffff;
        --cv-bg-elevated: #fafafa;
        --cv-border: #e5e5e5;
        --cv-border-subtle: #f0f0f0;
        --cv-text: #171717;
        --cv-text-secondary: #737373;
        --cv-text-muted: #a3a3a3;
        --cv-accent: ${accentColor};
        --cv-accent-hover: #2563eb;
        --cv-success: #22c55e;
        --cv-radius-sm: 6px;
        --cv-radius-md: 10px;
        --cv-radius-lg: 14px;
        --cv-shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
        --cv-shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1);
        --cv-shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1);
        --cv-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      [data-theme="dark"] {
        --cv-bg: #18181b;
        --cv-bg-elevated: #27272a;
        --cv-border: #3f3f46;
        --cv-border-subtle: #27272a;
        --cv-text: #fafafa;
        --cv-text-secondary: #a1a1aa;
        --cv-text-muted: #71717a;
        --cv-accent: ${accentColor};
        --cv-accent-hover: #60a5fa;
        --cv-success: #4ade80;
      }

      @keyframes cv-fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes cv-slideUp {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes cv-scalePop {
        0% { transform: scale(1); }
        50% { transform: scale(1.15); }
        100% { transform: scale(1); }
      }

      @keyframes cv-checkmark {
        0% { stroke-dashoffset: 24; }
        100% { stroke-dashoffset: 0; }
      }

      @keyframes cv-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      #cv-feedback-widget {
        font-family: var(--cv-font);
        background: var(--cv-bg);
        border: 1px solid var(--cv-border);
        border-radius: var(--cv-radius-lg);
        padding: 24px;
        max-width: 480px;
        box-shadow: var(--cv-shadow-md);
        animation: cv-fadeIn 0.3s ease-out;
      }

      .cv-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
      }

      .cv-header-icon {
        width: 24px;
        height: 24px;
        color: var(--cv-accent);
      }

      .cv-header-content h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: var(--cv-text);
      }

      .cv-header-content p {
        margin: 2px 0 0 0;
        font-size: 13px;
        color: var(--cv-text-secondary);
      }

      .cv-feedback-item {
        display: flex;
        gap: 12px;
        padding: 14px;
        background: var(--cv-bg-elevated);
        border: 1px solid var(--cv-border);
        border-radius: var(--cv-radius-md);
        margin-bottom: 10px;
        transition: all 0.2s ease;
        animation: cv-slideUp 0.3s ease-out;
      }

      .cv-feedback-item:hover {
        border-color: var(--cv-border);
        box-shadow: var(--cv-shadow-sm);
      }

      .cv-vote-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-width: 44px;
        min-height: 44px;
        padding: 8px;
        background: var(--cv-bg);
        border: 1.5px solid var(--cv-border);
        border-radius: var(--cv-radius-sm);
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 14px;
        font-weight: 500;
        color: var(--cv-text-secondary);
      }

      .cv-vote-btn:hover:not(:disabled) {
        border-color: var(--cv-accent);
        color: var(--cv-accent);
      }

      .cv-vote-btn.voted {
        background: var(--cv-accent);
        border-color: var(--cv-accent);
        color: white;
      }

      .cv-vote-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .cv-vote-arrow {
        width: 14px;
        height: 14px;
        margin-bottom: 2px;
      }

      .cv-vote-count {
        font-size: 13px;
        font-weight: 600;
      }

      .cv-feedback-content {
        flex: 1;
      }

      .cv-feedback-title {
        font-size: 14px;
        font-weight: 600;
        color: var(--cv-text);
        margin-bottom: 4px;
      }

      .cv-feedback-description {
        font-size: 13px;
        color: var(--cv-text-secondary);
        line-height: 1.5;
      }

      .cv-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin: 20px 0;
      }

      .cv-input-wrapper {
        position: relative;
      }

      .cv-input,
      .cv-textarea {
        width: 100%;
        padding: 12px;
        font-size: 16px;
        font-family: var(--cv-font);
        color: var(--cv-text);
        background: var(--cv-bg);
        border: 1.5px solid var(--cv-border);
        border-radius: var(--cv-radius-md);
        transition: all 0.2s ease;
        box-sizing: border-box;
      }

      .cv-input:focus,
      .cv-textarea:focus {
        outline: none;
        border-color: var(--cv-accent);
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }

      .cv-textarea {
        resize: vertical;
        min-height: 80px;
      }

      .cv-char-count {
        position: absolute;
        bottom: 8px;
        right: 12px;
        font-size: 12px;
        color: var(--cv-text-muted);
        pointer-events: none;
      }

      .cv-submit-btn {
        align-self: flex-start;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 24px;
        min-height: 44px;
        font-size: 14px;
        font-weight: 600;
        color: white;
        background: var(--cv-accent);
        border: none;
        border-radius: var(--cv-radius-md);
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .cv-submit-btn:hover:not(:disabled) {
        background: var(--cv-accent-hover);
        transform: translateY(-1px);
        box-shadow: var(--cv-shadow-md);
      }

      .cv-submit-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
      }

      .cv-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255,255,255,0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: cv-spin 0.6s linear infinite;
      }

      .cv-thank-you {
        text-align: center;
        padding: 32px 0;
      }

      .cv-checkmark-container {
        display: inline-block;
        margin-bottom: 16px;
      }

      .cv-checkmark {
        width: 48px;
        height: 48px;
      }

      .cv-checkmark-circle {
        stroke: var(--cv-success);
        stroke-width: 2;
        fill: none;
      }

      .cv-checkmark-check {
        stroke: var(--cv-success);
        stroke-width: 2.5;
        fill: none;
        stroke-dasharray: 24;
        stroke-dashoffset: 24;
        animation: cv-checkmark 0.5s ease-out 0.2s forwards;
      }

      .cv-thank-you h3 {
        margin: 0 0 8px 0;
        font-size: 18px;
        font-weight: 600;
        color: var(--cv-text);
      }

      .cv-thank-you p {
        margin: 0 0 16px 0;
        font-size: 14px;
        color: var(--cv-text-secondary);
      }

      .cv-thank-you-cta {
        display: inline-block;
        padding: 10px 20px;
        font-size: 13px;
        color: var(--cv-accent);
        background: transparent;
        border: 1.5px solid var(--cv-border);
        border-radius: var(--cv-radius-md);
        text-decoration: none;
        transition: all 0.2s ease;
        margin-bottom: 12px;
      }

      .cv-thank-you-cta:hover {
        border-color: var(--cv-accent);
        background: rgba(59, 130, 246, 0.05);
      }

      .cv-submit-another {
        display: inline-block;
        font-size: 13px;
        font-weight: 500;
        color: var(--cv-accent);
        background: none;
        border: none;
        cursor: pointer;
        text-decoration: underline;
      }

      .cv-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 20px;
        padding-top: 16px;
        border-top: 1px solid var(--cv-border-subtle);
      }

      .cv-badge {
        font-size: 12px;
        color: var(--cv-text-muted);
        text-decoration: none;
        transition: color 0.2s ease;
      }

      .cv-badge:hover {
        color: var(--cv-text-secondary);
      }

      .cv-footer-cta {
        font-size: 12px;
        font-weight: 500;
        color: var(--cv-accent);
        text-decoration: none;
        transition: opacity 0.2s ease;
      }

      .cv-footer-cta:hover {
        opacity: 0.8;
      }

      .cv-empty {
        text-align: center;
        padding: 32px 0;
        color: var(--cv-text-muted);
        font-size: 14px;
      }

      .hidden {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Create container
  var container = document.createElement("div");
  container.id = "cv-feedback-widget";
  container.setAttribute("data-theme", theme);

  // Header
  var header = document.createElement("div");
  header.className = "cv-header";

  var headerIcon = document.createElement("div");
  headerIcon.className = "cv-header-icon";
  headerIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';

  var headerContent = document.createElement("div");
  headerContent.className = "cv-header-content";
  headerContent.innerHTML = '<h2>Feedback</h2><p>Help shape the roadmap</p>';

  header.appendChild(headerIcon);
  header.appendChild(headerContent);
  container.appendChild(header);

  // Feedback list
  var list = document.createElement("div");
  list.id = "cv-feedback-list";
  container.appendChild(list);

  // Form
  var form = document.createElement("form");
  form.className = "cv-form";

  var titleWrapper = document.createElement("div");
  titleWrapper.className = "cv-input-wrapper";

  var titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.className = "cv-input";
  titleInput.placeholder = "Share a feature idea...";
  titleInput.required = true;
  titleInput.maxLength = 160;

  var titleCounter = document.createElement("span");
  titleCounter.className = "cv-char-count";
  titleCounter.textContent = "0/160";

  titleWrapper.appendChild(titleInput);
  titleWrapper.appendChild(titleCounter);

  var descWrapper = document.createElement("div");
  descWrapper.className = "cv-input-wrapper";

  var descriptionInput = document.createElement("textarea");
  descriptionInput.className = "cv-textarea";
  descriptionInput.placeholder = "Optional details...";
  descriptionInput.maxLength = 4000;

  var descCounter = document.createElement("span");
  descCounter.className = "cv-char-count";
  descCounter.textContent = "0/4000";

  descWrapper.appendChild(descriptionInput);
  descWrapper.appendChild(descCounter);

  var submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "cv-submit-btn";
  submit.innerHTML = '<span>Submit feedback</span>';

  form.appendChild(titleWrapper);
  form.appendChild(descWrapper);
  form.appendChild(submit);
  container.appendChild(form);

  // Thank you state
  var thankYou = document.createElement("div");
  thankYou.className = "cv-thank-you hidden";
  thankYou.innerHTML = `
    <div class="cv-checkmark-container">
      <svg class="cv-checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
        <circle class="cv-checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
        <path class="cv-checkmark-check" fill="none" d="M14 27l7 7 16-16"/>
      </svg>
    </div>
    <h3>Thanks for your feedback!</h3>
    <p>We'll review it and keep you updated.</p>
    <a href="${ctaUrl}" target="_blank" rel="noopener noreferrer" class="cv-thank-you-cta">${ctaText}</a>
    <br>
    <button type="button" class="cv-submit-another">Submit another</button>
  `;
  container.appendChild(thankYou);

  // Footer badge
  if (!hideBadge) {
    var footer = document.createElement("div");
    footer.className = "cv-footer";

    var badge = document.createElement("a");
    badge.className = "cv-badge";
    badge.href = poweredByUrl;
    badge.target = "_blank";
    badge.rel = "noopener noreferrer";
    badge.textContent = script.dataset.badgeText || "Powered by Collective Vision";

    var footerCta = document.createElement("a");
    footerCta.className = "cv-footer-cta";
    footerCta.href = ctaUrl;
    footerCta.target = "_blank";
    footerCta.rel = "noopener noreferrer";
    footerCta.textContent = script.dataset.badgeCtaText || "Create your own";

    footer.appendChild(badge);
    footer.appendChild(footerCta);
    container.appendChild(footer);
  }

  // Insert into DOM
  script.parentNode && script.parentNode.insertBefore(container, script.nextSibling);

  // User ID management
  var storageKey = "cv_uid";
  var uid = null;
  try {
    uid = localStorage.getItem(storageKey);
    if (!uid) {
      uid = "anon_" + Math.random().toString(36).slice(2);
      localStorage.setItem(storageKey, uid);
    }
  } catch (e) {
    uid = "anon_" + Math.random().toString(36).slice(2);
  }

  // Check if user voted
  function hasVoted(feedbackId) {
    try {
      return localStorage.getItem("cv_voted_" + feedbackId) === "true";
    } catch (e) {
      return false;
    }
  }

  function markVoted(feedbackId) {
    try {
      localStorage.setItem("cv_voted_" + feedbackId, "true");
    } catch (e) {}
  }

  // Render feedback
  function renderFeedback(items) {
    list.innerHTML = "";

    if (!items || !items.length) {
      var empty = document.createElement("div");
      empty.className = "cv-empty";
      empty.textContent = "No feedback yet. Be the first!";
      list.appendChild(empty);
      return;
    }

    items.forEach(function (item, index) {
      var card = document.createElement("div");
      card.className = "cv-feedback-item";
      card.style.animationDelay = (index * 50) + "ms";

      var voteBtn = document.createElement("button");
      voteBtn.type = "button";
      voteBtn.className = "cv-vote-btn";
      if (hasVoted(item.id)) {
        voteBtn.classList.add("voted");
      }

      var arrow = document.createElement("div");
      arrow.className = "cv-vote-arrow";
      arrow.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l-8 8h5v8h6v-8h5z"/></svg>';

      var count = document.createElement("div");
      count.className = "cv-vote-count";
      count.textContent = item.vote_count || 0;

      voteBtn.appendChild(arrow);
      voteBtn.appendChild(count);

      voteBtn.addEventListener("click", function () {
        voteFeedback(item.id, voteBtn, count);
      });

      var content = document.createElement("div");
      content.className = "cv-feedback-content";

      var title = document.createElement("div");
      title.className = "cv-feedback-title";
      title.textContent = item.title;

      content.appendChild(title);

      if (item.description) {
        var desc = document.createElement("div");
        desc.className = "cv-feedback-description";
        desc.textContent = item.description;
        content.appendChild(desc);
      }

      card.appendChild(voteBtn);
      card.appendChild(content);
      list.appendChild(card);
    });
  }

  // Fetch feedback
  function fetchFeedback() {
    fetch(
      apiBase +
        "/api/v1/" +
        encodeURIComponent(workspace) +
        "/" +
        encodeURIComponent(board) +
        "/feedback"
    )
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        renderFeedback(data.items || []);
      })
      .catch(function () {
        // ignore
      });
  }

  // Vote on feedback
  function voteFeedback(id, button, countEl) {
    if (hasVoted(id)) return;

    button.disabled = true;

    fetch(
      apiBase +
        "/api/v1/" +
        encodeURIComponent(workspace) +
        "/" +
        encodeURIComponent(board) +
        "/feedback/" +
        id +
        "/votes",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ externalUserId: uid })
      }
    )
      .then(function (res) {
        if (!res.ok) throw new Error("Vote failed");
        return res.json();
      })
      .then(function (data) {
        if (typeof data.vote_count === "number") {
          countEl.textContent = data.vote_count;
          button.classList.add("voted");
          button.style.animation = "cv-scalePop 0.3s ease-out";
          markVoted(id);
        }
      })
      .catch(function () {
        // ignore
      })
      .finally(function () {
        button.disabled = false;
      });
  }

  // Show thank you state
  function showThankYou() {
    form.classList.add("hidden");
    list.classList.add("hidden");
    thankYou.classList.remove("hidden");
  }

  // Reset to form
  function resetToForm() {
    thankYou.classList.add("hidden");
    list.classList.remove("hidden");
    form.classList.remove("hidden");
    titleInput.value = "";
    descriptionInput.value = "";
    titleCounter.textContent = "0/160";
    descCounter.textContent = "0/4000";
  }

  // Character counters
  titleInput.addEventListener("input", function () {
    titleCounter.textContent = titleInput.value.length + "/160";
  });

  descriptionInput.addEventListener("input", function () {
    descCounter.textContent = descriptionInput.value.length + "/4000";
  });

  // Submit feedback
  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var title = titleInput.value.trim();
    var description = descriptionInput.value.trim();
    if (!title) return;

    submit.disabled = true;
    submit.innerHTML = '<div class="cv-spinner"></div><span>Submitting...</span>';

    fetch(
      apiBase +
        "/api/v1/" +
        encodeURIComponent(workspace) +
        "/" +
        encodeURIComponent(board) +
        "/feedback",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title,
          description: description,
          externalUserId: uid
        })
      }
    )
      .then(function (res) {
        if (!res.ok) return res.json().then(function (payload) {
          throw new Error(payload && payload.error ? payload.error : "Failed");
        });
        return res.json();
      })
      .then(function () {
        showThankYou();
        fetchFeedback();
      })
      .catch(function (err) {
        alert(err && err.message ? err.message : "Could not submit feedback.");
      })
      .finally(function () {
        submit.disabled = false;
        submit.innerHTML = "<span>Submit feedback</span>";
      });
  });

  // Submit another button
  thankYou.querySelector(".cv-submit-another").addEventListener("click", function () {
    resetToForm();
  });

  // Initial fetch
  fetchFeedback();
})();
