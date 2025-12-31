export interface Env {
  DB: D1Database;
  ADMIN_API_TOKEN?: string;
}

const MAX_TITLE_LENGTH = 160;
const MAX_DESCRIPTION_LENGTH = 4000;
const MAX_EXTERNAL_USER_ID_LENGTH = 128;
const MAX_COMMENT_LENGTH = 2000;
const ALLOWED_STATUSES = new Set([
  "open",
  "under_review",
  "planned",
  "in_progress",
  "done",
  "declined"
]);
const ALLOWED_MODERATION_STATES = new Set(["pending", "approved", "rejected"]);
const RATE_LIMITS = {
  feedbackCreate: { limit: 5, windowSeconds: 600 },
  feedbackVote: { limit: 30, windowSeconds: 600 },
  commentCreate: { limit: 10, windowSeconds: 600 }
} as const;

const WIDGET_JS = String.raw`(function () {
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
    style.textContent = ":root { --cv-bg: #ffffff; --cv-bg-elevated: #fafafa; --cv-border: #e5e5e5; --cv-border-subtle: #f0f0f0; --cv-text: #171717; --cv-text-secondary: #737373; --cv-text-muted: #a3a3a3; --cv-accent: " + accentColor + "; --cv-accent-hover: #2563eb; --cv-success: #22c55e; --cv-radius-sm: 6px; --cv-radius-md: 10px; --cv-radius-lg: 14px; --cv-shadow-sm: 0 1px 2px rgba(0,0,0,0.05); --cv-shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1); --cv-shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1); --cv-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; } [data-theme='dark'] { --cv-bg: #18181b; --cv-bg-elevated: #27272a; --cv-border: #3f3f46; --cv-border-subtle: #27272a; --cv-text: #fafafa; --cv-text-secondary: #a1a1aa; --cv-text-muted: #71717a; --cv-accent: " + accentColor + "; --cv-accent-hover: #60a5fa; --cv-success: #4ade80; } @keyframes cv-fadeIn { from { opacity: 0; } to { opacity: 1; } } @keyframes cv-slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } } @keyframes cv-scalePop { 0% { transform: scale(1); } 50% { transform: scale(1.15); } 100% { transform: scale(1); } } @keyframes cv-checkmark { 0% { stroke-dashoffset: 24; } 100% { stroke-dashoffset: 0; } } @keyframes cv-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } #cv-feedback-widget { font-family: var(--cv-font); background: var(--cv-bg); border: 1px solid var(--cv-border); border-radius: var(--cv-radius-lg); padding: 24px; max-width: 480px; box-shadow: var(--cv-shadow-md); animation: cv-fadeIn 0.3s ease-out; } .cv-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; } .cv-header-icon { width: 24px; height: 24px; color: var(--cv-accent); } .cv-header-content h2 { margin: 0; font-size: 18px; font-weight: 600; color: var(--cv-text); } .cv-header-content p { margin: 2px 0 0 0; font-size: 13px; color: var(--cv-text-secondary); } .cv-feedback-item { display: flex; flex-direction: column; gap: 12px; padding: 14px; background: var(--cv-bg-elevated); border: 1px solid var(--cv-border); border-radius: var(--cv-radius-md); margin-bottom: 10px; transition: all 0.2s ease; animation: cv-slideUp 0.3s ease-out; } .cv-feedback-item:hover { box-shadow: var(--cv-shadow-sm); } .cv-feedback-row { display: flex; gap: 12px; } .cv-vote-btn { display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 44px; min-height: 44px; padding: 8px; background: var(--cv-bg); border: 1.5px solid var(--cv-border); border-radius: var(--cv-radius-sm); cursor: pointer; transition: all 0.2s ease; font-size: 14px; font-weight: 500; color: var(--cv-text-secondary); } .cv-vote-btn:hover:not(:disabled) { border-color: var(--cv-accent); color: var(--cv-accent); } .cv-vote-btn.voted { background: var(--cv-accent); border-color: var(--cv-accent); color: white; } .cv-vote-btn:disabled { opacity: 0.5; cursor: not-allowed; } .cv-vote-arrow { width: 14px; height: 14px; margin-bottom: 2px; } .cv-vote-count { font-size: 13px; font-weight: 600; } .cv-feedback-content { flex: 1; } .cv-feedback-title { font-size: 14px; font-weight: 600; color: var(--cv-text); margin-bottom: 4px; } .cv-feedback-description { font-size: 13px; color: var(--cv-text-secondary); line-height: 1.5; margin-bottom: 8px; } .cv-comment-toggle { font-size: 12px; color: var(--cv-accent); background: none; border: none; cursor: pointer; padding: 4px 0; font-weight: 500; transition: opacity 0.2s; } .cv-comment-toggle:hover { opacity: 0.8; } .cv-comments-section { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--cv-border-subtle); } .cv-comment { padding: 8px 0; border-bottom: 1px solid var(--cv-border-subtle); } .cv-comment:last-child { border-bottom: none; } .cv-comment-author { font-size: 12px; font-weight: 600; color: var(--cv-text); margin-bottom: 4px; } .cv-comment-body { font-size: 13px; color: var(--cv-text-secondary); line-height: 1.4; } .cv-comment-form { margin-top: 8px; display: flex; flex-direction: column; gap: 8px; } .cv-comment-input { width: 100%; padding: 8px 12px; font-size: 13px; font-family: var(--cv-font); color: var(--cv-text); background: var(--cv-bg); border: 1.5px solid var(--cv-border); border-radius: var(--cv-radius-sm); resize: vertical; min-height: 60px; box-sizing: border-box; } .cv-comment-input:focus { outline: none; border-color: var(--cv-accent); box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1); } .cv-comment-submit { align-self: flex-end; padding: 6px 16px; font-size: 13px; font-weight: 600; color: white; background: var(--cv-accent); border: none; border-radius: var(--cv-radius-sm); cursor: pointer; transition: all 0.2s ease; } .cv-comment-submit:hover:not(:disabled) { background: var(--cv-accent-hover); } .cv-comment-submit:disabled { opacity: 0.6; cursor: not-allowed; } .cv-form { display: flex; flex-direction: column; gap: 12px; margin: 20px 0; } .cv-input-wrapper { position: relative; } .cv-input, .cv-textarea { width: 100%; padding: 12px; font-size: 16px; font-family: var(--cv-font); color: var(--cv-text); background: var(--cv-bg); border: 1.5px solid var(--cv-border); border-radius: var(--cv-radius-md); transition: all 0.2s ease; box-sizing: border-box; } .cv-input:focus, .cv-textarea:focus { outline: none; border-color: var(--cv-accent); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); } .cv-textarea { resize: vertical; min-height: 80px; } .cv-char-count { position: absolute; bottom: 8px; right: 12px; font-size: 12px; color: var(--cv-text-muted); pointer-events: none; } .cv-submit-btn { align-self: flex-start; display: flex; align-items: center; gap: 8px; padding: 12px 24px; min-height: 44px; font-size: 14px; font-weight: 600; color: white; background: var(--cv-accent); border: none; border-radius: var(--cv-radius-md); cursor: pointer; transition: all 0.2s ease; } .cv-submit-btn:hover:not(:disabled) { background: var(--cv-accent-hover); transform: translateY(-1px); box-shadow: var(--cv-shadow-md); } .cv-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; } .cv-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: cv-spin 0.6s linear infinite; } .cv-thank-you { text-align: center; padding: 32px 0; } .cv-checkmark-container { display: inline-block; margin-bottom: 16px; } .cv-checkmark { width: 48px; height: 48px; } .cv-checkmark-circle { stroke: var(--cv-success); stroke-width: 2; fill: none; } .cv-checkmark-check { stroke: var(--cv-success); stroke-width: 2.5; fill: none; stroke-dasharray: 24; stroke-dashoffset: 24; animation: cv-checkmark 0.5s ease-out 0.2s forwards; } .cv-thank-you h3 { margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: var(--cv-text); } .cv-thank-you p { margin: 0 0 16px 0; font-size: 14px; color: var(--cv-text-secondary); } .cv-thank-you-cta { display: inline-block; padding: 10px 20px; font-size: 13px; color: var(--cv-accent); background: transparent; border: 1.5px solid var(--cv-border); border-radius: var(--cv-radius-md); text-decoration: none; transition: all 0.2s ease; margin-bottom: 12px; } .cv-thank-you-cta:hover { border-color: var(--cv-accent); background: rgba(59, 130, 246, 0.05); } .cv-submit-another { display: inline-block; font-size: 13px; font-weight: 500; color: var(--cv-accent); background: none; border: none; cursor: pointer; text-decoration: underline; } .cv-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--cv-border-subtle); } .cv-badge { font-size: 12px; color: var(--cv-text-muted); text-decoration: none; transition: color 0.2s ease; } .cv-badge:hover { color: var(--cv-text-secondary); } .cv-footer-cta { font-size: 12px; font-weight: 500; color: var(--cv-accent); text-decoration: none; transition: opacity 0.2s ease; } .cv-footer-cta:hover { opacity: 0.8; } .cv-empty { text-align: center; padding: 32px 0; color: var(--cv-text-muted); font-size: 14px; } .hidden { display: none !important; }";
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
  thankYou.innerHTML = '<div class="cv-checkmark-container"><svg class="cv-checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52"><circle class="cv-checkmark-circle" cx="26" cy="26" r="25" fill="none"/><path class="cv-checkmark-check" fill="none" d="M14 27l7 7 16-16"/></svg></div><h3>Thanks for your feedback!</h3><p>We will review it and keep you updated.</p><a href="' + ctaUrl + '" target="_blank" rel="noopener noreferrer" class="cv-thank-you-cta">' + ctaText + '</a><br><button type="button" class="cv-submit-another">Submit another</button>';
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

      var row = document.createElement("div");
      row.className = "cv-feedback-row";

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

      // Comment toggle button
      var commentToggle = document.createElement("button");
      commentToggle.type = "button";
      commentToggle.className = "cv-comment-toggle";
      commentToggle.textContent = "View comments";
      commentToggle.dataset.feedbackId = item.id;

      content.appendChild(commentToggle);

      row.appendChild(voteBtn);
      row.appendChild(content);
      card.appendChild(row);

      // Comments section (hidden by default)
      var commentsSection = document.createElement("div");
      commentsSection.className = "cv-comments-section hidden";
      commentsSection.dataset.feedbackId = item.id;

      commentToggle.addEventListener("click", function () {
        var isHidden = commentsSection.classList.contains("hidden");
        if (isHidden) {
          loadComments(item.id, commentsSection);
          commentsSection.classList.remove("hidden");
          commentToggle.textContent = "Hide comments";
        } else {
          commentsSection.classList.add("hidden");
          commentToggle.textContent = "View comments";
        }
      });

      card.appendChild(commentsSection);
      list.appendChild(card);
    });
  }

  // Load comments for a feedback item
  function loadComments(feedbackId, container) {
    container.innerHTML = '<div class="cv-spinner" style="margin: 12px auto;"></div>';

    fetch(
      apiBase +
        "/api/v1/" +
        encodeURIComponent(workspace) +
        "/" +
        encodeURIComponent(board) +
        "/feedback/" +
        feedbackId +
        "/comments"
    )
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        renderComments(feedbackId, data.comments || [], container);
      })
      .catch(function () {
        container.innerHTML = '<div class="cv-empty">Failed to load comments</div>';
      });
  }

  // Render comments
  function renderComments(feedbackId, comments, container) {
    container.innerHTML = "";

    if (comments.length > 0) {
      comments.forEach(function (comment) {
        var commentEl = document.createElement("div");
        commentEl.className = "cv-comment";

        var author = document.createElement("div");
        author.className = "cv-comment-author";
        author.textContent = comment.author_name;

        var body = document.createElement("div");
        body.className = "cv-comment-body";
        body.textContent = comment.body;

        commentEl.appendChild(author);
        commentEl.appendChild(body);
        container.appendChild(commentEl);
      });
    }

    // Comment form
    var form = document.createElement("div");
    form.className = "cv-comment-form";

    var textarea = document.createElement("textarea");
    textarea.className = "cv-comment-input";
    textarea.placeholder = "Add a comment...";
    textarea.maxLength = 2000;

    var submitBtn = document.createElement("button");
    submitBtn.type = "button";
    submitBtn.className = "cv-comment-submit";
    submitBtn.textContent = "Post comment";

    submitBtn.addEventListener("click", function () {
      var content = textarea.value.trim();
      if (!content) return;

      submitBtn.disabled = true;
      submitBtn.textContent = "Posting...";

      fetch(
        apiBase +
          "/api/v1/" +
          encodeURIComponent(workspace) +
          "/" +
          encodeURIComponent(board) +
          "/feedback/" +
          feedbackId +
          "/comments",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: content,
            externalUserId: uid
          })
        }
      )
        .then(function (res) {
          if (!res.ok) throw new Error("Failed");
          return res.json();
        })
        .then(function () {
          textarea.value = "";
          loadComments(feedbackId, container);
        })
        .catch(function () {
          alert("Failed to post comment");
        })
        .finally(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = "Post comment";
        });
    });

    form.appendChild(textarea);
    form.appendChild(submitBtn);
    container.appendChild(form);
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
})();`;

type RawFeedbackRow = {
  id: number;
  title: string;
  description: string | null;
  status: string;
  source?: string | null;
  moderation_state: string;
  is_hidden: number;
  created_at: string;
  updated_at: string;
  vote_count: number;
  tags?: string | null;
};

type ListOptions = {
  status?: string | null;
  limit?: number;
  offset?: number;
  includeHidden?: boolean;
  moderationState?: string | null;
  search?: string | null;
  sort?: string | null;
  order?: string | null;
};

const worker: ExportedHandler<Env> = {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
          "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token"
        }
      });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return withCors(request, jsonResponse({ ok: true }));
    }

    if (request.method === "GET" && url.pathname === "/widget.js") {
      return new Response(WIDGET_JS, {
        status: 200,
        headers: {
          "content-type": "application/javascript; charset=utf-8",
          "cache-control": "public, max-age=300"
        }
      });
    }

    if (url.pathname.startsWith("/api/v1/")) {
      const resp = await handleApi(request, env);
      return withCors(request, resp);
    }

    return new Response("Not found", { status: 404 });
  }
};

export default worker;

function jsonResponse(data: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers || {});
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json; charset=utf-8");
  }
  return new Response(JSON.stringify(data), {
    ...init,
    headers
  });
}

function errorResponse(
  status: number,
  message: string,
  extra?: Record<string, unknown>
): Response {
  return jsonResponse({ error: message, ...extra }, { status });
}

function withCors(request: Request, response: Response): Response {
  const origin = request.headers.get("Origin") || "*";
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set(
    "Access-Control-Allow-Headers",
    headers.get("Access-Control-Allow-Headers") || "Content-Type, X-Admin-Token"
  );
  headers.set(
    "Access-Control-Allow-Methods",
    headers.get("Access-Control-Allow-Methods") || "GET,POST,PATCH,DELETE,OPTIONS"
  );
  headers.set("Access-Control-Expose-Headers", "content-type");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);

  if (parts.length < 4 || parts[0] !== "api" || parts[1] !== "v1") {
    return errorResponse(404, "Not found");
  }

  // Workspace-level admin routes: /api/v1/admin/workspaces/:workspace/...
  // This is the new pattern that matches frontend expectations
  if (parts[2] === "admin" && parts[3] === "workspaces" && parts.length >= 5) {
    const authError = verifyAdminAuth(request, env);
    if (authError) return authError;

    const workspaceSlug = parts[4];
    const resource = parts[5]; // "stats", "feedback", etc.
    const resourceId = parts[6]; // feedback ID or "recent" or "bulk"
    const subresource = parts[7]; // nested resource

    // GET /api/v1/admin/workspaces/:workspace/stats
    if (resource === "stats" && request.method === "GET") {
      return getWorkspaceStats(env, workspaceSlug);
    }

    // Feedback endpoints
    if (resource === "feedback") {
      // GET /api/v1/admin/workspaces/:workspace/feedback/recent?limit=10
      if (resourceId === "recent" && request.method === "GET") {
        const limit = parseNumber(url.searchParams.get("limit"), 10, 1, 50);
        return getWorkspaceRecentFeedback(env, workspaceSlug, limit);
      }

      // POST /api/v1/admin/workspaces/:workspace/feedback/bulk
      if (resourceId === "bulk" && request.method === "POST") {
        const body = await readJson(request);
        return workspaceBulkUpdateFeedback(env, workspaceSlug, body);
      }

      // GET /api/v1/admin/workspaces/:workspace/feedback (list with pagination)
      if (!resourceId && request.method === "GET") {
        const status = url.searchParams.get("status");
        const moderation = url.searchParams.get("moderation_state");
        const search = url.searchParams.get("search");
        const sort = url.searchParams.get("sort");
        const order = url.searchParams.get("order");
        const limit = parseNumber(url.searchParams.get("limit"), 20, 1, 200);
        const offset = parseNumber(url.searchParams.get("offset"), 0, 0, 10000);
        return listWorkspaceFeedback(env, workspaceSlug, {
          status,
          moderationState: moderation,
          search,
          sort,
          order,
          limit,
          offset
        });
      }

      // Endpoints with feedback ID
      if (resourceId && resourceId !== "recent" && resourceId !== "bulk") {
        const feedbackId = Number(resourceId);
        if (!Number.isFinite(feedbackId)) {
          return errorResponse(400, "Invalid feedback ID");
        }

        // PATCH /api/v1/admin/workspaces/:workspace/feedback/:id
        if (request.method === "PATCH") {
          const body = await readJson(request);
          return updateWorkspaceFeedback(env, workspaceSlug, feedbackId, body);
        }

        // DELETE /api/v1/admin/workspaces/:workspace/feedback/:id
        if (request.method === "DELETE") {
          return deleteWorkspaceFeedback(env, workspaceSlug, feedbackId);
        }

        // GET /api/v1/admin/workspaces/:workspace/feedback/:id
        if (request.method === "GET") {
          return getWorkspaceFeedbackItem(env, workspaceSlug, feedbackId);
        }
      }

      return errorResponse(405, "Method not allowed");
    }

    // Tags endpoints: /api/v1/admin/workspaces/:workspace/tags
    if (resource === "tags") {
      // GET /api/v1/admin/workspaces/:workspace/tags
      if (!resourceId && request.method === "GET") {
        return getWorkspaceTags(env, workspaceSlug);
      }

      // POST /api/v1/admin/workspaces/:workspace/tags
      if (!resourceId && request.method === "POST") {
        const body = await readJson(request);
        return createWorkspaceTag(env, workspaceSlug, body);
      }

      // Tag with ID
      if (resourceId) {
        const tagId = Number(resourceId);
        if (!Number.isFinite(tagId)) {
          return errorResponse(400, "Invalid tag ID");
        }

        // PATCH /api/v1/admin/workspaces/:workspace/tags/:id
        if (request.method === "PATCH") {
          const body = await readJson(request);
          return updateWorkspaceTag(env, workspaceSlug, tagId, body);
        }

        // DELETE /api/v1/admin/workspaces/:workspace/tags/:id
        if (request.method === "DELETE") {
          return deleteWorkspaceTag(env, workspaceSlug, tagId);
        }
      }

      return errorResponse(405, "Method not allowed");
    }

    return errorResponse(404, "Not found");
  }

  // Check if this is workspace-level admin (parts[4] === "admin")
  // or board-level (parts[5] === "admin" or regular resource)
  if (parts.length >= 5 && parts[3] === "admin") {
    // Workspace-level admin routes: /api/v1/:workspace/admin/...
    const workspaceSlug = parts[2];
    const resource = parts[4]; // "tags", "feedback", etc.
    const maybeId = parts[5];

    const authError = verifyAdminAuth(request, env);
    if (authError) return authError;

    if (resource === "tags") {
      if (!maybeId) {
        // GET /api/v1/:workspace/admin/tags
        if (request.method === "GET") {
          return listTags(env, workspaceSlug);
        }
        // POST /api/v1/:workspace/admin/tags
        if (request.method === "POST") {
          const body = await readJson(request);
          return createTag(env, workspaceSlug, body);
        }
        return errorResponse(405, "Method not allowed");
      }

      const tagId = Number(maybeId);
      // PATCH /api/v1/:workspace/admin/tags/:id
      if (request.method === "PATCH") {
        const body = await readJson(request);
        return updateTag(env, workspaceSlug, tagId, body);
      }
      // DELETE /api/v1/:workspace/admin/tags/:id
      if (request.method === "DELETE") {
        return deleteTag(env, workspaceSlug, tagId);
      }
      return errorResponse(405, "Method not allowed");
    }

    if (resource === "feedback" && maybeId) {
      const feedbackId = Number(maybeId);
      const subresource = parts[6]; // "comments"
      const commentId = parts[7];

      // DELETE /api/v1/:workspace/admin/feedback/:id/comments/:commentId
      if (subresource === "comments" && commentId && request.method === "DELETE") {
        return deleteComment(env, workspaceSlug, feedbackId, Number(commentId));
      }
    }

    return errorResponse(404, "Not found");
  }

  // Board-level routes: /api/v1/:workspace/:board/...
  if (parts.length < 5) {
    return errorResponse(404, "Not found");
  }

  const [, , workspaceSlug, boardSlug, resource, maybeId, subresource] = parts;

  if (resource === "feedback") {
    if (!maybeId) {
      if (request.method === "GET") {
        const status = url.searchParams.get("status");
        const limit = parseNumber(url.searchParams.get("limit"), 50, 1, 100);
        const offset = parseNumber(url.searchParams.get("offset"), 0, 0, 1000);
        return listFeedback(env, workspaceSlug, boardSlug, {
          status,
          limit,
          offset
        });
      }

      if (request.method === "POST") {
        const body = await readJson(request);
        if (!body || typeof body.title !== "string") {
          return errorResponse(400, "Title is required");
        }
        return createFeedback(request, env, workspaceSlug, boardSlug, body);
      }

      return errorResponse(405, "Method not allowed");
    }

    if (request.method === "POST" && subresource === "votes") {
      const body = await readJson(request);
      return voteOnFeedback(request, env, workspaceSlug, boardSlug, Number(maybeId), body);
    }

    if (subresource === "comments") {
      const commentId = parts[7]; // /api/v1/:workspace/:board/feedback/:id/comments/:commentId

      // GET /api/v1/:workspace/:board/feedback/:id/comments
      if (request.method === "GET" && !commentId) {
        return listComments(env, workspaceSlug, boardSlug, Number(maybeId));
      }

      // POST /api/v1/:workspace/:board/feedback/:id/comments
      if (request.method === "POST" && !commentId) {
        const body = await readJson(request);
        return createComment(request, env, workspaceSlug, boardSlug, Number(maybeId), body);
      }

      return errorResponse(404, "Not found");
    }

    if (request.method === "GET" && !subresource) {
      return getFeedbackItem(env, workspaceSlug, boardSlug, Number(maybeId));
    }

    return errorResponse(404, "Not found");
  }

  if (resource === "admin") {
    const authError = verifyAdminAuth(request, env);
    if (authError) return authError;

    // GET /api/v1/:workspace/:board/admin/stats
    if (maybeId === "stats" && request.method === "GET") {
      return getAdminStats(env, workspaceSlug, boardSlug);
    }

    if (maybeId !== "feedback") {
      return errorResponse(404, "Not found");
    }

    // POST /api/v1/:workspace/:board/admin/feedback/bulk
    if (request.method === "POST" && subresource === "bulk") {
      const body = await readJson(request);
      return bulkUpdateFeedback(env, workspaceSlug, boardSlug, body);
    }

    // GET /api/v1/:workspace/:board/admin/feedback
    if (request.method === "GET" && !subresource) {
      const includeHidden = url.searchParams.get("include_hidden") === "true";
      const status = url.searchParams.get("status");
      const moderation = url.searchParams.get("moderation_state");
      const search = url.searchParams.get("q");
      const sort = url.searchParams.get("sort");
      const order = url.searchParams.get("order");
      const limit = parseNumber(url.searchParams.get("limit"), 50, 1, 200);
      const offset = parseNumber(url.searchParams.get("offset"), 0, 0, 2000);
      return listAdminFeedback(env, workspaceSlug, boardSlug, {
        includeHidden,
        status,
        moderationState: moderation,
        search,
        sort,
        order,
        limit,
        offset
      });
    }

    // DELETE /api/v1/:workspace/:board/admin/feedback/:id
    if (request.method === "DELETE" && subresource) {
      return deleteFeedback(env, workspaceSlug, boardSlug, Number(subresource));
    }

    // PATCH /api/v1/:workspace/:board/admin/feedback/:id
    if (request.method === "PATCH" && subresource) {
      const body = await readJson(request);
      return updateFeedbackAdmin(
        env,
        workspaceSlug,
        boardSlug,
        Number(subresource),
        body
      );
    }

    return errorResponse(405, "Method not allowed");
  }

  return errorResponse(404, "Not found");
}

function parseNumber(
  value: string | null,
  fallback: number,
  min: number,
  max: number
): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

async function readJson(request: Request): Promise<any | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function getRequestIp(request: Request): string | null {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For") ||
    request.headers.get("X-Real-IP") ||
    null
  );
}

function buildClientIdentity(
  request: Request,
  providedId?: string | null
): { externalUserId: string | null; rateKey: string } {
  let sanitized =
    typeof providedId === "string" ? providedId.trim().slice(0, MAX_EXTERNAL_USER_ID_LENGTH) : "";
  const ip = getRequestIp(request);

  if (!sanitized && ip) {
    sanitized = ip;
  }

  if (!sanitized) {
    sanitized = crypto.randomUUID();
  }

  return {
    externalUserId: sanitized,
    rateKey: sanitized ? `id:${sanitized}` : `ip:${ip ?? "unknown"}`
  };
}

async function enforceRateLimit(
  env: Env,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB
    .prepare("SELECT count, window_start FROM rate_limits WHERE key = ?")
    .bind(key)
    .first<{ count: number; window_start: number }>();

  if (!row || now - row.window_start >= windowSeconds) {
    await env.DB.prepare(
      `INSERT INTO rate_limits (key, count, window_start)
       VALUES (?, 1, ?)
       ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start`
    )
      .bind(key, now)
      .run();

    return { allowed: true };
  }

  if (row.count >= limit) {
    const retryAfter = windowSeconds - (now - row.window_start);
    return { allowed: false, retryAfter };
  }

  await env.DB.prepare(
    "UPDATE rate_limits SET count = count + 1 WHERE key = ?"
  )
    .bind(key)
    .run();

  return { allowed: true };
}

async function getOrCreateWorkspaceAndBoard(
  env: Env,
  workspaceSlug: string,
  boardSlug: string
): Promise<{ workspaceId: number; boardId: number }> {
  const db = env.DB;

  let workspace = await db
    .prepare("SELECT id FROM workspaces WHERE slug = ?")
    .bind(workspaceSlug)
    .first<{ id: number }>();

  if (!workspace) {
    await db
      .prepare("INSERT INTO workspaces (slug, name) VALUES (?, ?)")
      .bind(workspaceSlug, workspaceSlug)
      .run();

    workspace = await db
      .prepare("SELECT id FROM workspaces WHERE slug = ?")
      .bind(workspaceSlug)
      .first<{ id: number }>();
  }

  if (!workspace) {
    throw new Error("Failed to create workspace");
  }

  let board = await db
    .prepare("SELECT id FROM boards WHERE workspace_id = ? AND slug = ?")
    .bind(workspace.id, boardSlug)
    .first<{ id: number }>();

  if (!board) {
    await db
      .prepare("INSERT INTO boards (workspace_id, slug, name) VALUES (?, ?, ?)")
      .bind(workspace.id, boardSlug, boardSlug)
      .run();

    board = await db
      .prepare("SELECT id FROM boards WHERE workspace_id = ? AND slug = ?")
      .bind(workspace.id, boardSlug)
      .first<{ id: number }>();
  }

  if (!board) {
    throw new Error("Failed to create board");
  }

  return { workspaceId: workspace.id, boardId: board.id };
}

async function getOrCreateEndUser(
  env: Env,
  workspaceId: number,
  externalUserId?: string | null
): Promise<number | null> {
  if (!externalUserId) return null;

  const existing = await env.DB
    .prepare(
      "SELECT id FROM end_users WHERE workspace_id = ? AND external_user_id = ?"
    )
    .bind(workspaceId, externalUserId)
    .first<{ id: number }>();

  if (existing) return existing.id;

  await env.DB
    .prepare(
      "INSERT INTO end_users (workspace_id, external_user_id, name) VALUES (?, ?, ?)"
    )
    .bind(workspaceId, externalUserId, null)
    .run();

  const created = await env.DB
    .prepare(
      "SELECT id FROM end_users WHERE workspace_id = ? AND external_user_id = ?"
    )
    .bind(workspaceId, externalUserId)
    .first<{ id: number }>();

  return created ? created.id : null;
}

async function listFeedback(
  env: Env,
  workspaceSlug: string,
  boardSlug: string,
  options: ListOptions
): Promise<Response> {
  const { boardId } = await getOrCreateWorkspaceAndBoard(
    env,
    workspaceSlug,
    boardSlug
  );

  if (options.status && !ALLOWED_STATUSES.has(options.status)) {
    return errorResponse(400, "Invalid status filter");
  }

  const conditions = [
    "f.board_id = ?",
    "f.is_hidden = 0",
    "f.moderation_state = 'approved'"
  ];
  const bindings: Array<string | number> = [boardId];

  if (options.status) {
    conditions.push("f.status = ?");
    bindings.push(options.status);
  }

  const sql = `
    SELECT
      f.id,
      f.title,
      f.description,
      f.status,
      f.source,
      f.moderation_state,
      f.is_hidden,
      f.created_at,
      f.updated_at,
      COALESCE(SUM(v.weight), 0) AS vote_count,
      GROUP_CONCAT(DISTINCT t.name) AS tags
    FROM feedback_items f
    LEFT JOIN feedback_votes v ON v.feedback_id = f.id
    LEFT JOIN feedback_item_tags fit ON fit.feedback_id = f.id
    LEFT JOIN feedback_tags t ON t.id = fit.tag_id
    WHERE ${conditions.join(" AND ")}
    GROUP BY f.id
    ORDER BY vote_count DESC, f.created_at DESC
    LIMIT ?
    OFFSET ?
  `;

  const result = await env.DB.prepare(sql)
    .bind(...bindings, options.limit ?? 50, options.offset ?? 0)
    .all();

  const items = (result.results || []).map((row) =>
    serializeFeedbackRow(row as RawFeedbackRow)
  );

  return jsonResponse({ items });
}

async function getFeedbackItem(
  env: Env,
  workspaceSlug: string,
  boardSlug: string,
  feedbackId: number
): Promise<Response> {
  if (!Number.isFinite(feedbackId)) {
    return errorResponse(400, "Invalid feedback id");
  }

  const { boardId } = await getOrCreateWorkspaceAndBoard(
    env,
    workspaceSlug,
    boardSlug
  );

  const item = await fetchFeedbackById(env, boardId, feedbackId, {});
  if (!item) {
    return errorResponse(404, "Feedback not found");
  }
  return jsonResponse({ item });
}

async function createFeedback(
  request: Request,
  env: Env,
  workspaceSlug: string,
  boardSlug: string,
  body: Record<string, unknown>
): Promise<Response> {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return errorResponse(400, "Title is required");
  if (title.length > MAX_TITLE_LENGTH) {
    return errorResponse(400, `Title must be <= ${MAX_TITLE_LENGTH} characters`);
  }

  const description =
    typeof body.description === "string" && body.description.trim()
      ? body.description.trim().slice(0, MAX_DESCRIPTION_LENGTH)
      : null;

  const identity = buildClientIdentity(
    request,
    typeof body.externalUserId === "string" ? body.externalUserId : null
  );
  const rateKey = `feedback:create:${workspaceSlug}:${boardSlug}:${identity.rateKey}`;
  const rate = await enforceRateLimit(
    env,
    rateKey,
    RATE_LIMITS.feedbackCreate.limit,
    RATE_LIMITS.feedbackCreate.windowSeconds
  );
  if (!rate.allowed) {
    return errorResponse(429, "Too many feedback submissions", {
      retry_after: rate.retryAfter ?? 0
    });
  }

  const { workspaceId, boardId } = await getOrCreateWorkspaceAndBoard(
    env,
    workspaceSlug,
    boardSlug
  );

  const authorId = await getOrCreateEndUser(env, workspaceId, identity.externalUserId);
  const now = new Date().toISOString();

  const source =
    typeof body.source === "string" && body.source.trim()
      ? body.source.trim().slice(0, 64)
      : "widget";

  const result = await env.DB.prepare(
    `INSERT INTO feedback_items
       (board_id, author_id, title, description, status, source, moderation_state, is_hidden, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'open', ?, 'approved', 0, ?, ?)`
  )
    .bind(boardId, authorId, title, description, source, now, now)
    .run();

  const created = await fetchFeedbackById(
    env,
    boardId,
    Number(result.lastRowId),
    {}
  );

  return jsonResponse({ item: created }, { status: 201 });
}

async function voteOnFeedback(
  request: Request,
  env: Env,
  workspaceSlug: string,
  boardSlug: string,
  feedbackId: number,
  body: Record<string, unknown> | null
): Promise<Response> {
  if (!Number.isFinite(feedbackId)) {
    return errorResponse(400, "Invalid feedback id");
  }

  const identity = buildClientIdentity(
    request,
    body && typeof body.externalUserId === "string" ? body.externalUserId : null
  );
  const rateKey = `feedback:vote:${workspaceSlug}:${boardSlug}:${identity.rateKey}`;
  const rate = await enforceRateLimit(
    env,
    rateKey,
    RATE_LIMITS.feedbackVote.limit,
    RATE_LIMITS.feedbackVote.windowSeconds
  );
  if (!rate.allowed) {
    return errorResponse(429, "Too many votes", { retry_after: rate.retryAfter ?? 0 });
  }

  const { workspaceId, boardId } = await getOrCreateWorkspaceAndBoard(
    env,
    workspaceSlug,
    boardSlug
  );

  const feedback = await env.DB
    .prepare(
      `SELECT id FROM feedback_items
       WHERE id = ? AND board_id = ? AND is_hidden = 0 AND moderation_state = 'approved'`
    )
    .bind(feedbackId, boardId)
    .first<{ id: number }>();

  if (!feedback) {
    return errorResponse(404, "Feedback not found or not voteable");
  }

  const userId = await getOrCreateEndUser(env, workspaceId, identity.externalUserId);
  if (!userId) {
    return errorResponse(400, "Unable to determine voter identity");
  }

  await env.DB.prepare(
    `INSERT OR IGNORE INTO feedback_votes (feedback_id, user_id, weight)
     VALUES (?, ?, 1)`
  )
    .bind(feedbackId, userId)
    .run();

  const row = await env.DB.prepare(
    `SELECT COALESCE(SUM(weight), 0) AS vote_count
     FROM feedback_votes
     WHERE feedback_id = ?`
  )
    .bind(feedbackId)
    .first<{ vote_count: number }>();

  return jsonResponse({
    feedback_id: feedbackId,
    vote_count: Number(row?.vote_count ?? 0)
  });
}

async function listComments(
  env: Env,
  workspaceSlug: string,
  boardSlug: string,
  feedbackId: number
): Promise<Response> {
  if (!Number.isFinite(feedbackId)) {
    return errorResponse(400, "Invalid feedback id");
  }

  const { boardId } = await getOrCreateWorkspaceAndBoard(
    env,
    workspaceSlug,
    boardSlug
  );

  // Verify feedback exists and is visible
  const feedback = await env.DB
    .prepare(
      `SELECT id FROM feedback_items
       WHERE id = ? AND board_id = ? AND is_hidden = 0 AND moderation_state = 'approved'`
    )
    .bind(feedbackId, boardId)
    .first<{ id: number }>();

  if (!feedback) {
    return errorResponse(404, "Feedback not found");
  }

  // Get comments (only non-internal for public endpoint)
  const result = await env.DB
    .prepare(
      `SELECT
         c.id,
         c.body,
         c.created_at,
         u.name,
         u.external_user_id
       FROM feedback_comments c
       LEFT JOIN end_users u ON u.id = c.author_id
       WHERE c.feedback_id = ? AND c.is_internal = 0
       ORDER BY c.created_at ASC`
    )
    .bind(feedbackId)
    .all();

  const comments = (result.results || []).map((row: any) => ({
    id: row.id,
    body: row.body,
    created_at: row.created_at,
    author_name: row.name || "Anonymous"
  }));

  return jsonResponse({ comments });
}

async function createComment(
  request: Request,
  env: Env,
  workspaceSlug: string,
  boardSlug: string,
  feedbackId: number,
  body: Record<string, unknown> | null
): Promise<Response> {
  if (!Number.isFinite(feedbackId)) {
    return errorResponse(400, "Invalid feedback id");
  }

  if (!body || typeof body.content !== "string" || !body.content.trim()) {
    return errorResponse(400, "Comment content is required");
  }

  const content = body.content.trim();
  if (content.length > MAX_COMMENT_LENGTH) {
    return errorResponse(400, `Comment must be <= ${MAX_COMMENT_LENGTH} characters`);
  }

  const identity = buildClientIdentity(
    request,
    typeof body.externalUserId === "string" ? body.externalUserId : null
  );

  const rateKey = `comment:create:${workspaceSlug}:${boardSlug}:${identity.rateKey}`;
  const rate = await enforceRateLimit(
    env,
    rateKey,
    RATE_LIMITS.commentCreate.limit,
    RATE_LIMITS.commentCreate.windowSeconds
  );

  if (!rate.allowed) {
    return errorResponse(429, "Too many comments", {
      retry_after: rate.retryAfter ?? 0
    });
  }

  const { workspaceId, boardId } = await getOrCreateWorkspaceAndBoard(
    env,
    workspaceSlug,
    boardSlug
  );

  // Verify feedback exists and is visible
  const feedback = await env.DB
    .prepare(
      `SELECT id FROM feedback_items
       WHERE id = ? AND board_id = ? AND is_hidden = 0 AND moderation_state = 'approved'`
    )
    .bind(feedbackId, boardId)
    .first<{ id: number }>();

  if (!feedback) {
    return errorResponse(404, "Feedback not found");
  }

  const authorId = await getOrCreateEndUser(env, workspaceId, identity.externalUserId);
  const now = new Date().toISOString();

  const result = await env.DB.prepare(
    `INSERT INTO feedback_comments
       (feedback_id, author_id, body, is_internal, created_at)
     VALUES (?, ?, ?, 0, ?)`
  )
    .bind(feedbackId, authorId, content, now)
    .run();

  const created = await env.DB
    .prepare(
      `SELECT
         c.id,
         c.body,
         c.created_at,
         u.name
       FROM feedback_comments c
       LEFT JOIN end_users u ON u.id = c.author_id
       WHERE c.id = ?`
    )
    .bind(result.lastRowId)
    .first<any>();

  return jsonResponse(
    {
      comment: {
        id: created.id,
        body: created.body,
        created_at: created.created_at,
        author_name: created.name || "Anonymous"
      }
    },
    { status: 201 }
  );
}

async function deleteComment(
  env: Env,
  workspaceSlug: string,
  feedbackId: number,
  commentId: number
): Promise<Response> {
  if (!Number.isFinite(feedbackId) || !Number.isFinite(commentId)) {
    return errorResponse(400, "Invalid id");
  }

  const workspace = await env.DB
    .prepare("SELECT id FROM workspaces WHERE slug = ?")
    .bind(workspaceSlug)
    .first<{ id: number }>();

  if (!workspace) {
    return errorResponse(404, "Workspace not found");
  }

  // Verify comment belongs to the feedback item
  const comment = await env.DB
    .prepare(
      `SELECT c.id
       FROM feedback_comments c
       WHERE c.id = ? AND c.feedback_id = ?`
    )
    .bind(commentId, feedbackId)
    .first<{ id: number }>();

  if (!comment) {
    return errorResponse(404, "Comment not found");
  }

  const result = await env.DB
    .prepare("DELETE FROM feedback_comments WHERE id = ?")
    .bind(commentId)
    .run();

  if (result.changes === 0) {
    return errorResponse(404, "Comment not found");
  }

  return new Response(null, { status: 204 });
}

async function listAdminFeedback(
  env: Env,
  workspaceSlug: string,
  boardSlug: string,
  options: ListOptions
): Promise<Response> {
  if (options.status && !ALLOWED_STATUSES.has(options.status)) {
    return errorResponse(400, "Invalid status filter");
  }
  if (
    options.moderationState &&
    !ALLOWED_MODERATION_STATES.has(options.moderationState)
  ) {
    return errorResponse(400, "Invalid moderation filter");
  }

  const { boardId } = await getOrCreateWorkspaceAndBoard(
    env,
    workspaceSlug,
    boardSlug
  );

  const conditions = ["f.board_id = ?"];
  const bindings: Array<string | number> = [boardId];

  if (!options.includeHidden) {
    conditions.push("f.is_hidden = 0");
  }
  if (options.status) {
    conditions.push("f.status = ?");
    bindings.push(options.status);
  }
  if (options.moderationState) {
    conditions.push("f.moderation_state = ?");
    bindings.push(options.moderationState);
  }
  if (options.search) {
    const searchPattern = `%${options.search}%`;
    conditions.push("(f.title LIKE ? OR f.description LIKE ?)");
    bindings.push(searchPattern, searchPattern);
  }

  const allowedSortFields = new Set(["vote_count", "created_at", "updated_at"]);
  const sortField =
    options.sort && allowedSortFields.has(options.sort)
      ? options.sort
      : "created_at";

  const sortOrder =
    options.order && (options.order === "asc" || options.order === "desc")
      ? options.order.toUpperCase()
      : "DESC";

  const orderByClause =
    sortField === "vote_count"
      ? `vote_count ${sortOrder}, f.created_at DESC`
      : `f.${sortField} ${sortOrder}`;

  const sql = `
    SELECT
      f.id,
      f.title,
      f.description,
      f.status,
      f.source,
      f.moderation_state,
      f.is_hidden,
      f.created_at,
      f.updated_at,
      COALESCE(SUM(v.weight), 0) AS vote_count,
      GROUP_CONCAT(DISTINCT t.name) AS tags
    FROM feedback_items f
    LEFT JOIN feedback_votes v ON v.feedback_id = f.id
    LEFT JOIN feedback_item_tags fit ON fit.feedback_id = f.id
    LEFT JOIN feedback_tags t ON t.id = fit.tag_id
    WHERE ${conditions.join(" AND ")}
    GROUP BY f.id
    ORDER BY ${orderByClause}
    LIMIT ?
    OFFSET ?
  `;

  const result = await env.DB.prepare(sql)
    .bind(...bindings, options.limit ?? 50, options.offset ?? 0)
    .all();

  const items = (result.results || []).map((row) =>
    serializeFeedbackRow(row as RawFeedbackRow, { includeMeta: true })
  );

  return jsonResponse({ items });
}

async function updateFeedbackAdmin(
  env: Env,
  workspaceSlug: string,
  boardSlug: string,
  feedbackId: number,
  body: Record<string, unknown> | null
): Promise<Response> {
  if (!Number.isFinite(feedbackId)) {
    return errorResponse(400, "Invalid feedback id");
  }

  const payload = body || {};
  const fields: string[] = [];
  const values: Array<string | number | null> = [];

  if ("title" in payload) {
    if (typeof payload.title !== "string") {
      return errorResponse(400, "Title must be a string");
    }
    const sanitized = payload.title.trim();
    if (!sanitized) return errorResponse(400, "Title cannot be empty");
    if (sanitized.length > MAX_TITLE_LENGTH) {
      return errorResponse(400, `Title must be <= ${MAX_TITLE_LENGTH} characters`);
    }
    fields.push("title = ?");
    values.push(sanitized);
  }

  if ("description" in payload) {
    if (
      payload.description !== null &&
      typeof payload.description !== "string"
    ) {
      return errorResponse(400, "Description must be string or null");
    }
    const sanitized =
      typeof payload.description === "string"
        ? payload.description.trim().slice(0, MAX_DESCRIPTION_LENGTH)
        : null;
    fields.push("description = ?");
    values.push(sanitized);
  }

  if ("status" in payload) {
    if (typeof payload.status !== "string" || !ALLOWED_STATUSES.has(payload.status)) {
      return errorResponse(400, "Invalid status value");
    }
    fields.push("status = ?");
    values.push(payload.status);
  }

  if ("moderation_state" in payload) {
    if (
      typeof payload.moderation_state !== "string" ||
      !ALLOWED_MODERATION_STATES.has(payload.moderation_state)
    ) {
      return errorResponse(400, "Invalid moderation_state");
    }
    fields.push("moderation_state = ?");
    values.push(payload.moderation_state);
  }

  if ("is_hidden" in payload) {
    if (typeof payload.is_hidden !== "boolean") {
      return errorResponse(400, "is_hidden must be boolean");
    }
    fields.push("is_hidden = ?");
    values.push(payload.is_hidden ? 1 : 0);
  }

  const { workspaceId, boardId } = await getOrCreateWorkspaceAndBoard(
    env,
    workspaceSlug,
    boardSlug
  );

  if (fields.length) {
    fields.push("updated_at = ?");
    values.push(new Date().toISOString());
    values.push(feedbackId);
    values.push(boardId);

    const updateSql = `UPDATE feedback_items SET ${fields.join(
      ", "
    )} WHERE id = ? AND board_id = ?`;

    const result = await env.DB.prepare(updateSql).bind(...values).run();
    if (!result.success || result.changes === 0) {
      return errorResponse(404, "Feedback not found");
    }
  } else {
    const exists = await env.DB
      .prepare("SELECT id FROM feedback_items WHERE id = ? AND board_id = ?")
      .bind(feedbackId, boardId)
      .first<{ id: number }>();
    if (!exists) {
      return errorResponse(404, "Feedback not found");
    }
  }

  if (Array.isArray(payload.tags)) {
    await applyTags(env, workspaceId, feedbackId, payload.tags);
  }

  const item = await fetchFeedbackById(env, boardId, feedbackId, {
    includeHidden: true
  });
  return jsonResponse({ item });
}

async function fetchFeedbackById(
  env: Env,
  boardId: number,
  feedbackId: number,
  options: { includeHidden?: boolean } | undefined
): Promise<Record<string, unknown> | null> {
  const conditions = ["f.id = ?", "f.board_id = ?"];
  const bindings: Array<string | number> = [feedbackId, boardId];

  if (!options?.includeHidden) {
    conditions.push("f.is_hidden = 0");
    conditions.push("f.moderation_state = 'approved'");
  }

  const sql = `
    SELECT
      f.id,
      f.title,
      f.description,
      f.status,
      f.source,
      f.moderation_state,
      f.is_hidden,
      f.created_at,
      f.updated_at,
      COALESCE(SUM(v.weight), 0) AS vote_count,
      GROUP_CONCAT(DISTINCT t.name) AS tags
    FROM feedback_items f
    LEFT JOIN feedback_votes v ON v.feedback_id = f.id
    LEFT JOIN feedback_item_tags fit ON fit.feedback_id = f.id
    LEFT JOIN feedback_tags t ON t.id = fit.tag_id
    WHERE ${conditions.join(" AND ")}
    GROUP BY f.id
    LIMIT 1
  `;

  const row = await env.DB.prepare(sql).bind(...bindings).first<RawFeedbackRow>();
  if (!row) return null;

  return serializeFeedbackRow(row, { includeMeta: options?.includeHidden });
}

async function applyTags(
  env: Env,
  workspaceId: number,
  feedbackId: number,
  tags: unknown[]
): Promise<void> {
  const names = Array.isArray(tags)
    ? Array.from(
        new Set(
          tags
            .filter((tag): tag is string => typeof tag === "string")
            .map((tag) => tag.trim().toLowerCase())
            .filter(Boolean)
        )
      )
    : [];

  await env.DB.prepare(
    "DELETE FROM feedback_item_tags WHERE feedback_id = ?"
  )
    .bind(feedbackId)
    .run();

  if (!names.length) return;

  const existingPlaceholders = names.map(() => "?").join(",");
  const existingRows = await env.DB.prepare(
    `SELECT id, name FROM feedback_tags
     WHERE workspace_id = ? AND name IN (${existingPlaceholders})`
  )
    .bind(workspaceId, ...names)
    .all();

  const tagMap = new Map<string, number>();
  for (const row of existingRows.results || []) {
    const r = row as { id: number; name: string };
    tagMap.set(r.name, r.id);
  }

  for (const name of names) {
    if (!tagMap.has(name)) {
      const insert = await env.DB.prepare(
        "INSERT INTO feedback_tags (workspace_id, name) VALUES (?, ?)"
      )
        .bind(workspaceId, name)
        .run();
      tagMap.set(name, Number(insert.lastRowId));
    }
  }

  for (const name of names) {
    const tagId = tagMap.get(name);
    if (!tagId) continue;
    await env.DB.prepare(
      `INSERT OR IGNORE INTO feedback_item_tags (feedback_id, tag_id)
       VALUES (?, ?)`
    )
      .bind(feedbackId, tagId)
      .run();
  }
}

async function getAdminStats(
  env: Env,
  workspaceSlug: string,
  boardSlug: string
): Promise<Response> {
  const { boardId } = await getOrCreateWorkspaceAndBoard(
    env,
    workspaceSlug,
    boardSlug
  );

  const totalRow = await env.DB
    .prepare("SELECT COUNT(*) as count FROM feedback_items WHERE board_id = ?")
    .bind(boardId)
    .first<{ count: number }>();

  const pendingRow = await env.DB
    .prepare(
      "SELECT COUNT(*) as count FROM feedback_items WHERE board_id = ? AND moderation_state = 'pending'"
    )
    .bind(boardId)
    .first<{ count: number }>();

  const today = new Date().toISOString().split("T")[0];
  const approvedTodayRow = await env.DB
    .prepare(
      "SELECT COUNT(*) as count FROM feedback_items WHERE board_id = ? AND moderation_state = 'approved' AND DATE(created_at) = ?"
    )
    .bind(boardId, today)
    .first<{ count: number }>();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString();

  const topVotedResult = await env.DB
    .prepare(
      `SELECT
         f.id,
         f.title,
         COALESCE(SUM(v.weight), 0) AS vote_count
       FROM feedback_items f
       LEFT JOIN feedback_votes v ON v.feedback_id = f.id
       WHERE f.board_id = ? AND f.created_at >= ?
       GROUP BY f.id
       ORDER BY vote_count DESC
       LIMIT 5`
    )
    .bind(boardId, sevenDaysAgo)
    .all();

  return jsonResponse({
    total: totalRow?.count ?? 0,
    pending_moderation: pendingRow?.count ?? 0,
    approved_today: approvedTodayRow?.count ?? 0,
    top_voted_this_week: topVotedResult.results || []
  });
}

async function bulkUpdateFeedback(
  env: Env,
  workspaceSlug: string,
  boardSlug: string,
  body: Record<string, unknown> | null
): Promise<Response> {
  if (!body || typeof body.action !== "string") {
    return errorResponse(400, "Action is required");
  }

  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return errorResponse(400, "IDs array is required");
  }

  if (body.ids.length > 50) {
    return errorResponse(400, "Maximum 50 IDs per request");
  }

  const ids = body.ids.filter((id) => Number.isFinite(id)) as number[];
  if (ids.length === 0) {
    return errorResponse(400, "No valid IDs provided");
  }

  const { workspaceId, boardId } = await getOrCreateWorkspaceAndBoard(
    env,
    workspaceSlug,
    boardSlug
  );

  const action = body.action;
  const now = new Date().toISOString();
  let affected = 0;

  if (action === "approve") {
    const placeholders = ids.map(() => "?").join(",");
    const result = await env.DB
      .prepare(
        `UPDATE feedback_items
         SET moderation_state = 'approved', updated_at = ?
         WHERE board_id = ? AND id IN (${placeholders})`
      )
      .bind(now, boardId, ...ids)
      .run();
    affected = result.changes ?? 0;
  } else if (action === "reject") {
    const placeholders = ids.map(() => "?").join(",");
    const result = await env.DB
      .prepare(
        `UPDATE feedback_items
         SET moderation_state = 'rejected', updated_at = ?
         WHERE board_id = ? AND id IN (${placeholders})`
      )
      .bind(now, boardId, ...ids)
      .run();
    affected = result.changes ?? 0;
  } else if (action === "set_status") {
    if (
      typeof body.value !== "string" ||
      !ALLOWED_STATUSES.has(body.value)
    ) {
      return errorResponse(400, "Invalid status value");
    }
    const placeholders = ids.map(() => "?").join(",");
    const result = await env.DB
      .prepare(
        `UPDATE feedback_items
         SET status = ?, updated_at = ?
         WHERE board_id = ? AND id IN (${placeholders})`
      )
      .bind(body.value, now, boardId, ...ids)
      .run();
    affected = result.changes ?? 0;
  } else if (action === "add_tag") {
    if (typeof body.value !== "string" || !body.value.trim()) {
      return errorResponse(400, "Tag name is required");
    }

    for (const feedbackId of ids) {
      await applyTags(env, workspaceId, feedbackId, [body.value]);
    }
    affected = ids.length;
  } else {
    return errorResponse(400, "Invalid action");
  }

  return jsonResponse({ affected });
}

async function deleteFeedback(
  env: Env,
  workspaceSlug: string,
  boardSlug: string,
  feedbackId: number
): Promise<Response> {
  if (!Number.isFinite(feedbackId)) {
    return errorResponse(400, "Invalid feedback id");
  }

  const { boardId } = await getOrCreateWorkspaceAndBoard(
    env,
    workspaceSlug,
    boardSlug
  );

  const result = await env.DB
    .prepare("DELETE FROM feedback_items WHERE id = ? AND board_id = ?")
    .bind(feedbackId, boardId)
    .run();

  if (result.changes === 0) {
    return errorResponse(404, "Feedback not found");
  }

  return new Response(null, { status: 204 });
}

async function listTags(
  env: Env,
  workspaceSlug: string
): Promise<Response> {
  const workspace = await env.DB
    .prepare("SELECT id FROM workspaces WHERE slug = ?")
    .bind(workspaceSlug)
    .first<{ id: number }>();

  if (!workspace) {
    return jsonResponse({ tags: [] });
  }

  const result = await env.DB
    .prepare(
      `SELECT
         t.id,
         t.name,
         t.color,
         t.created_at,
         COUNT(fit.feedback_id) as usage_count
       FROM feedback_tags t
       LEFT JOIN feedback_item_tags fit ON fit.tag_id = t.id
       WHERE t.workspace_id = ?
       GROUP BY t.id
       ORDER BY t.name ASC`
    )
    .bind(workspace.id)
    .all();

  return jsonResponse({ tags: result.results || [] });
}

async function createTag(
  env: Env,
  workspaceSlug: string,
  body: Record<string, unknown> | null
): Promise<Response> {
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return errorResponse(400, "Tag name is required");
  }

  const name = body.name.trim().toLowerCase();
  const color =
    typeof body.color === "string" && body.color.trim()
      ? body.color.trim()
      : "#6b7280";

  let workspace = await env.DB
    .prepare("SELECT id FROM workspaces WHERE slug = ?")
    .bind(workspaceSlug)
    .first<{ id: number }>();

  if (!workspace) {
    await env.DB
      .prepare("INSERT INTO workspaces (slug, name) VALUES (?, ?)")
      .bind(workspaceSlug, workspaceSlug)
      .run();

    workspace = await env.DB
      .prepare("SELECT id FROM workspaces WHERE slug = ?")
      .bind(workspaceSlug)
      .first<{ id: number }>();
  }

  if (!workspace) {
    return errorResponse(500, "Failed to create workspace");
  }

  try {
    const result = await env.DB
      .prepare(
        "INSERT INTO feedback_tags (workspace_id, name, color) VALUES (?, ?, ?)"
      )
      .bind(workspace.id, name, color)
      .run();

    const created = await env.DB
      .prepare("SELECT * FROM feedback_tags WHERE id = ?")
      .bind(result.lastRowId)
      .first();

    return jsonResponse({ tag: created }, { status: 201 });
  } catch (error: any) {
    if (error?.message?.includes("UNIQUE")) {
      return errorResponse(409, "Tag already exists");
    }
    throw error;
  }
}

async function updateTag(
  env: Env,
  workspaceSlug: string,
  tagId: number,
  body: Record<string, unknown> | null
): Promise<Response> {
  if (!Number.isFinite(tagId)) {
    return errorResponse(400, "Invalid tag id");
  }

  const workspace = await env.DB
    .prepare("SELECT id FROM workspaces WHERE slug = ?")
    .bind(workspaceSlug)
    .first<{ id: number }>();

  if (!workspace) {
    return errorResponse(404, "Workspace not found");
  }

  const fields: string[] = [];
  const values: Array<string | number> = [];

  if (body && "name" in body) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return errorResponse(400, "Tag name cannot be empty");
    }
    fields.push("name = ?");
    values.push(body.name.trim().toLowerCase());
  }

  if (body && "color" in body) {
    if (typeof body.color !== "string") {
      return errorResponse(400, "Color must be a string");
    }
    fields.push("color = ?");
    values.push(body.color.trim() || "#6b7280");
  }

  if (fields.length === 0) {
    return errorResponse(400, "No fields to update");
  }

  values.push(tagId);
  values.push(workspace.id);

  const result = await env.DB
    .prepare(
      `UPDATE feedback_tags SET ${fields.join(", ")} WHERE id = ? AND workspace_id = ?`
    )
    .bind(...values)
    .run();

  if (result.changes === 0) {
    return errorResponse(404, "Tag not found");
  }

  const updated = await env.DB
    .prepare("SELECT * FROM feedback_tags WHERE id = ?")
    .bind(tagId)
    .first();

  return jsonResponse({ tag: updated });
}

async function deleteTag(
  env: Env,
  workspaceSlug: string,
  tagId: number
): Promise<Response> {
  if (!Number.isFinite(tagId)) {
    return errorResponse(400, "Invalid tag id");
  }

  const workspace = await env.DB
    .prepare("SELECT id FROM workspaces WHERE slug = ?")
    .bind(workspaceSlug)
    .first<{ id: number }>();

  if (!workspace) {
    return errorResponse(404, "Workspace not found");
  }

  const result = await env.DB
    .prepare("DELETE FROM feedback_tags WHERE id = ? AND workspace_id = ?")
    .bind(tagId, workspace.id)
    .run();

  if (result.changes === 0) {
    return errorResponse(404, "Tag not found");
  }

  return new Response(null, { status: 204 });
}

function serializeFeedbackRow(
  row: RawFeedbackRow,
  options?: { includeMeta?: boolean }
): Record<string, unknown> {
  const tags =
    typeof row.tags === "string" && row.tags.length
      ? Array.from(
          new Set(
            row.tags
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean)
          )
        )
      : [];

  const base: Record<string, unknown> = {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    vote_count: Number(row.vote_count ?? 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
    tags
  };

  if (options?.includeMeta) {
    base.source = row.source;
    base.moderation_state = row.moderation_state;
    base.is_hidden = Boolean(row.is_hidden);
  }

  return base;
}

function verifyAdminAuth(request: Request, env: Env): Response | null {
  const expected = env.ADMIN_API_TOKEN;
  if (!expected) {
    return errorResponse(501, "Admin API not configured");
  }
  const provided = request.headers.get("x-admin-token");
  if (!provided || provided !== expected) {
    return errorResponse(401, "Unauthorized");
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Workspace-level Admin Handlers
// These aggregate data across ALL boards in a workspace
// ─────────────────────────────────────────────────────────────────────────────

async function getWorkspaceStats(
  env: Env,
  workspaceSlug: string
): Promise<Response> {
  const workspace = await env.DB
    .prepare("SELECT id FROM workspaces WHERE slug = ?")
    .bind(workspaceSlug)
    .first<{ id: number }>();

  if (!workspace) {
    return errorResponse(404, "Workspace not found");
  }

  // Get all board IDs for this workspace
  const boards = await env.DB
    .prepare("SELECT id FROM boards WHERE workspace_id = ?")
    .bind(workspace.id)
    .all<{ id: number }>();

  const boardIds = boards.results?.map((b) => b.id) || [];

  if (boardIds.length === 0) {
    // No boards yet, return zeroed stats
    return jsonResponse({
      totalFeedback: 0,
      pendingModeration: 0,
      approvedToday: 0,
      topVotedId: null,
      topVotedTitle: null,
      topVotedVotes: 0
    });
  }

  const placeholders = boardIds.map(() => "?").join(",");

  // Total feedback count
  const totalResult = await env.DB
    .prepare(`SELECT COUNT(*) as total FROM feedback_items WHERE board_id IN (${placeholders})`)
    .bind(...boardIds)
    .first<{ total: number }>();

  // Pending moderation count
  const pendingResult = await env.DB
    .prepare(`SELECT COUNT(*) as pending FROM feedback_items WHERE board_id IN (${placeholders}) AND moderation_state = 'pending'`)
    .bind(...boardIds)
    .first<{ pending: number }>();

  // Approved today count (last 24 hours)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const approvedTodayResult = await env.DB
    .prepare(`SELECT COUNT(*) as approved FROM feedback_items WHERE board_id IN (${placeholders}) AND moderation_state = 'approved' AND updated_at >= ?`)
    .bind(...boardIds, oneDayAgo)
    .first<{ approved: number }>();

  // Top voted item
  const topVotedResult = await env.DB
    .prepare(`
      SELECT f.id, f.title, COALESCE(SUM(v.weight), 0) as vote_count
      FROM feedback_items f
      LEFT JOIN feedback_votes v ON v.feedback_id = f.id
      WHERE f.board_id IN (${placeholders})
      GROUP BY f.id
      ORDER BY vote_count DESC
      LIMIT 1
    `)
    .bind(...boardIds)
    .first<{ id: number; title: string; vote_count: number }>();

  return jsonResponse({
    totalFeedback: totalResult?.total || 0,
    pendingModeration: pendingResult?.pending || 0,
    approvedToday: approvedTodayResult?.approved || 0,
    topVotedId: topVotedResult?.id || null,
    topVotedTitle: topVotedResult?.title || null,
    topVotedVotes: Number(topVotedResult?.vote_count || 0)
  });
}

async function getWorkspaceRecentFeedback(
  env: Env,
  workspaceSlug: string,
  limit: number
): Promise<Response> {
  const workspace = await env.DB
    .prepare("SELECT id FROM workspaces WHERE slug = ?")
    .bind(workspaceSlug)
    .first<{ id: number }>();

  if (!workspace) {
    return errorResponse(404, "Workspace not found");
  }

  const boards = await env.DB
    .prepare("SELECT id FROM boards WHERE workspace_id = ?")
    .bind(workspace.id)
    .all<{ id: number }>();

  const boardIds = boards.results?.map((b) => b.id) || [];

  if (boardIds.length === 0) {
    return jsonResponse([]);
  }

  const placeholders = boardIds.map(() => "?").join(",");

  const result = await env.DB
    .prepare(`
      SELECT
        f.id, f.board_id, f.author_id, f.title, f.description,
        f.status, f.source, f.moderation_state, f.is_hidden,
        f.created_at, f.updated_at,
        COALESCE(SUM(v.weight), 0) as vote_count,
        e.name as author_name,
        b.name as board_name
      FROM feedback_items f
      LEFT JOIN feedback_votes v ON v.feedback_id = f.id
      LEFT JOIN end_users e ON e.id = f.author_id
      LEFT JOIN boards b ON b.id = f.board_id
      WHERE f.board_id IN (${placeholders})
      GROUP BY f.id
      ORDER BY f.created_at DESC
      LIMIT ?
    `)
    .bind(...boardIds, limit)
    .all();

  const items = (result.results || []).map((row: Record<string, unknown>) => ({
    id: row.id,
    board_id: row.board_id,
    author_id: row.author_id,
    title: row.title,
    description: row.description,
    status: row.status,
    source: row.source,
    moderation_state: row.moderation_state,
    is_hidden: row.is_hidden,
    created_at: row.created_at,
    updated_at: row.updated_at,
    vote_count: Number(row.vote_count || 0),
    author_name: row.author_name || null,
    board_name: row.board_name
  }));

  return jsonResponse(items);
}

interface WorkspaceFeedbackListOptions {
  status: string | null;
  moderationState: string | null;
  search: string | null;
  sort: string | null;
  order: string | null;
  limit: number;
  offset: number;
}

async function listWorkspaceFeedback(
  env: Env,
  workspaceSlug: string,
  options: WorkspaceFeedbackListOptions
): Promise<Response> {
  const workspace = await env.DB
    .prepare("SELECT id FROM workspaces WHERE slug = ?")
    .bind(workspaceSlug)
    .first<{ id: number }>();

  if (!workspace) {
    return errorResponse(404, "Workspace not found");
  }

  const boards = await env.DB
    .prepare("SELECT id FROM boards WHERE workspace_id = ?")
    .bind(workspace.id)
    .all<{ id: number }>();

  const boardIds = boards.results?.map((b) => b.id) || [];

  if (boardIds.length === 0) {
    return jsonResponse({ items: [], total: 0, limit: options.limit, offset: options.offset });
  }

  const placeholders = boardIds.map(() => "?").join(",");
  const conditions: string[] = [`f.board_id IN (${placeholders})`];
  const params: (string | number)[] = [...boardIds];

  // Filter by status (comma-separated)
  if (options.status) {
    const statuses = options.status.split(",").filter(Boolean);
    if (statuses.length > 0) {
      const statusPlaceholders = statuses.map(() => "?").join(",");
      conditions.push(`f.status IN (${statusPlaceholders})`);
      params.push(...statuses);
    }
  }

  // Filter by moderation state (comma-separated)
  if (options.moderationState) {
    const states = options.moderationState.split(",").filter(Boolean);
    if (states.length > 0) {
      const statePlaceholders = states.map(() => "?").join(",");
      conditions.push(`f.moderation_state IN (${statePlaceholders})`);
      params.push(...states);
    }
  }

  // Search in title and description
  if (options.search) {
    conditions.push("(f.title LIKE ? OR f.description LIKE ?)");
    const searchTerm = `%${options.search}%`;
    params.push(searchTerm, searchTerm);
  }

  const whereClause = conditions.join(" AND ");

  // Count total matching items
  const countResult = await env.DB
    .prepare(`SELECT COUNT(*) as total FROM feedback_items f WHERE ${whereClause}`)
    .bind(...params)
    .first<{ total: number }>();

  // Determine sort order
  const validSortColumns = ["created_at", "updated_at", "vote_count", "status", "title"];
  const sortColumn = validSortColumns.includes(options.sort || "") ? options.sort : "created_at";
  const sortOrder = options.order === "asc" ? "ASC" : "DESC";

  // For vote_count sort, we need to use the aggregated column
  const orderByClause = sortColumn === "vote_count"
    ? `vote_count ${sortOrder}`
    : `f.${sortColumn} ${sortOrder}`;

  // Fetch items with pagination
  const result = await env.DB
    .prepare(`
      SELECT
        f.id, f.board_id, f.author_id, f.title, f.description,
        f.status, f.source, f.moderation_state, f.is_hidden,
        f.created_at, f.updated_at,
        COALESCE(SUM(v.weight), 0) as vote_count,
        e.name as author_name,
        b.name as board_name
      FROM feedback_items f
      LEFT JOIN feedback_votes v ON v.feedback_id = f.id
      LEFT JOIN end_users e ON e.id = f.author_id
      LEFT JOIN boards b ON b.id = f.board_id
      WHERE ${whereClause}
      GROUP BY f.id
      ORDER BY ${orderByClause}
      LIMIT ? OFFSET ?
    `)
    .bind(...params, options.limit, options.offset)
    .all();

  const items = (result.results || []).map((row: Record<string, unknown>) => ({
    id: row.id,
    board_id: row.board_id,
    author_id: row.author_id,
    title: row.title,
    description: row.description,
    status: row.status,
    source: row.source,
    moderation_state: row.moderation_state,
    is_hidden: row.is_hidden,
    created_at: row.created_at,
    updated_at: row.updated_at,
    vote_count: Number(row.vote_count || 0),
    author_name: row.author_name || null,
    board_name: row.board_name
  }));

  return jsonResponse({
    items,
    total: countResult?.total || 0,
    limit: options.limit,
    offset: options.offset
  });
}

async function getWorkspaceFeedbackItem(
  env: Env,
  workspaceSlug: string,
  feedbackId: number
): Promise<Response> {
  const workspace = await env.DB
    .prepare("SELECT id FROM workspaces WHERE slug = ?")
    .bind(workspaceSlug)
    .first<{ id: number }>();

  if (!workspace) {
    return errorResponse(404, "Workspace not found");
  }

  const result = await env.DB
    .prepare(`
      SELECT
        f.id, f.board_id, f.author_id, f.title, f.description,
        f.status, f.source, f.moderation_state, f.is_hidden,
        f.created_at, f.updated_at,
        COALESCE(SUM(v.weight), 0) as vote_count,
        e.name as author_name,
        b.name as board_name
      FROM feedback_items f
      LEFT JOIN feedback_votes v ON v.feedback_id = f.id
      LEFT JOIN end_users e ON e.id = f.author_id
      LEFT JOIN boards b ON b.id = f.board_id
      WHERE f.id = ? AND b.workspace_id = ?
      GROUP BY f.id
    `)
    .bind(feedbackId, workspace.id)
    .first();

  if (!result) {
    return errorResponse(404, "Feedback item not found");
  }

  return jsonResponse({
    id: result.id,
    board_id: result.board_id,
    author_id: result.author_id,
    title: result.title,
    description: result.description,
    status: result.status,
    source: result.source,
    moderation_state: result.moderation_state,
    is_hidden: result.is_hidden,
    created_at: result.created_at,
    updated_at: result.updated_at,
    vote_count: Number(result.vote_count || 0),
    author_name: result.author_name || null,
    board_name: result.board_name
  });
}

async function updateWorkspaceFeedback(
  env: Env,
  workspaceSlug: string,
  feedbackId: number,
  body: Record<string, unknown>
): Promise<Response> {
  const workspace = await env.DB
    .prepare("SELECT id FROM workspaces WHERE slug = ?")
    .bind(workspaceSlug)
    .first<{ id: number }>();

  if (!workspace) {
    return errorResponse(404, "Workspace not found");
  }

  // Verify feedback belongs to this workspace
  const existing = await env.DB
    .prepare(`
      SELECT f.id FROM feedback_items f
      JOIN boards b ON b.id = f.board_id
      WHERE f.id = ? AND b.workspace_id = ?
    `)
    .bind(feedbackId, workspace.id)
    .first();

  if (!existing) {
    return errorResponse(404, "Feedback item not found");
  }

  const updates: string[] = [];
  const values: (string | number)[] = [];

  // Update status
  if (body.status !== undefined) {
    const validStatuses = ["open", "under_review", "planned", "in_progress", "done", "declined"];
    if (!validStatuses.includes(body.status as string)) {
      return errorResponse(400, `Invalid status. Must be one of: ${validStatuses.join(", ")}`);
    }
    updates.push("status = ?");
    values.push(body.status as string);
  }

  // Update moderation_state
  if (body.moderation_state !== undefined) {
    const validStates = ["pending", "approved", "rejected"];
    if (!validStates.includes(body.moderation_state as string)) {
      return errorResponse(400, `Invalid moderation_state. Must be one of: ${validStates.join(", ")}`);
    }
    updates.push("moderation_state = ?");
    values.push(body.moderation_state as string);
  }

  // Update is_hidden
  if (body.is_hidden !== undefined) {
    updates.push("is_hidden = ?");
    values.push(body.is_hidden ? 1 : 0);
  }

  // Update title
  if (body.title !== undefined) {
    if (typeof body.title !== "string" || body.title.trim().length === 0) {
      return errorResponse(400, "Title must be a non-empty string");
    }
    updates.push("title = ?");
    values.push(body.title.trim());
  }

  // Update description
  if (body.description !== undefined) {
    updates.push("description = ?");
    values.push(body.description as string || "");
  }

  if (updates.length === 0) {
    return errorResponse(400, "No valid fields to update");
  }

  updates.push("updated_at = datetime('now')");
  values.push(feedbackId);

  await env.DB
    .prepare(`UPDATE feedback_items SET ${updates.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();

  // Return updated item
  return getWorkspaceFeedbackItem(env, workspaceSlug, feedbackId);
}

async function deleteWorkspaceFeedback(
  env: Env,
  workspaceSlug: string,
  feedbackId: number
): Promise<Response> {
  const workspace = await env.DB
    .prepare("SELECT id FROM workspaces WHERE slug = ?")
    .bind(workspaceSlug)
    .first<{ id: number }>();

  if (!workspace) {
    return errorResponse(404, "Workspace not found");
  }

  // Delete feedback that belongs to this workspace
  const result = await env.DB
    .prepare(`
      DELETE FROM feedback_items
      WHERE id = ? AND board_id IN (
        SELECT id FROM boards WHERE workspace_id = ?
      )
    `)
    .bind(feedbackId, workspace.id)
    .run();

  if (result.changes === 0) {
    return errorResponse(404, "Feedback item not found");
  }

  return new Response(null, { status: 204 });
}

interface BulkActionBody {
  ids: number[];
  action: "approve" | "reject" | "set_status";
  status?: string;
}

async function workspaceBulkUpdateFeedback(
  env: Env,
  workspaceSlug: string,
  body: BulkActionBody
): Promise<Response> {
  const workspace = await env.DB
    .prepare("SELECT id FROM workspaces WHERE slug = ?")
    .bind(workspaceSlug)
    .first<{ id: number }>();

  if (!workspace) {
    return errorResponse(404, "Workspace not found");
  }

  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return errorResponse(400, "ids must be a non-empty array");
  }

  if (!["approve", "reject", "set_status"].includes(body.action)) {
    return errorResponse(400, "action must be 'approve', 'reject', or 'set_status'");
  }

  // Get all board IDs for this workspace
  const boards = await env.DB
    .prepare("SELECT id FROM boards WHERE workspace_id = ?")
    .bind(workspace.id)
    .all<{ id: number }>();

  const boardIds = boards.results?.map((b) => b.id) || [];

  if (boardIds.length === 0) {
    return errorResponse(404, "No boards found in workspace");
  }

  const boardPlaceholders = boardIds.map(() => "?").join(",");
  const idPlaceholders = body.ids.map(() => "?").join(",");

  let updateQuery: string;
  const updateParams: (string | number)[] = [];

  switch (body.action) {
    case "approve":
      updateQuery = `
        UPDATE feedback_items
        SET moderation_state = 'approved', is_hidden = 0, updated_at = datetime('now')
        WHERE id IN (${idPlaceholders}) AND board_id IN (${boardPlaceholders})
      `;
      updateParams.push(...body.ids, ...boardIds);
      break;

    case "reject":
      updateQuery = `
        UPDATE feedback_items
        SET moderation_state = 'rejected', is_hidden = 1, updated_at = datetime('now')
        WHERE id IN (${idPlaceholders}) AND board_id IN (${boardPlaceholders})
      `;
      updateParams.push(...body.ids, ...boardIds);
      break;

    case "set_status":
      if (!body.status) {
        return errorResponse(400, "status is required for set_status action");
      }
      const validStatuses = ["open", "under_review", "planned", "in_progress", "done", "declined"];
      if (!validStatuses.includes(body.status)) {
        return errorResponse(400, `Invalid status. Must be one of: ${validStatuses.join(", ")}`);
      }
      updateQuery = `
        UPDATE feedback_items
        SET status = ?, updated_at = datetime('now')
        WHERE id IN (${idPlaceholders}) AND board_id IN (${boardPlaceholders})
      `;
      updateParams.push(body.status, ...body.ids, ...boardIds);
      break;

    default:
      return errorResponse(400, "Unknown action");
  }

  const result = await env.DB
    .prepare(updateQuery)
    .bind(...updateParams)
    .run();

  return jsonResponse({
    updated: result.meta?.changes || 0,
    ids: body.ids
  });
}

// Workspace-level tag functions (Pattern 1 aliases)
async function getWorkspaceTags(
  env: Env,
  workspaceSlug: string
): Promise<Response> {
  return listTags(env, workspaceSlug);
}

async function createWorkspaceTag(
  env: Env,
  workspaceSlug: string,
  body: Record<string, unknown> | null
): Promise<Response> {
  return createTag(env, workspaceSlug, body);
}

async function updateWorkspaceTag(
  env: Env,
  workspaceSlug: string,
  tagId: number,
  body: Record<string, unknown> | null
): Promise<Response> {
  return updateTag(env, workspaceSlug, tagId, body);
}

async function deleteWorkspaceTag(
  env: Env,
  workspaceSlug: string,
  tagId: number
): Promise<Response> {
  return deleteTag(env, workspaceSlug, tagId);
}
