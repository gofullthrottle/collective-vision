export interface Env {
  DB: D1Database;
}

const WIDGET_JS = String.raw`(function () {
  var script = document.currentScript;
  if (!script) return;

  var workspace = script.dataset.workspace || "default";
  var board = script.dataset.board || "main";
  var apiBase = script.dataset.apiBase;

  if (!apiBase) {
    try {
      var srcUrl = new URL(script.src);
      apiBase = srcUrl.origin;
    } catch (e) {
      apiBase = "";
    }
  }

  var container = document.createElement("div");
  container.id = "cv-feedback-widget";
  container.style.border = "1px solid #e0e0e0";
  container.style.borderRadius = "8px";
  container.style.padding = "12px";
  container.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  container.style.fontSize = "14px";
  container.style.maxWidth = "480px";

  var heading = document.createElement("div");
  heading.textContent = "Feedback";
  heading.style.fontWeight = "600";
  heading.style.marginBottom = "8px";
  container.appendChild(heading);

  var list = document.createElement("div");
  list.id = "cv-feedback-list";
  list.style.marginBottom = "8px";
  container.appendChild(list);

  var form = document.createElement("form");
  form.style.display = "flex";
  form.style.flexDirection = "column";
  form.style.gap = "4px";

  var titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.placeholder = "Suggest a feature or improvement...";
  titleInput.required = true;
  titleInput.style.padding = "6px 8px";
  titleInput.style.borderRadius = "4px";
  titleInput.style.border = "1px solid #d0d0d0";
  form.appendChild(titleInput);

  var descriptionInput = document.createElement("textarea");
  descriptionInput.placeholder = "Optional details";
  descriptionInput.rows = 2;
  descriptionInput.style.padding = "6px 8px";
  descriptionInput.style.borderRadius = "4px";
  descriptionInput.style.border = "1px solid #d0d0d0";
  descriptionInput.style.resize = "vertical";
  form.appendChild(descriptionInput);

  var submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = "Submit feedback";
  submit.style.marginTop = "4px";
  submit.style.alignSelf = "flex-start";
  submit.style.padding = "6px 10px";
  submit.style.borderRadius = "4px";
  submit.style.border = "none";
  submit.style.backgroundColor = "#2563eb";
  submit.style.color = "#ffffff";
  submit.style.cursor = "pointer";
  form.appendChild(submit);

  var message = document.createElement("div");
  message.style.marginTop = "4px";
  message.style.fontSize = "12px";
  container.appendChild(message);

  script.parentNode && script.parentNode.insertBefore(container, script.nextSibling);

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

  function setMessage(text, isError) {
    message.textContent = text || "";
    message.style.color = isError ? "#b91c1c" : "#16a34a";
  }

  function renderFeedback(items) {
    list.innerHTML = "";
    if (!items || !items.length) {
      var empty = document.createElement("div");
      empty.textContent = "No feedback yet. Be the first!";
      empty.style.color = "#737373";
      list.appendChild(empty);
      return;
    }

    items.forEach(function (item) {
      var row = document.createElement("div");
      row.style.display = "flex";
      row.style.gap = "8px";
      row.style.marginBottom = "6px";

      var vote = document.createElement("button");
      vote.type = "button";
      vote.textContent = "▲ " + (item.vote_count || 0);
      vote.style.minWidth = "48px";
      vote.style.padding = "4px 6px";
      vote.style.borderRadius = "4px";
      vote.style.border = "1px solid #d0d0d0";
      vote.style.backgroundColor = "#f9fafb";
      vote.style.cursor = "pointer";
      vote.addEventListener("click", function () {
        voteFeedback(item.id, vote);
      });

      var main = document.createElement("div");
      var title = document.createElement("div");
      title.textContent = item.title;
      title.style.fontWeight = "500";
      main.appendChild(title);

      if (item.description) {
        var desc = document.createElement("div");
        desc.textContent = item.description;
        desc.style.color = "#4b5563";
        desc.style.fontSize = "13px";
        main.appendChild(desc);
      }

      row.appendChild(vote);
      row.appendChild(main);
      list.appendChild(row);
    });
  }

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

  function voteFeedback(id, button) {
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
          button.textContent = "▲ " + data.vote_count;
        }
      })
      .catch(function () {
        setMessage("Could not record vote.", true);
      })
      .finally(function () {
        button.disabled = false;
      });
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    setMessage("", false);
    var title = titleInput.value.trim();
    var description = descriptionInput.value.trim();
    if (!title) return;

    submit.disabled = true;
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
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then(function () {
        titleInput.value = "";
        descriptionInput.value = "";
        setMessage("Thank you for your feedback!", false);
        fetchFeedback();
      })
      .catch(function () {
        setMessage("Could not submit feedback.", true);
      })
      .finally(function () {
        submit.disabled = false;
      });
  });

  fetchFeedback();
})();`;

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

function withCors(request: Request, response: Response): Response {
  const origin = request.headers.get("Origin") || "*";
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Credentials", "true");
  if (!headers.has("Access-Control-Allow-Headers")) {
    headers.set("Access-Control-Allow-Headers", "Content-Type");
  }
  if (!headers.has("Access-Control-Allow-Methods")) {
    headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);

  // /api/v1/:workspace/:board/feedback[/:id[/votes]]
  if (parts.length < 5 || parts[0] !== "api" || parts[1] !== "v1") {
    return jsonResponse({ error: "Not found" }, { status: 404 });
  }

  const [, , workspaceSlug, boardSlug, resource, maybeId, subresource] = parts;

  if (resource !== "feedback") {
    return jsonResponse({ error: "Not found" }, { status: 404 });
  }

  if (request.method === "GET" && !maybeId) {
    return listFeedback(env, workspaceSlug, boardSlug);
  }

  if (request.method === "POST" && !maybeId) {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.title !== "string") {
      return jsonResponse({ error: "Invalid payload" }, { status: 400 });
    }
    return createFeedback(env, workspaceSlug, boardSlug, body);
  }

  if (request.method === "POST" && maybeId && subresource === "votes") {
    const body = await request.json().catch(() => null);
    return voteOnFeedback(env, workspaceSlug, boardSlug, Number(maybeId), body);
  }

  return jsonResponse({ error: "Not found" }, { status: 404 });
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

  const db = env.DB;

  const existing = await db
    .prepare(
      "SELECT id FROM end_users WHERE workspace_id = ? AND external_user_id = ?"
    )
    .bind(workspaceId, externalUserId)
    .first<{ id: number }>();

  if (existing) return existing.id;

  await db
    .prepare(
      "INSERT INTO end_users (workspace_id, external_user_id, name) VALUES (?, ?, ?)"
    )
    .bind(workspaceId, externalUserId, null)
    .run();

  const created = await db
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
  boardSlug: string
): Promise<Response> {
  const { boardId } = await getOrCreateWorkspaceAndBoard(
    env,
    workspaceSlug,
    boardSlug
  );

  const result = await env.DB.prepare(
    `SELECT
       f.id,
       f.title,
       f.description,
       f.status,
       f.created_at,
       COALESCE(SUM(v.weight), 0) AS vote_count
     FROM feedback_items f
     LEFT JOIN feedback_votes v ON v.feedback_id = f.id
     WHERE f.board_id = ?
       AND f.is_hidden = 0
       AND f.moderation_state = 'approved'
     GROUP BY f.id
     ORDER BY vote_count DESC, f.created_at DESC
     LIMIT 50`
  )
    .bind(boardId)
    .all();

  return jsonResponse({ items: result.results || [] });
}

async function createFeedback(
  env: Env,
  workspaceSlug: string,
  boardSlug: string,
  body: any
): Promise<Response> {
  const { workspaceId, boardId } = await getOrCreateWorkspaceAndBoard(
    env,
    workspaceSlug,
    boardSlug
  );

  const authorId = await getOrCreateEndUser(
    env,
    workspaceId,
    typeof body.externalUserId === "string" ? body.externalUserId : null
  );

  const now = new Date().toISOString();

  const result = await env.DB.prepare(
    `INSERT INTO feedback_items
       (board_id, author_id, title, description, status, source, moderation_state, is_hidden, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'open', 'widget', 'approved', 0, ?, ?)`
  )
    .bind(
      boardId,
      authorId,
      body.title,
      typeof body.description === "string" ? body.description : null,
      now,
      now
    )
    .run();

  const id = result.lastRowId;

  return jsonResponse(
    {
      id,
      title: body.title,
      description: body.description || null,
      status: "open",
      vote_count: 0,
      created_at: now
    },
    { status: 201 }
  );
}

async function voteOnFeedback(
  env: Env,
  workspaceSlug: string,
  boardSlug: string,
  feedbackId: number,
  body: any
): Promise<Response> {
  if (!feedbackId || Number.isNaN(feedbackId)) {
    return jsonResponse({ error: "Invalid feedback id" }, { status: 400 });
  }

  const { workspaceId } = await getOrCreateWorkspaceAndBoard(
    env,
    workspaceSlug,
    boardSlug
  );

  const userId = await getOrCreateEndUser(
    env,
    workspaceId,
    body && typeof body.externalUserId === "string"
      ? body.externalUserId
      : null
  );

  if (!userId) {
    return jsonResponse({ error: "Missing user" }, { status: 400 });
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
    vote_count: row?.vote_count ?? 0
  });
}

const worker: ExportedHandler<Env> = {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      const preflight = new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin":
            request.headers.get("Origin") || "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
      return preflight;
    }

    if (request.method === "GET" && url.pathname === "/health") {
      const resp = jsonResponse({ ok: true });
      return withCors(request, resp);
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
