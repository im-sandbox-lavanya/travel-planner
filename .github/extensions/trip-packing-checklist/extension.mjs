import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { joinSession, createCanvas, CanvasError } from "@microsoft/copilot-sdk/extension";

const servers = new Map();
const extensionDir = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(extensionDir, "..", "..", "..");
const plansPaths = [
  resolve(process.cwd(), "data", "plans.json"),
  resolve(repositoryRoot, "data", "plans.json"),
];

async function loadPlans() {
  for (const plansPath of plansPaths) {
    try {
      const plans = JSON.parse(await readFile(plansPath, "utf8"));
      if (Array.isArray(plans)) return plans;
    } catch {
      continue;
    }
  }
  return [];
}

async function savePlans(plans) {
  let saved = false;
  for (const plansPath of plansPaths) {
    try {
      await writeFile(plansPath, `${JSON.stringify(plans, null, 2)}\n`, "utf8");
      saved = true;
    } catch {
      continue;
    }
  }
  if (!saved) throw new Error("Could not persist packing checklist");
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

async function refreshEntry(entry) {
  entry.plans = await loadPlans();
  if (!entry.planId) entry.planId = entry.plans[0]?.id ?? null;
  if (!entry.plans.some((plan) => plan.id === entry.planId)) {
    entry.planId = entry.plans[0]?.id ?? null;
  }
  return entry.plans.find((plan) => plan.id === entry.planId) ?? null;
}

function renderHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#ffffff">
  <title>Packing Checklist</title>
  <style>
    :root { --status-bar-color: var(--background-color-default, #ffffff); }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--background-color-default, #fff); color: var(--text-color-default, #1f2328); font-family: var(--font-sans, sans-serif); font-size: var(--text-body-medium, 14px); }
    main { max-width: 760px; margin: 0 auto; padding: 24px; }
    h1 { margin: 0 0 16px; font-size: var(--text-title-large, 26px); }
    .toolbar { display: flex; gap: 12px; align-items: end; }
    .field { flex: 1; display: grid; gap: 6px; }
    label { color: var(--text-color-muted, #656d76); font-weight: 600; }
    select, input { width: 100%; border: 1px solid var(--border-color-default, #d0d7de); border-radius: 8px; background: var(--background-color-default, #fff); color: var(--text-color-default, #1f2328); padding: 10px 12px; font: inherit; }
    button { border: 1px solid var(--border-color-default, #d0d7de); border-radius: 8px; background: var(--background-color-default, #fff); color: inherit; padding: 10px 14px; font: inherit; font-weight: 600; cursor: pointer; }
    button.primary { border-color: var(--color-focus-outline, #0969da); background: var(--color-focus-outline, #0969da); color: var(--color-white, #fff); }
    #summary { margin-top: 14px; color: var(--text-color-muted, #656d76); }
    .progress { height: 8px; overflow: hidden; border-radius: 999px; background: var(--border-color-muted, #eaeef2); margin: 8px 0 14px; }
    .progress span { display: block; height: 100%; border-radius: inherit; background: var(--true-color-green, #1a7f37); }
    .add { display: flex; gap: 8px; }
    .add input { flex: 1; }
    ul { list-style: none; padding: 0; margin: 16px 0 0; }
    li { display: flex; align-items: center; gap: 10px; border-bottom: 1px solid var(--border-color-muted, #eaeef2); padding: 10px 0; }
    li.done .name { color: var(--text-color-muted, #656d76); text-decoration: line-through; }
    .check { width: 22px; height: 22px; padding: 0; display: grid; place-items: center; }
    .name { flex: 1; }
    .delete { border: 0; color: var(--true-color-red, #cf222e); background: transparent; }
    .empty { color: var(--text-color-muted, #656d76); justify-content: center; padding: 24px 0; }
  </style>
</head>
<body>
  <main>
    <h1>Packing Checklist</h1>
    <div class="toolbar">
      <div class="field">
        <label for="plan">Travel plan</label>
        <select id="plan"></select>
      </div>
      <button id="refresh" type="button">Refresh</button>
    </div>
    <div id="summary"></div>
    <div class="progress"><span id="progress" style="width:0"></span></div>
    <form id="add" class="add">
      <input id="item" maxlength="120" required placeholder="Add an item (e.g. Passport)">
      <button class="primary" type="submit">Add item</button>
    </form>
    <ul id="items"></ul>
  </main>
  <script>
    const planSelect = document.querySelector("#plan");
    const itemsList = document.querySelector("#items");
    const summary = document.querySelector("#summary");
    const progress = document.querySelector("#progress");

    async function getJson(url, options) {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    }

    function escapeHtml(value) {
      const node = document.createElement("span");
      node.textContent = value;
      return node.innerHTML;
    }

    async function refresh() {
      const state = await getJson("/api/state");
      planSelect.replaceChildren(...state.plans.map((plan) => {
        const option = document.createElement("option");
        option.value = plan.id;
        option.textContent = plan.destination;
        option.selected = plan.id === state.planId;
        return option;
      }));
      const items = state.items ?? [];
      const packed = items.filter((item) => item.packed).length;
      summary.textContent = items.length ? packed + " of " + items.length + " packed" : "";
      progress.style.width = items.length ? (packed * 100 / items.length) + "%" : "0%";
      itemsList.replaceChildren();
      if (!items.length) {
        const empty = document.createElement("li");
        empty.className = "empty";
        empty.textContent = state.planId ? "Nothing packed yet. Add your first item above." : "Create a travel plan to start a packing checklist.";
        itemsList.appendChild(empty);
        return;
      }
      for (const item of items) {
        const li = document.createElement("li");
        li.className = item.packed ? "done" : "";
        li.innerHTML = '<button type="button" class="check" aria-label="Toggle item"></button><span class="name"></span><button type="button" class="delete" aria-label="Delete item">Delete</button>';
        li.querySelector(".check").textContent = item.packed ? "✓" : "";
        li.querySelector(".name").textContent = item.name;
        li.querySelector(".check").addEventListener("click", async () => {
          await getJson("/api/toggle/" + encodeURIComponent(item.id), { method: "POST" });
          await refresh();
        });
        li.querySelector(".delete").addEventListener("click", async () => {
          await getJson("/api/delete/" + encodeURIComponent(item.id), { method: "POST" });
          await refresh();
        });
        itemsList.appendChild(li);
      }
    }

    planSelect.addEventListener("change", async () => {
      await getJson("/api/select/" + encodeURIComponent(planSelect.value), { method: "POST" });
      await refresh();
    });
    document.querySelector("#refresh").addEventListener("click", refresh);
    document.querySelector("#add").addEventListener("submit", async (event) => {
      event.preventDefault();
      const input = document.querySelector("#item");
      await getJson("/api/add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: input.value }) });
      input.value = "";
      await refresh();
    });
    refresh();
  </script>
</body>
</html>`;
}

async function startServer(instanceId) {
  const entry = { plans: await loadPlans(), planId: null, server: null };
  entry.planId = entry.plans[0]?.id ?? null;
  entry.server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (url.pathname === "/" && req.method === "GET") {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(renderHtml());
        return;
      }
      if (url.pathname === "/api/state" && req.method === "GET") {
        const plan = await refreshEntry(entry);
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ planId: entry.planId, plans: entry.plans.map((item) => ({ id: item.id, destination: item.destination })), items: plan?.packing_items ?? [] }));
        return;
      }
      if (url.pathname === "/api/add" && req.method === "POST") {
        const body = await readJson(req);
        const name = String(body.name ?? "").trim();
        if (!name) throw new CanvasError("packing_item_invalid", "Item name is required");
        const plan = await refreshEntry(entry);
        if (!plan) throw new CanvasError("plan_not_found", "No travel plan found");
        plan.packing_items ??= [];
        const item = { id: randomUUID(), name, packed: false };
        plan.packing_items.push(item);
        await savePlans(entry.plans);
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(item));
        return;
      }
      if (url.pathname.startsWith("/api/select/") && req.method === "POST") {
        entry.planId = decodeURIComponent(url.pathname.slice("/api/select/".length));
        await refreshEntry(entry);
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ planId: entry.planId }));
        return;
      }
      const toggleMatch = url.pathname.match(/^\/api\/toggle\/([^/]+)$/);
      if (toggleMatch && req.method === "POST") {
        const plan = await refreshEntry(entry);
        const item = plan?.packing_items?.find((value) => value.id === decodeURIComponent(toggleMatch[1]));
        if (!item) throw new CanvasError("packing_item_not_found", "Packing item not found");
        item.packed = !item.packed;
        await savePlans(entry.plans);
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(item));
        return;
      }
      const deleteMatch = url.pathname.match(/^\/api\/delete\/([^/]+)$/);
      if (deleteMatch && req.method === "POST") {
        const plan = await refreshEntry(entry);
        if (!plan) throw new CanvasError("plan_not_found", "No travel plan found");
        const itemId = decodeURIComponent(deleteMatch[1]);
        plan.packing_items = (plan.packing_items ?? []).filter((item) => item.id !== itemId);
        await savePlans(entry.plans);
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ deleted: true }));
        return;
      }
      res.statusCode = 404;
      res.end("Not found");
    } catch (error) {
      res.statusCode = error instanceof CanvasError ? 422 : 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: error.message }));
    }
  });
  await new Promise((resolveListen) => entry.server.listen(0, "127.0.0.1", resolveListen));
  const address = entry.server.address();
  entry.url = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/`;
  servers.set(instanceId, entry);
  return entry;
}

const packingCanvas = createCanvas({
  id: "trip-packing-checklist",
  displayName: "Trip Packing Checklist",
  description: "Manage packing items and progress for a travel plan.",
  inputSchema: {
    type: "object",
    properties: { planId: { type: "string", description: "Travel plan ID to open" } },
  },
  actions: [
    {
      name: "refresh",
      description: "Reload the current packing checklist",
      handler: async (ctx) => {
        const entry = servers.get(ctx.instanceId);
        if (!entry) throw new CanvasError("canvas_not_open", "Canvas is not open");
        const plan = await refreshEntry(entry);
        return { planId: entry.planId, items: plan?.packing_items ?? [] };
      },
    },
    {
      name: "add_item",
      description: "Add an item to the selected travel plan packing checklist",
      inputSchema: {
        type: "object",
        required: ["name"],
        properties: { name: { type: "string", minLength: 1, maxLength: 120 } },
      },
      handler: async (ctx) => {
        const entry = servers.get(ctx.instanceId);
        if (!entry) throw new CanvasError("canvas_not_open", "Canvas is not open");
        const name = String(ctx.input?.name ?? "").trim();
        if (!name) throw new CanvasError("packing_item_invalid", "Item name is required");
        const plan = await refreshEntry(entry);
        if (!plan) throw new CanvasError("plan_not_found", "No travel plan found");
        plan.packing_items ??= [];
        const item = { id: randomUUID(), name, packed: false };
        plan.packing_items.push(item);
        await savePlans(entry.plans);
        return item;
      },
    },
  ],
  open: async (ctx) => {
    let entry = servers.get(ctx.instanceId);
    if (!entry) entry = await startServer(ctx.instanceId);
    if (ctx.input?.planId) {
      entry.planId = String(ctx.input.planId);
      await refreshEntry(entry);
    }
    return { title: "Trip Packing Checklist", url: entry.url };
  },
  onClose: async (ctx) => {
    const entry = servers.get(ctx.instanceId);
    if (!entry) return;
    servers.delete(ctx.instanceId);
    await new Promise((resolveClose) => entry.server.close(() => resolveClose()));
  },
});

const session = await joinSession({ canvases: { definitions: [packingCanvas] } });
if (session.workspacePath) {
  plansPaths.unshift(resolve(session.workspacePath, "data", "plans.json"));
}
