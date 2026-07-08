import "dotenv/config";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import bcrypt from "bcrypt";
import rateLimit from "express-rate-limit";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const onVercel = Boolean(process.env.VERCEL);

const app = express();
const port = 3001;
const secret = process.env.JWT_SECRET || "dev-secret";
const dataFile = path.join(__dirname, "data.json");
// Vercel's deployed source is read-only except /tmp — local uploads only ever act as a
// same-invocation staging area there, since Supabase storage is the real persistence layer.
const uploadsDir = onVercel ? path.join(os.tmpdir(), "uploads") : path.join(__dirname, "uploads");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceRoleKey ? createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } }) : null;
let usingSupabase = Boolean(supabase);

async function ensureSupabaseSchema() {
  if (!supabase) return;
  try {
    await supabase.from("app_users").select("id").limit(1);
  } catch {
    // ignore and try create tables using raw SQL through the REST API if supported by the project
  }
}

const allowedOrigins = [
  process.env.APP_URL || "http://localhost:3000",
  "https://useclientflowapp.com",
  "http://localhost:3000",
  "http://localhost:5173",
];
app.set("trust proxy", 1);
app.use(cors({ origin: [...new Set(allowedOrigins)] }));
// Stripe webhooks must see the raw request body for signature verification,
// so this route is mounted before the JSON body parser.
app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), handleStripeWebhook);
app.use(express.json());
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/auth", authLimiter);

const portalAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
});

// On Vercel a "warm" instance can serve several requests over a few minutes, and a sibling
// instance may have written changes in between — reload from Supabase periodically so reads
// don't serve stale state from whichever instance happens to handle the request.
let lastLoadedAt = Date.now();
app.use(async (req, res, next) => {
  if (onVercel && Date.now() - lastLoadedAt > 3000) {
    lastLoadedAt = Date.now();
    try { await loadData(); } catch (error) { console.error("[data] refresh failed:", error.message); }
  }
  next();
});

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".heic",
  ".csv", ".xls", ".xlsx", ".doc", ".docx", ".txt",
  ".qbo", ".ofx", ".qfx", ".zip",
]);

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (ALLOWED_UPLOAD_EXTENSIONS.has(ext)) return cb(null, true);
    cb(new Error("File type not allowed. Accepted: PDF, images, spreadsheets, Word documents, CSV, QBO/OFX, or ZIP."));
  },
});

let users = [];
let firms = [];
let clientsState = [];
let invitations = [];
let activityLog = [];
let invoices = [];

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function createPortalSlug(client) {
  const base = `${client?.name || "client"} ${client?.company || "portal"}`;
  return slugify(base) || "client-portal";
}

function ensureFirmFields(firmsList) {
  return (firmsList || []).map((firm) => ({
    id: firm.id || crypto.randomUUID(),
    name: firm.name || "My Firm",
    ownerUserId: firm.ownerUserId || null,
    plan: firm.plan || "professional",
    billingEmail: firm.billingEmail || null,
    usage: {
      aiMessages: Number(firm.usage?.aiMessages || 0),
      uploads: Number(firm.usage?.uploads || 0),
      portalUploads: Number(firm.usage?.portalUploads || 0),
      clients: Number(firm.usage?.clients || 0),
    },
    createdAt: firm.createdAt || new Date().toISOString(),
  }));
}

function ensureInvitationFields(invitesList) {
  return (invitesList || []).map((invite) => ({
    id: invite.id || crypto.randomUUID(),
    email: invite.email || "",
    firmId: invite.firmId || "firm-default",
    role: invite.role || "member",
    token: invite.token || crypto.randomUUID(),
    createdAt: invite.createdAt || new Date().toISOString(),
    expiresAt: invite.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    acceptedAt: invite.acceptedAt || null,
    acceptedByUserId: invite.acceptedByUserId || null,
  }));
}

function ensureActivityLog(entries) {
  return (entries || []).map((entry) => ({
    id: entry.id || crypto.randomUUID(),
    action: entry.action || "activity",
    detail: entry.detail || "",
    userId: entry.userId || null,
    firmId: entry.firmId || "firm-default",
    createdAt: entry.createdAt || new Date().toISOString(),
  }));
}

function ensureInvoices(entries) {
  return (entries || []).map((invoice) => ({
    id: invoice.id || crypto.randomUUID(),
    firmId: invoice.firmId || "firm-default",
    number: invoice.number || `INV-${Math.floor(Date.now() / 1000)}`,
    amount: Number(invoice.amount || 0),
    currency: invoice.currency || "USD",
    status: invoice.status || "paid",
    plan: invoice.plan || "professional",
    createdAt: invoice.createdAt || new Date().toISOString(),
    dueDate: invoice.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  }));
}

function ensurePortalFields(clients, firmId = null) {
  return (clients || []).map((client) => ({
    ...client,
    firmId: client.firmId || firmId || "firm-default",
    portalToken: client.portalToken || crypto.randomUUID(),
    portalSlug: client.portalSlug || createPortalSlug(client),
    portalEnabled: client.portalEnabled !== false,
    documents: Array.isArray(client.documents) ? client.documents : [],
    log: Array.isArray(client.log) ? client.log : [],
    messages: Array.isArray(client.messages) ? client.messages : [],
  }));
}

function findClientByPortal(identifier, token) {
  return clientsState.find((client) => {
    const portalSlug = client.portalSlug || createPortalSlug(client);
    return client.portalToken === token && client.portalEnabled !== false && (client.id === identifier || portalSlug === identifier);
  }) || null;
}

function createFirm(name, ownerUserId) {
  return {
    id: crypto.randomUUID(),
    name: name || "My Firm",
    ownerUserId,
    plan: "professional",
    billingEmail: null,
    usage: { aiMessages: 0, uploads: 0, portalUploads: 0, clients: 0 },
    createdAt: new Date().toISOString(),
  };
}

function getFirmClients(firmId) {
  return clientsState.filter((client) => client.firmId === firmId);
}

function publicFirmClients(firmId) {
  return getFirmClients(firmId).map(publicClientView);
}

function getFirmUsers(firmId) {
  return users.filter((user) => user.firmId === firmId);
}

function getFirmById(firmId) {
  return firms.find((firm) => firm.id === firmId) || firms[0] || null;
}

function getPlanLimits(plan = "professional") {
  const normalized = String(plan || "professional").toLowerCase();
  if (normalized === "starter") return { aiMessages: 100, uploads: 50, clients: 10, price: 49 };
  if (normalized === "firm") return { aiMessages: 5000, uploads: 1000, clients: 250, price: 349 };
  if (normalized === "enterprise") return { aiMessages: 1000000000, uploads: 1000000000, clients: 1000000000, price: 0 };
  return { aiMessages: 1000, uploads: 250, clients: 50, price: 149 };
}

function getBillingSummary(firmId) {
  const firm = getFirmById(firmId);
  const plan = firm?.plan || "professional";
  const limits = getPlanLimits(plan);
  const usage = firm?.usage || { aiMessages: 0, uploads: 0, portalUploads: 0, clients: 0 };
  return {
    plan,
    limits,
    usage,
    overages: {
      aiMessages: usage.aiMessages >= limits.aiMessages,
      uploads: usage.uploads >= limits.uploads,
      clients: usage.clients >= limits.clients,
    },
    invoices: invoices.filter((invoice) => invoice.firmId === firmId).slice(-6).reverse(),
  };
}

function incrementUsage(firmId, field) {
  const firm = getFirmById(firmId);
  if (!firm) return;
  if (!firm.usage) firm.usage = { aiMessages: 0, uploads: 0, portalUploads: 0, clients: 0 };
  firm.usage[field] = Number(firm.usage[field] || 0) + 1;
}

function isUsageBlocked(firmId, field) {
  const summary = getBillingSummary(firmId);
  const limit = summary.limits[field];
  return Number(summary.usage[field] || 0) >= Number(limit || 0);
}

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

async function normalizeStoredUsers(userList) {
  const normalized = [];
  for (const user of userList || []) {
    const nextUser = {
      ...user,
      firmId: user.firmId || user.firm_id || user.firmId || "firm-default",
      role: user.role || "owner",
    };
    if (typeof nextUser.password === "string" && nextUser.password.startsWith("$2")) {
      normalized.push(nextUser);
      continue;
    }
    const hash = await hashPassword(String(nextUser.password || ""));
    normalized.push({ ...nextUser, password: hash });
  }
  return normalized;
}

async function loadData() {
  // Baseline from the local file so nothing is lost when a remote table is missing
  let fileData = {};
  if (fs.existsSync(dataFile)) {
    try { fileData = JSON.parse(fs.readFileSync(dataFile, "utf8")); } catch { fileData = {}; }
  }
  users = await normalizeStoredUsers(fileData.users || []);
  firms = ensureFirmFields(fileData.firms || []);
  invitations = ensureInvitationFields(fileData.invitations || []);
  activityLog = ensureActivityLog(fileData.activityLog || []);
  invoices = ensureInvoices(fileData.invoices || []);
  clientsState = ensurePortalFields(fileData.clients || [], firms[0]?.id || "firm-default");
  usingSupabase = false;

  if (supabase) {
    try {
      const [userRes, clientRes, firmRes, inviteRes, activityRes, invoiceRes] = await Promise.all([
        supabase.from("app_users").select("*").order("created_at", { ascending: true }),
        supabase.from("app_clients").select("*").order("created_at", { ascending: true }),
        supabase.from("app_firms").select("*"),
        supabase.from("app_invitations").select("*"),
        supabase.from("app_activity").select("*"),
        supabase.from("app_invoices").select("*"),
      ]);

      if (userRes.error || clientRes.error) throw (userRes.error || clientRes.error);

      users = await normalizeStoredUsers((userRes.data || []).map((row) => ({
        ...(typeof row.data === "object" && row.data !== null ? row.data : {}),
        id: row.id,
        name: row.name ?? row.data?.name,
        email: row.email ?? row.data?.email,
        password: row.password ?? row.data?.password,
        firmId: row.data?.firmId || row.firm_id || "firm-default",
        role: row.data?.role || row.role || "owner",
      })));
      clientsState = ensurePortalFields((clientRes.data || []).map((row) => (typeof row?.data === "object" && row.data !== null ? row.data : row)));
      usingSupabase = true;

      if (!firmRes.error) {
        firms = ensureFirmFields((firmRes.data || []).map((row) => row.data || row));
      } else {
        console.warn("[db] app_firms unavailable — run supabase-migration.sql so firm/billing data survives restarts");
      }
      if (!inviteRes.error) invitations = ensureInvitationFields((inviteRes.data || []).map((row) => row.data || row));
      if (!activityRes.error) {
        activityLog = ensureActivityLog((activityRes.data || []).map((row) => row.data || row))
          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      }
      if (!invoiceRes.error) invoices = ensureInvoices((invoiceRes.data || []).map((row) => row.data || row));
    } catch (error) {
      console.warn("Supabase unavailable, using local file storage:", error.message);
    }
  }

  // Every user must belong to a firm that exists
  for (const user of users) {
    if (user.firmId && !firms.some((firm) => firm.id === user.firmId)) {
      firms.push(ensureFirmFields([{ id: user.firmId, name: `${user.name || "My"} Firm`, ownerUserId: user.id }])[0]);
    }
  }
  if (firms.length === 0) firms = [createFirm("My Firm", null)];
  clientsState = ensurePortalFields(clientsState, firms[0]?.id || "firm-default");
}

const warnedTables = new Set();

async function saveData() {
  if (supabase && usingSupabase) {
    try {
      let { error: userError } = await supabase.from("app_users").upsert(users.map((user) => ({ id: user.id, name: user.name, email: user.email, password: user.password, data: user })));
      if (userError && /data/i.test(userError.message || "")) {
        if (!warnedTables.has("app_users.data")) {
          warnedTables.add("app_users.data");
          console.warn("[db] app_users has no 'data' column — run supabase-migration.sql; sessions and verification flags won't survive restarts until then");
        }
        ({ error: userError } = await supabase.from("app_users").upsert(users.map((user) => ({ id: user.id, name: user.name, email: user.email, password: user.password }))));
      }
      const { error: clientError } = await supabase.from("app_clients").upsert(clientsState.map((client) => ({ id: client.id, data: client })));
      if (userError || clientError) throw (userError || clientError);

      const extraTables = [
        ["app_firms", firms],
        ["app_invitations", invitations],
        ["app_activity", activityLog],
        ["app_invoices", invoices],
      ];
      for (const [table, rows] of extraTables) {
        const { error } = await supabase.from(table).upsert(rows.map((row) => ({ id: row.id, data: row })));
        if (error && !warnedTables.has(table)) {
          warnedTables.add(table);
          console.warn(`[db] could not write ${table} (run supabase-migration.sql):`, error.message);
        }
      }
    } catch (error) {
      console.warn("Supabase write failed, keeping local file copy:", error.message);
    }
  }

  // Local file backup of last resort — skipped on Vercel, where the deployed source
  // directory is read-only and this write would throw on every request.
  if (!onVercel) {
    fs.writeFileSync(dataFile, JSON.stringify({ users, firms, clients: clientsState, invitations, activityLog, invoices }, null, 2));
  }
}

function addActivity(action, detail, user, firmId = null) {
  activityLog = [
    ...activityLog,
    {
      id: crypto.randomUUID(),
      action,
      detail,
      userId: user?.id || null,
      firmId: firmId || user?.firmId || "firm-default",
      createdAt: new Date().toISOString(),
    },
  ].slice(-100);
  void saveData();
}

function createToken(user) {
  return jwt.sign({ id: user.id, email: user.email, firmId: user.firmId, role: user.role || "owner" }, secret, { expiresIn: "1h" });
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, firmId: user.firmId, role: user.role || "owner", emailVerified: user.emailVerified !== false };
}

function hashRefreshToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function issueRefreshToken(user) {
  const token = crypto.randomBytes(32).toString("hex");
  const entry = {
    tokenHash: hashRefreshToken(token),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
  user.refreshTokens = [
    ...(user.refreshTokens || []).filter((t) => new Date(t.expiresAt) > new Date()).slice(-4),
    entry,
  ];
  return token;
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    const payload = jwt.verify(token, secret);
    // Client portal tokens are signed with the same secret but must never grant firm-side
    // access — requireRole defaults a missing role to "owner", so this check is load-bearing.
    if (payload.type === "client") return res.status(401).json({ error: "Invalid token" });
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

function requireRole(roles = []) {
  return (req, res, next) => {
    const role = req.user?.role || "owner";
    if (roles.length && !roles.includes(role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    next();
  };
}

function requireCronSecret(req, res, next) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return res.status(500).json({ error: "CRON_SECRET not configured" });
  if (req.headers.authorization !== `Bearer ${expected}`) return res.status(401).json({ error: "Unauthorized" });
  next();
}

function createClientToken(client) {
  return jwt.sign({ type: "client", clientId: client.id, firmId: client.firmId }, secret, { expiresIn: "30d" });
}

// Clients without portal password never expose it: this is the single choke point
// every client-facing and firm-facing response should pass through.
function publicClientView(client) {
  if (!client) return client;
  const { portalPasswordHash, ...rest } = client;
  return rest;
}

// Portal routes are reached two ways: a magic link (:identifier/:token in the URL,
// no login required) or a persistent client login (Bearer client-session token,
// no URL secret required). Both resolve to the same req.portalClient.
function resolvePortalClient(req, res, next) {
  if (req.params.identifier && req.params.token) {
    const client = findClientByPortal(req.params.identifier, req.params.token);
    if (!client) return res.status(404).json({ error: "Portal link is invalid or no longer active." });
    req.portalClient = client;
    return next();
  }
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Please sign in to your client portal." });
  let payload;
  try {
    payload = jwt.verify(token, secret);
  } catch {
    return res.status(401).json({ error: "Your session has expired. Please sign in again." });
  }
  if (payload.type !== "client") return res.status(401).json({ error: "Please sign in to your client portal." });
  const client = clientsState.find((c) => c.id === payload.clientId);
  if (!client || client.portalEnabled === false) return res.status(404).json({ error: "Portal access is no longer active." });
  req.portalClient = client;
  next();
}

async function sendEmail({ to, subject, html }) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.log(`[email] simulated send to ${to}: ${subject}`);
    return { ok: true, simulated: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "onboarding@resend.dev",
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn(`[email] resend failed for ${to}: ${text}`);
      return { ok: true, simulated: true, fallbackReason: text };
    }

    return res.json();
  } catch (error) {
    console.warn(`[email] resend error for ${to}: ${error.message}`);
    return { ok: true, simulated: true, fallbackReason: error.message };
  }
}

const STORAGE_BUCKET = "clientflow-uploads";

async function ensurePrivateStorageBucket() {
  if (!supabase) return;
  try {
    const { data: bucket, error } = await supabase.storage.getBucket(STORAGE_BUCKET);
    if (error || !bucket) {
      await supabase.storage.createBucket(STORAGE_BUCKET, { public: false });
      console.log(`[storage] created private bucket ${STORAGE_BUCKET}`);
    } else if (bucket.public) {
      await supabase.storage.updateBucket(STORAGE_BUCKET, { public: false });
      console.log(`[storage] bucket ${STORAGE_BUCKET} switched to private`);
    }
  } catch (error) {
    console.warn("[storage] could not verify bucket privacy:", error.message);
  }
}

async function uploadToSupabaseStorage(filePath, originalName, mimeType) {
  if (!supabase) return null;
  const fileBuffer = fs.readFileSync(filePath);
  const safeName = `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(safeName, fileBuffer, {
    contentType: mimeType || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;
  return { path: safeName };
}

async function createSignedDownloadUrl(storagePath) {
  if (!supabase || !storagePath) return null;
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(storagePath, 300);
  if (error) return null;
  return data?.signedUrl || null;
}

async function askLLM(system, messages) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1200,
        system,
        messages,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return (data.content || []).map((b) => b.text || "").join("\n").trim();
    }
    console.warn("[askLLM] Anthropic request failed:", res.status, await res.text().catch(() => ""));
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          ...(messages || []),
        ],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() || "";
    }
    console.warn("[askLLM] OpenAI request failed:", res.status, await res.text().catch(() => ""));
  }

  return LLM_FALLBACK_TEXT;
}

const LLM_FALLBACK_TEXT = "Clara is ready to help with client follow-ups, document status summaries, and next-step suggestions for your bookkeeping workflow.";

function fmtDate(date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function portalLink(client) {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const slug = client.portalSlug || createPortalSlug(client);
  return `${appUrl}/p/${encodeURIComponent(slug)}/${client.portalToken}`;
}

function escapeHtml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function appendClientMessage(client, from, authorName, text) {
  const entry = {
    id: crypto.randomUUID(),
    from,
    authorName,
    text: String(text).slice(0, 2000),
    at: new Date().toISOString(),
  };
  client.messages = [...(client.messages || []), entry].slice(-500);
  return entry;
}

async function draftReminder(client, outstanding, tone) {
  const docNames = outstanding.map((d) => d.name).join(", ");
  if (process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY) {
    try {
      const system = "You are Clara, an AI Client Documentation Assistant for a bookkeeping/accounting firm. Write a client reminder email that is professional, polite, and persistent — never robotic or nagging. Keep it under 120 words. Mention the outstanding documents by name. End by directing them to the secure upload link below the message. Return only the message text, no subject line.";
      const prompt = `Write a ${String(tone || "friendly").toLowerCase()} scheduled reminder to ${client.name}${client.company ? ` at ${client.company}` : ""}. Outstanding documents: ${docNames}.`;
      const text = await askLLM(system, [{ role: "user", content: prompt }]);
      if (text && text !== LLM_FALLBACK_TEXT) return text;
    } catch {
      // fall through to the template
    }
  }
  const firm = getFirmById(client.firmId);
  const first = (client.name || "").split(" ")[0] || "there";
  return [
    `Hi ${first},`,
    "",
    `Just a friendly reminder that we're still waiting on the following ${outstanding.length === 1 ? "item" : "items"} for your file:`,
    "",
    ...outstanding.map((d) => `• ${d.name}`),
    "",
    "You can upload everything securely using the link below. Thank you!",
    "",
    `— ${firm?.name || "Your bookkeeping team"}`,
  ].join("\n");
}

async function classifyUpload(client, doc, originalName) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) return;
  const otherNames = (client.documents || [])
    .filter((d) => d.id !== doc.id)
    .map((d) => d.name)
    .filter(Boolean);
  if (otherNames.length === 0) return;

  const system = "You are Clara, a document classification assistant for a bookkeeping/accounting firm. Given an uploaded file name and a client's document checklist, decide whether the file was likely dropped in the wrong checklist slot. Reply with the single word \"Match\" if the file name doesn't clearly match a different item, or with the exact text of the one checklist item from the list it looks like it actually belongs to. Reply with nothing else.";
  const prompt = `File name: "${originalName}". Uploaded for checklist item: "${doc.name}". Other checklist items for this client: ${otherNames.join(", ")}.`;
  let reply;
  try {
    reply = (await askLLM(system, [{ role: "user", content: prompt }])).trim();
  } catch {
    return;
  }
  if (!reply || reply === LLM_FALLBACK_TEXT || /^match$/i.test(reply)) return;

  const suggested = otherNames.find((name) => name.toLowerCase() === reply.toLowerCase());
  if (!suggested) return;

  doc.aiClassificationFlag = { suggested, at: new Date().toISOString() };
  client.log = [
    ...(client.log || []),
    { date: fmtDate(new Date()), type: "Clara", note: `Clara flagged "${originalName}" — uploaded for "${doc.name}" but looks like it might be "${suggested}".` },
  ];
}

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function periodLabel(cadence, date) {
  if (cadence === "quarterly") return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

async function runRecurringChecklistSweep() {
  const summary = { regenerated: 0 };
  try {
    const now = new Date();
    let changed = false;
    for (const client of clientsState) {
      const recurring = client.recurring;
      if (!recurring?.enabled || !recurring.items?.length) continue;
      if (!recurring.nextRunAt || new Date(recurring.nextRunAt) > now) continue;

      const period = periodLabel(recurring.cadence, now);
      const dueDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const newDocs = recurring.items.map((it) => ({
        id: crypto.randomUUID(),
        name: it.name,
        category: recurring.title,
        status: "Requested",
        note: recurring.notes || "",
        dueDate,
        uploadedAt: null,
      }));
      client.documents = [...(client.documents || []), ...newDocs];
      client.log = [
        ...(client.log || []),
        { date: fmtDate(now), type: "Recurring request", note: `Clara auto-regenerated "${recurring.title}" for ${period} (${newDocs.length} item${newDocs.length === 1 ? "" : "s"}).` },
      ];
      client.nextFollowUp = fmtDate(new Date(dueDate));
      recurring.lastRunAt = now.toISOString();
      recurring.nextRunAt = addMonths(now, recurring.cadence === "quarterly" ? 3 : 1).toISOString();
      addActivity("recurring_checklist", `Clara auto-regenerated "${recurring.title}" for ${client.name} (${period})`, null, client.firmId);
      changed = true;
      summary.regenerated += 1;
    }
    if (changed) await saveData();
  } catch (error) {
    console.error("[recurring] sweep failed:", error.message);
  }
  return summary;
}

async function runReminderSweep() {
  const summary = { sent: 0, overdueMarked: 0 };
  try {
    const now = new Date();
    let changed = false;
    for (const client of clientsState) {
      for (const doc of client.documents || []) {
        // one-day grace after the due date before stamping Overdue
        if (doc.status === "Requested" && doc.dueDate && new Date(doc.dueDate).getTime() < now.getTime() - 24 * 60 * 60 * 1000) {
          doc.status = "Overdue";
          summary.overdueMarked += 1;
          changed = true;
        }
      }

      const reminders = client.reminders;
      if (!reminders?.enabled || client.portalEnabled === false) continue;
      const outstanding = (client.documents || []).filter((d) => ["Requested", "Overdue", "Rejected"].includes(d.status));
      if (outstanding.length === 0) {
        if (reminders.nextSendAt) { reminders.nextSendAt = null; changed = true; }
        continue;
      }
      if (reminders.nextSendAt && new Date(reminders.nextSendAt) > now) continue;
      if ((reminders.sentCount || 0) >= 6) continue; // stop chasing after 6 unanswered reminders
      if (isUsageBlocked(client.firmId, "aiMessages")) continue;

      const message = await draftReminder(client, outstanding, reminders.tone);
      const firm = getFirmById(client.firmId);
      await sendEmail({
        to: client.email,
        subject: `Reminder: documents needed${firm?.name ? ` — ${firm.name}` : ""}`,
        html: `<p>${message.replace(/\n/g, "<br/>")}</p><p><a href="${portalLink(client)}">Upload your documents securely</a></p>`,
      });
      incrementUsage(client.firmId, "aiMessages");
      const today = fmtDate(now);
      client.log = [...(client.log || []), { date: today, type: "Auto-reminder", note: `Clara sent a scheduled ${String(reminders.tone || "friendly").toLowerCase()} reminder (${outstanding.length} outstanding).` }];
      client.lastContacted = today;
      reminders.lastSentAt = now.toISOString();
      reminders.sentCount = (reminders.sentCount || 0) + 1;
      reminders.nextSendAt = new Date(now.getTime() + (Number(reminders.cadenceDays) || 7) * 24 * 60 * 60 * 1000).toISOString();
      client.nextFollowUp = fmtDate(new Date(reminders.nextSendAt));
      addActivity("auto_reminder", `Clara emailed ${client.name} a scheduled reminder`, null, client.firmId);
      summary.sent += 1;
      changed = true;
    }
    if (changed) await saveData();
  } catch (error) {
    console.error("[reminders] sweep failed:", error.message);
  }
  return summary;
}

await ensureSupabaseSchema();
await ensurePrivateStorageBucket();
await loadData();

// Serverless instances don't stay alive between requests, so in-process timers here would be
// unreliable at best. On Vercel, Vercel Cron hits /api/reminders/run and /api/recurring/run
// instead (see vercel.json); locally (`node server.js`), keep the original in-process sweeps.
if (!onVercel) {
  // Clara's automated chase: check every 15 minutes, first pass 1 minute after boot
  setInterval(runReminderSweep, 15 * 60 * 1000);
  setTimeout(runReminderSweep, 60 * 1000);

  // Recurring checklist regeneration for retainer clients: same cadence, offset from the reminder sweep
  setInterval(runRecurringChecklistSweep, 15 * 60 * 1000);
  setTimeout(runRecurringChecklistSweep, 90 * 1000);
}

app.post("/api/auth/signup", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required." });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters long." });
  }

  const exists = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (exists) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  const pendingInvite = invitations.find((invite) => invite.email.toLowerCase() === email.toLowerCase() && !invite.acceptedAt);
  let firm = firms.find((item) => item.id === pendingInvite?.firmId) || null;
  if (!firm) {
    firm = createFirm(name, null);
    firms.push(firm);
  }
  const hashedPassword = await hashPassword(password);
  const user = {
    id: crypto.randomUUID(),
    name,
    email,
    password: hashedPassword,
    firmId: firm.id,
    role: pendingInvite?.role || "owner",
    emailVerified: false,
    emailVerificationToken: crypto.randomUUID(),
  };
  users.push(user);
  if (pendingInvite) {
    pendingInvite.acceptedAt = new Date().toISOString();
    pendingInvite.acceptedByUserId = user.id;
  }
  const token = createToken(user);
  const refreshToken = issueRefreshToken(user);
  await saveData();
  const verifyLink = `${process.env.APP_URL || "http://localhost:3000"}/verify-email?token=${encodeURIComponent(user.emailVerificationToken)}`;
  const emailResult = await sendEmail({
    to: user.email,
    subject: "Verify your ClientFlow email",
    html: `<p>Hi ${user.name},</p><p>Welcome to ClientFlow. Confirm your email address to secure your account:</p><p><a href="${verifyLink}">${verifyLink}</a></p>`,
  });
  const team = getFirmUsers(user.firmId).map((member) => ({ id: member.id, name: member.name, email: member.email, role: member.role || "owner" }));
  addActivity("signup", `${user.name} created a new firm account`, user, user.firmId);
  const response = { token, refreshToken, user: publicUser(user), clients: publicFirmClients(user.firmId), team, invitations: invitations.filter((invite) => invite.firmId === user.firmId), activityLog: activityLog.filter((entry) => entry.firmId === user.firmId), billingSummary: getBillingSummary(user.firmId) };
  if (emailResult?.simulated && process.env.NODE_ENV !== "production") response.verifyLink = verifyLink;
  res.json(response);
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  const user = users.find((u) => u.email.toLowerCase() === (email || "").toLowerCase());
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password." });
  }
  const valid = await verifyPassword(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password." });
  }
  const token = createToken(user);
  const refreshToken = issueRefreshToken(user);
  await saveData();
  const team = getFirmUsers(user.firmId).map((member) => ({ id: member.id, name: member.name, email: member.email, role: member.role || "owner" }));
  addActivity("login", `${user.name} signed in`, user, user.firmId);
  res.json({ token, refreshToken, user: publicUser(user), clients: publicFirmClients(user.firmId), team, invitations: invitations.filter((invite) => invite.firmId === user.firmId), activityLog: activityLog.filter((entry) => entry.firmId === user.firmId), billingSummary: getBillingSummary(user.firmId) });
});

app.post("/api/auth/refresh", async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ error: "Refresh token is required." });
  const tokenHash = hashRefreshToken(String(refreshToken));
  const user = users.find((u) => (u.refreshTokens || []).some((t) => t.tokenHash === tokenHash && new Date(t.expiresAt) > new Date()));
  if (!user) return res.status(401).json({ error: "Session expired. Please sign in again." });
  user.refreshTokens = (user.refreshTokens || []).filter((t) => t.tokenHash !== tokenHash);
  const nextRefreshToken = issueRefreshToken(user);
  await saveData();
  res.json({ token: createToken(user), refreshToken: nextRefreshToken, user: publicUser(user) });
});

app.post("/api/auth/verify-email", async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: "Verification token is required." });
  const user = users.find((u) => u.emailVerificationToken === token);
  if (!user) return res.status(400).json({ error: "That verification link is invalid or has already been used." });
  user.emailVerified = true;
  delete user.emailVerificationToken;
  await saveData();
  addActivity("email_verified", `${user.name} verified their email address`, user, user.firmId);
  res.json({ ok: true, message: "Email verified. You're all set." });
});

app.post("/api/auth/resend-verification", requireAuth, async (req, res) => {
  const user = users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.emailVerified !== false) return res.json({ ok: true, message: "Email is already verified." });
  user.emailVerificationToken = crypto.randomUUID();
  await saveData();
  const verifyLink = `${process.env.APP_URL || "http://localhost:3000"}/verify-email?token=${encodeURIComponent(user.emailVerificationToken)}`;
  const result = await sendEmail({
    to: user.email,
    subject: "Verify your ClientFlow email",
    html: `<p>Hi ${user.name},</p><p>Confirm your email address to secure your account:</p><p><a href="${verifyLink}">${verifyLink}</a></p>`,
  });
  const response = { ok: true, message: "Verification email sent." };
  if (result?.simulated && process.env.NODE_ENV !== "production") response.verifyLink = verifyLink;
  res.json(response);
});

app.get("/api/me", requireAuth, async (req, res) => {
  const user = users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const firm = firms.find((item) => item.id === user.firmId) || null;
  const team = getFirmUsers(user.firmId).map((member) => ({ id: member.id, name: member.name, email: member.email, role: member.role || "owner" }));
  res.json({ user: publicUser(user), firm, clients: publicFirmClients(user.firmId), team, invitations: invitations.filter((invite) => invite.firmId === user.firmId), activityLog: activityLog.filter((entry) => entry.firmId === user.firmId), billingSummary: getBillingSummary(user.firmId) });
});

app.post("/api/auth/forgot-password", async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "Email is required." });
  const user = users.find((item) => item.email.toLowerCase() === String(email).toLowerCase());
  if (!user) {
    return res.json({ ok: true, message: "If that account exists, a reset link has been prepared." });
  }
  const token = crypto.randomUUID();
  user.passwordResetToken = token;
  user.passwordResetExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  await saveData();
  const resetLink = `${process.env.APP_URL || "http://localhost:3000"}/reset-password?token=${encodeURIComponent(token)}`;
  const emailResult = await sendEmail({
    to: user.email,
    subject: "Reset your ClientFlow password",
    html: `<p>Hello ${user.name || "there"},</p><p>Use the link below to reset your password.</p><p><a href="${resetLink}">${resetLink}</a></p>`,
  });
  const response = { ok: true, message: "If that account exists, a reset link has been prepared." };
  if (emailResult?.simulated) {
    console.log(`[dev] password reset link for ${user.email}: ${resetLink}`);
    if (process.env.NODE_ENV !== "production") response.resetLink = resetLink;
  }
  res.json(response);
});

app.post("/api/auth/reset-password", async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: "Token and password are required." });
  if (String(password).length < 8) return res.status(400).json({ error: "Password must be at least 8 characters long." });
  const user = users.find((item) => item.passwordResetToken === token && new Date(item.passwordResetExpiresAt || 0) > new Date());
  if (!user) return res.status(400).json({ error: "That reset link is invalid or has expired." });
  user.password = await hashPassword(password);
  delete user.passwordResetToken;
  delete user.passwordResetExpiresAt;
  await saveData();
  res.json({ ok: true, message: "Password updated successfully." });
});

app.get("/api/invites", requireAuth, requireRole(["owner", "admin"]), async (req, res) => {
  res.json({ invites: invitations.filter((invite) => invite.firmId === req.user.firmId) });
});

app.post("/api/invites", requireAuth, requireRole(["owner", "admin"]), async (req, res) => {
  const { email, role = "member" } = req.body || {};
  if (!email) return res.status(400).json({ error: "Email is required." });
  if (!["admin", "member"].includes(role)) return res.status(400).json({ error: "Role must be admin or member." });
  const invite = {
    id: crypto.randomUUID(),
    email: String(email).toLowerCase(),
    firmId: req.user.firmId,
    role,
    token: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    acceptedAt: null,
    acceptedByUserId: null,
  };
  invitations = ensureInvitationFields([...invitations.filter((item) => item.email.toLowerCase() !== invite.email || item.firmId !== invite.firmId), invite]);
  addActivity("invited", `${req.user.email} invited ${invite.email} as ${invite.role}`, users.find((item) => item.id === req.user.id), req.user.firmId);
  await saveData();
  await sendEmail({
    to: invite.email,
    subject: "You’ve been invited to ClientFlow",
    html: `<p>You’ve been invited to join your firm’s ClientFlow workspace.</p><p>Accept the invite by signing up at <a href="${process.env.APP_URL || "http://localhost:3000"}">${process.env.APP_URL || "http://localhost:3000"}</a>.</p>`,
  });
  res.json({ ok: true, invite });
});

app.post("/api/auth/logout", requireAuth, async (req, res) => {
  const { refreshToken } = req.body || {};
  const user = users.find((u) => u.id === req.user.id);
  if (user && refreshToken) {
    const tokenHash = hashRefreshToken(String(refreshToken));
    user.refreshTokens = (user.refreshTokens || []).filter((t) => t.tokenHash !== tokenHash);
    await saveData();
  }
  res.json({ ok: true });
});

app.get("/api/billing/summary", requireAuth, async (req, res) => {
  res.json({ billingSummary: getBillingSummary(req.user.firmId) });
});

function getStripePriceId(plan) {
  const normalized = String(plan || "professional").toLowerCase();
  if (normalized === "starter") return process.env.STRIPE_PRICE_STARTER || process.env.STRIPE_PRICE_ID;
  if (normalized === "firm") return process.env.STRIPE_PRICE_FIRM || process.env.STRIPE_PRICE_ID;
  return process.env.STRIPE_PRICE_PROFESSIONAL || process.env.STRIPE_PRICE_ID;
}

function verifyStripeSignature(payload, signatureHeader, secret) {
  if (!signatureHeader) return false;
  const parts = {};
  for (const piece of signatureHeader.split(",")) {
    const [k, v] = piece.split("=");
    if (k && v) parts[k.trim()] = v.trim();
  }
  const timestamp = Number(parts.t);
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${parts.t}.${payload}`).digest("hex");
  const provided = parts.v1 || "";
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

async function handleStripeWebhook(req, res) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return res.status(503).json({ error: "Stripe webhook not configured" });
  const payload = req.body.toString("utf8");
  if (!verifyStripeSignature(payload, req.headers["stripe-signature"], webhookSecret)) {
    return res.status(400).json({ error: "Invalid signature" });
  }

  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    return res.status(400).json({ error: "Invalid payload" });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data?.object || {};
    const firmId = session.metadata?.firmId || session.client_reference_id;
    const plan = session.metadata?.plan || "professional";
    const invoiceId = session.metadata?.invoiceId;
    const firm = firms.find((item) => item.id === firmId);
    if (firm) {
      firm.plan = plan;
      invoices = invoices.map((inv) => inv.id === invoiceId ? { ...inv, status: "paid" } : inv);
      addActivity("billing_paid", `Subscription payment confirmed for the ${plan} plan`, null, firm.id);
      await saveData();
    }
  } else if (event.type === "customer.subscription.deleted" || event.type === "invoice.payment_failed") {
    const object = event.data?.object || {};
    const firmId = object.metadata?.firmId;
    const firm = firms.find((item) => item.id === firmId);
    if (firm) {
      firm.plan = "starter";
      addActivity("billing_downgraded", event.type === "invoice.payment_failed" ? "Payment failed — plan downgraded to starter" : "Subscription cancelled — plan downgraded to starter", null, firm.id);
      await saveData();
    }
  }

  res.json({ received: true });
}

app.post("/api/billing/checkout", requireAuth, async (req, res) => {
  const { plan = "professional" } = req.body || {};
  if (String(plan).toLowerCase() === "enterprise") {
    return res.status(400).json({ error: "Enterprise plans are custom-quoted — contact us and we'll get you set up." });
  }
  const firm = getFirmById(req.user.firmId);
  if (!firm) return res.status(404).json({ error: "Firm not found" });
  const invoice = {
    id: crypto.randomUUID(),
    firmId: firm.id,
    number: `INV-${Date.now()}`,
    amount: getPlanLimits(plan).price,
    currency: "USD",
    status: "pending",
    plan,
    createdAt: new Date().toISOString(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
  invoices = ensureInvoices([invoice, ...invoices]);
  addActivity("billing_checkout", `${req.user.email} started a ${plan} checkout`, users.find((item) => item.id === req.user.id), req.user.firmId);
  await saveData();
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const stripePriceId = getStripePriceId(plan);
  if (stripeSecretKey && stripePriceId) {
    try {
      const params = new URLSearchParams({
        mode: "subscription",
        success_url: `${process.env.APP_URL || "http://localhost:3000"}/pricing?checkout=success`,
        cancel_url: `${process.env.APP_URL || "http://localhost:3000"}/pricing?checkout=cancelled`,
        "line_items[0][price]": stripePriceId,
        "line_items[0][quantity]": "1",
        customer_email: req.user.email,
        client_reference_id: firm.id,
        "metadata[firmId]": firm.id,
        "metadata[plan]": plan,
        "metadata[invoiceId]": invoice.id,
        "subscription_data[metadata][firmId]": firm.id,
      });
      const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
      const stripeData = await stripeRes.json();
      if (stripeData?.url) {
        return res.json({ ok: true, checkoutUrl: stripeData.url, invoice });
      }
      console.warn("Stripe checkout session error:", stripeData?.error?.message || "no URL returned");
    } catch (error) {
      console.warn("Stripe checkout failed, using demo fallback:", error.message);
    }
  }
  // Demo mode — no Stripe configured, apply the plan immediately so the flow is testable
  firm.plan = plan;
  invoices = invoices.map((inv) => inv.id === invoice.id ? { ...inv, status: "paid" } : inv);
  await saveData();
  res.json({ ok: true, checkoutUrl: `${process.env.APP_URL || "http://localhost:3000"}/pricing?demoCheckout=1`, invoice, billingSummary: getBillingSummary(firm.id) });
});

app.post("/api/clients", requireAuth, requireRole(["owner", "admin"]), async (req, res) => {
  const firmId = req.user.firmId || "firm-default";
  const input = req.body?.client || {};
  const name = String(input.name || "").trim();
  const email = String(input.email || "").trim();
  if (!name || !email) return res.status(400).json({ error: "Client name and email are required." });
  if (isUsageBlocked(firmId, "clients")) {
    return res.status(429).json({ error: "Your plan's client limit has been reached. Upgrade to add more clients." });
  }
  const client = ensurePortalFields([{
    id: crypto.randomUUID(),
    name,
    email,
    company: String(input.company || "").trim(),
    phone: String(input.phone || "").trim(),
    status: "Not requested",
    lastContacted: "—",
    nextFollowUp: input.nextFollowUp || "—",
    notes: String(input.notes || ""),
    documents: [],
    log: [],
  }], firmId)[0];
  clientsState.push(client);
  incrementUsage(firmId, "clients");
  addActivity("client_added", `${req.user.email} added client ${client.name}`, users.find((item) => item.id === req.user.id), firmId);
  await saveData();
  const firm = getFirmById(firmId);
  const emailResult = await sendEmail({
    to: client.email,
    subject: `You've been added to ${firm?.name || "your accounting firm"}'s ClientFlow portal`,
    html: `<p>Hi ${client.name},</p><p>${firm?.name || "Your accounting firm"} has set up a secure portal for you to share documents and messages.</p><p><a href="${portalLink(client)}">Open your secure portal</a></p>`,
  });
  client.log = [...(client.log || []), { date: fmtDate(new Date()), type: "Email", note: "Welcome email with portal link sent to client." }];
  await saveData();
  res.json({ ok: true, client: publicClientView(client), clients: publicFirmClients(firmId), emailSimulated: Boolean(emailResult?.simulated) });
});

app.put("/api/clients/:id", requireAuth, requireRole(["owner", "admin"]), async (req, res) => {
  const firmId = req.user.firmId || "firm-default";
  const existing = clientsState.find((client) => client.id === req.params.id);
  if (!existing || existing.firmId !== firmId) return res.status(404).json({ error: "Client not found" });
  const input = req.body?.client || {};
  const merged = ensurePortalFields([{
    ...existing,
    ...input,
    id: existing.id,
    firmId: existing.firmId,
    portalToken: existing.portalToken,
    portalPasswordHash: existing.portalPasswordHash,
  }], firmId)[0];
  clientsState = clientsState.map((client) => client.id === existing.id ? merged : client);
  await saveData();
  res.json({ ok: true, client: publicClientView(merged) });
});

app.post("/api/clients/:id/send-followup", requireAuth, requireRole(["owner", "admin"]), async (req, res) => {
  const firmId = req.user.firmId || "firm-default";
  const client = clientsState.find((item) => item.id === req.params.id);
  if (!client || client.firmId !== firmId) return res.status(404).json({ error: "Client not found" });
  const message = String(req.body?.message || "").trim();
  if (!message) return res.status(400).json({ error: "Message is required." });
  const firm = getFirmById(firmId);
  await sendEmail({
    to: client.email,
    subject: `Documents needed${firm?.name ? ` — ${firm.name}` : ""}`,
    html: `<p>${message.replace(/\n/g, "<br/>")}</p><p><a href="${portalLink(client)}">Upload your documents securely</a></p>`,
  });
  const today = fmtDate(new Date());
  client.log = [...(client.log || []), { date: today, type: "Email", note: `Follow-up sent: ${message.slice(0, 120)}${message.length > 120 ? "…" : ""}` }];
  client.lastContacted = today;
  if (client.reminders) {
    client.reminders.sentCount = 0; // manual outreach resets the auto-chase cap
    if (client.reminders.enabled) {
      client.reminders.nextSendAt = new Date(Date.now() + (Number(client.reminders.cadenceDays) || 7) * 24 * 60 * 60 * 1000).toISOString();
      client.nextFollowUp = fmtDate(new Date(client.reminders.nextSendAt));
    }
  }
  addActivity("followup_sent", `${req.user.email} emailed ${client.name} a follow-up`, users.find((item) => item.id === req.user.id), firmId);
  await saveData();
  res.json({ ok: true, client });
});

app.get("/api/clients/:id/messages", requireAuth, async (req, res) => {
  const client = clientsState.find((item) => item.id === req.params.id);
  if (!client || client.firmId !== req.user.firmId) return res.status(404).json({ error: "Client not found" });
  res.json({ messages: client.messages || [] });
});

app.post("/api/clients/:id/messages", requireAuth, async (req, res) => {
  const client = clientsState.find((item) => item.id === req.params.id);
  if (!client || client.firmId !== req.user.firmId) return res.status(404).json({ error: "Client not found" });
  const text = String(req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "Message text is required." });
  const user = users.find((item) => item.id === req.user.id);
  appendClientMessage(client, "firm", user?.name || "Your accounting team", text);
  addActivity("chat_message", `${user?.name || req.user.email} messaged ${client.name}`, user, req.user.firmId);
  await saveData();
  // Best-effort: let the client know there's a new message waiting in their portal
  void sendEmail({
    to: client.email,
    subject: `New message from ${getFirmById(req.user.firmId)?.name || "your accounting team"}`,
    html: `<p>You have a new message:</p><blockquote>${escapeHtml(text)}</blockquote><p><a href="${portalLink(client)}">Read and reply in your secure portal</a></p>`,
  });
  res.json({ ok: true, messages: client.messages });
});

async function portalMessageHandler(req, res) {
  try {
    const target = req.portalClient;
    const text = String(req.body?.text || "").trim();
    if (!text) return res.status(400).json({ error: "Message text is required." });
    appendClientMessage(target, "client", target.name, text);
    addActivity("portal_message", `${target.name} sent a message from the client portal`, null, target.firmId);
    await saveData();
    res.json({ ok: true, messages: target.messages });
  } catch (error) {
    res.status(500).json({ error: error.message || "Message failed" });
  }
}
app.post(["/api/portal/:identifier/:token/message", "/api/p/:identifier/:token/message"], resolvePortalClient, portalMessageHandler);
app.post("/api/portal/session/message", resolvePortalClient, portalMessageHandler);

// Vercel Cron always sends GET; keep POST too so it's easy to trigger manually with the secret.
app.all("/api/reminders/run", requireCronSecret, async (req, res) => {
  const summary = await runReminderSweep();
  res.json({ ok: true, ...summary });
});

app.all("/api/recurring/run", requireCronSecret, async (req, res) => {
  const summary = await runRecurringChecklistSweep();
  res.json({ ok: true, ...summary });
});

app.post("/api/clients/bulk-remind", requireAuth, requireRole(["owner", "admin"]), async (req, res) => {
  const firmId = req.user.firmId || "firm-default";
  const requestedIds = Array.isArray(req.body?.clientIds) ? new Set(req.body.clientIds) : null;
  const targets = getFirmClients(firmId).filter((client) => {
    if (requestedIds && !requestedIds.has(client.id)) return false;
    return (client.documents || []).some((d) => d.status === "Overdue");
  });

  const firm = getFirmById(firmId);
  const user = users.find((item) => item.id === req.user.id);
  const now = new Date();
  let sent = 0;

  for (const client of targets) {
    if (isUsageBlocked(firmId, "aiMessages")) break;
    const outstanding = (client.documents || []).filter((d) => ["Requested", "Overdue", "Rejected"].includes(d.status));
    if (outstanding.length === 0) continue;
    const message = await draftReminder(client, outstanding, client.reminders?.tone || "Friendly");
    await sendEmail({
      to: client.email,
      subject: `Reminder: documents needed${firm?.name ? ` — ${firm.name}` : ""}`,
      html: `<p>${message.replace(/\n/g, "<br/>")}</p><p><a href="${portalLink(client)}">Upload your documents securely</a></p>`,
    });
    incrementUsage(firmId, "aiMessages");
    const today = fmtDate(now);
    client.log = [...(client.log || []), { date: today, type: "Email", note: `Bulk reminder sent by ${user?.name || req.user.email} (${outstanding.length} outstanding).` }];
    client.lastContacted = today;
    if (client.reminders) {
      client.reminders.sentCount = 0;
      if (client.reminders.enabled) {
        client.reminders.nextSendAt = new Date(now.getTime() + (Number(client.reminders.cadenceDays) || 7) * 24 * 60 * 60 * 1000).toISOString();
        client.nextFollowUp = fmtDate(new Date(client.reminders.nextSendAt));
      }
    }
    addActivity("followup_sent", `${user?.name || req.user.email} sent a bulk reminder to ${client.name}`, user, firmId);
    sent += 1;
  }

  if (sent > 0) await saveData();
  res.json({ ok: true, sent, clients: publicFirmClients(firmId) });
});

app.delete("/api/clients/:id", requireAuth, requireRole(["owner", "admin"]), async (req, res) => {
  const firmId = req.user.firmId || "firm-default";
  const existing = clientsState.find((client) => client.id === req.params.id);
  if (!existing || existing.firmId !== firmId) return res.status(404).json({ error: "Client not found" });
  clientsState = clientsState.filter((client) => client.id !== existing.id);
  if (supabase && usingSupabase) {
    try { await supabase.from("app_clients").delete().eq("id", existing.id); } catch (error) { console.warn("[db] client row delete failed:", error.message); }
  }
  const firm = getFirmById(firmId);
  if (firm?.usage) firm.usage.clients = Math.max(0, Number(firm.usage.clients || 0) - 1);
  addActivity("client_removed", `${req.user.email} removed client ${existing.name}`, users.find((item) => item.id === req.user.id), firmId);
  await saveData();
  res.json({ ok: true, clients: publicFirmClients(firmId) });
});

async function portalMeHandler(req, res) {
  res.json({ ok: true, client: publicClientView(req.portalClient) });
}
// Registered before the :identifier/:token wildcard below — Express matches routes in
// registration order, and "/api/portal/session/me" would otherwise be swallowed by the
// wildcard as identifier="session", token="me".
app.get("/api/portal/session/me", resolvePortalClient, portalMeHandler);
app.get(["/api/portal/:identifier/:token", "/api/portal/:identifier/:token/", "/api/p/:identifier/:token", "/api/p/:identifier/:token/"], resolvePortalClient, portalMeHandler);

// Persistent client login: set once from inside a magic-link session, then reused across visits
// without needing the emailed link again — useful for retainer clients with recurring requests.
app.post(["/api/portal/:identifier/:token/set-password", "/api/p/:identifier/:token/set-password"], portalAuthLimiter, resolvePortalClient, async (req, res) => {
  const password = String(req.body?.password || "");
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters long." });
  const target = req.portalClient;
  target.portalPasswordHash = await hashPassword(password);
  addActivity("portal_password_set", `${target.name} set up a persistent portal login`, null, target.firmId);
  await saveData();
  res.json({ ok: true, token: createClientToken(target), client: publicClientView(target) });
});
app.post("/api/portal/session/set-password", portalAuthLimiter, resolvePortalClient, async (req, res) => {
  const password = String(req.body?.password || "");
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters long." });
  const target = req.portalClient;
  target.portalPasswordHash = await hashPassword(password);
  addActivity("portal_password_set", `${target.name} updated their portal login password`, null, target.firmId);
  await saveData();
  res.json({ ok: true, client: publicClientView(target) });
});

app.post("/api/portal/login", portalAuthLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const client = clientsState.find((c) => c.portalPasswordHash && c.portalEnabled !== false && (c.email || "").toLowerCase() === normalizedEmail);
  if (!client) return res.status(401).json({ error: "Invalid email or password." });
  const valid = await verifyPassword(password, client.portalPasswordHash);
  if (!valid) return res.status(401).json({ error: "Invalid email or password." });
  addActivity("portal_login", `${client.name} signed in to the client portal`, null, client.firmId);
  res.json({ ok: true, token: createClientToken(client), client: publicClientView(client) });
});

async function portalUploadHandler(req, res) {
  try {
    const target = req.portalClient;
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const ext = path.extname(req.file.originalname || "");
    const finalPath = path.join(uploadsDir, `${req.file.filename}${ext}`);
    fs.renameSync(req.file.path, finalPath);

    const fileKey = path.basename(finalPath);
    const uploadedUrl = `/api/files/${fileKey}`;
    let storagePath = null;
    if (supabase) {
      try {
        const storageResult = await uploadToSupabaseStorage(finalPath, req.file.originalname, req.file.mimetype);
        storagePath = storageResult?.path || null;
      } catch (storageError) {
        console.warn("Supabase storage upload failed, using local fallback:", storageError.message);
      }
    }

    const docId = req.body.docId;
    target.documents = (target.documents || []).map((doc) => {
      if (doc.id !== docId) return doc;
      const previousVersion = doc.uploadedFile ? {
        uploadedAt: doc.uploadedAt,
        uploadedFile: doc.uploadedFile,
        uploadedUrl: doc.uploadedUrl,
        uploadedFileKey: doc.uploadedFileKey,
        uploadedStoragePath: doc.uploadedStoragePath || null,
        uploadedMimeType: doc.uploadedMimeType || null,
      } : null;
      return {
        ...doc,
        status: "Received",
        uploadedAt: new Date().toISOString(),
        uploadedFile: req.file.originalname,
        uploadedUrl,
        uploadedFileKey: fileKey,
        uploadedStoragePath: storagePath,
        uploadedMimeType: req.file.mimetype || null,
        aiClassificationFlag: null,
        versions: previousVersion ? [...(doc.versions || []), previousVersion] : (doc.versions || []),
      };
    });
    target.log = [
      ...(target.log || []),
      { date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), type: "Portal upload", note: `Uploaded ${req.file.originalname}` },
    ];
    addActivity("portal_upload", `${target.name} uploaded ${req.file.originalname}`, null, target.firmId);
    const uploadedDoc = target.documents.find((doc) => doc.id === docId);
    if (uploadedDoc) {
      try { await classifyUpload(target, uploadedDoc, req.file.originalname); } catch { /* best-effort only */ }
    }
    await saveData();

    res.json({ ok: true, fileName: req.file.originalname, url: uploadedUrl, fileKey, storagePath, mimeType: req.file.mimetype });
  } catch (error) {
    res.status(500).json({ error: error.message || "Upload failed" });
  }
}
app.post(
  ["/api/portal/:identifier/:token/upload", "/api/portal/:identifier/:token/upload/", "/api/p/:identifier/:token/upload", "/api/p/:identifier/:token/upload/"],
  resolvePortalClient, upload.single("file"), portalUploadHandler
);
app.post("/api/portal/session/upload", resolvePortalClient, upload.single("file"), portalUploadHandler);

async function portalCommentHandler(req, res) {
  try {
    const target = req.portalClient;
    const note = (req.body?.comment || "").trim();
    if (!note) return res.status(400).json({ error: "Comment is required" });

    target.log = [
      ...(target.log || []),
      { date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), type: "Portal", note: `Client comment: ${note}` },
    ];

    incrementUsage(target.firmId, "portalUploads");
    addActivity("portal_comment", `${target.name} left a comment in the client portal`, null, target.firmId);
    await saveData();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message || "Comment failed" });
  }
}
app.post(["/api/portal/:identifier/:token/comment", "/api/portal/:identifier/:token/comment/", "/api/p/:identifier/:token/comment", "/api/p/:identifier/:token/comment/"], resolvePortalClient, portalCommentHandler);
app.post("/api/portal/session/comment", resolvePortalClient, portalCommentHandler);

async function portalDocStatusHandler(req, res) {
  try {
    const target = req.portalClient;
    const { docId, status } = req.body || {};
    if (status !== "Not applicable") return res.status(400).json({ error: "Only 'Not applicable' can be set from the portal." });
    const doc = (target.documents || []).find((d) => d.id === docId);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    target.documents = target.documents.map((d) => d.id === docId ? { ...d, status } : d);
    target.log = [
      ...(target.log || []),
      { date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), type: "Portal", note: `Client marked "${doc.name}" as not applicable.` },
    ];
    addActivity("portal_doc_status", `${target.name} marked "${doc.name}" as not applicable`, null, target.firmId);
    await saveData();
    res.json({ ok: true, client: publicClientView(target) });
  } catch (error) {
    res.status(500).json({ error: error.message || "Update failed" });
  }
}
app.post(["/api/portal/:identifier/:token/doc-status", "/api/p/:identifier/:token/doc-status"], resolvePortalClient, portalDocStatusHandler);
app.post("/api/portal/session/doc-status", resolvePortalClient, portalDocStatusHandler);

app.post("/api/assistant", requireAuth, async (req, res) => {
  try {
    const { system, messages } = req.body || {};
    const firmClients = publicFirmClients(req.user.firmId || "firm-default");
    const scopedSystem = firmClients.length ? `${system}\n\nCURRENT FIRM CLIENTS:\n${JSON.stringify(firmClients.slice(0, 20))}` : system;
    if (isUsageBlocked(req.user.firmId, "aiMessages")) {
      return res.status(429).json({ error: "Your current plan limit for AI messages has been reached. Upgrade to continue." });
    }
    incrementUsage(req.user.firmId, "aiMessages");
    await saveData();
    const reply = await askLLM(scopedSystem, messages || []);
    res.json({ reply, billingSummary: getBillingSummary(req.user.firmId) });
  } catch (error) {
    res.status(500).json({ error: error.message || "Assistant request failed" });
  }
});

app.post("/api/uploads", requireAuth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const ext = path.extname(req.file.originalname || "");
    const finalPath = path.join(uploadsDir, `${req.file.filename}${ext}`);
    fs.renameSync(req.file.path, finalPath);

    const fileKey = path.basename(finalPath);
    let storagePath = null;
    if (supabase) {
      try {
        const storageResult = await uploadToSupabaseStorage(finalPath, req.file.originalname, req.file.mimetype);
        storagePath = storageResult?.path || null;
      } catch (storageError) {
        console.warn("Supabase storage upload failed, using local fallback:", storageError.message);
      }
    }

    res.json({ ok: true, fileName: req.file.originalname, url: `/api/files/${fileKey}`, fileKey, storagePath, mimeType: req.file.mimetype });
  } catch (error) {
    res.status(500).json({ error: error.message || "Upload failed" });
  }
});

async function portalFileHandler(req, res) {
  try {
    const client = req.portalClient;
    const key = path.basename(req.params.key);
    const allFiles = (client.documents || []).flatMap((d) => [d, ...(d.versions || [])]);
    const matchedFile = allFiles.find((f) => f.uploadedFileKey === key);
    if (!matchedFile) return res.status(404).json({ error: "File not found" });
    if (matchedFile.uploadedStoragePath) {
      const signedUrl = await createSignedDownloadUrl(matchedFile.uploadedStoragePath);
      if (signedUrl) return res.redirect(signedUrl);
    }
    const filePath = path.join(uploadsDir, key);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found" });
    res.download(filePath, matchedFile.uploadedFile || key);
  } catch (error) {
    res.status(500).json({ error: error.message || "File fetch failed" });
  }
}
app.get(["/api/portal/:identifier/:token/files/:key", "/api/p/:identifier/:token/files/:key"], resolvePortalClient, portalFileHandler);
app.get("/api/portal/session/files/:key", resolvePortalClient, portalFileHandler);

app.get("/api/files/:key", requireAuth, async (req, res) => {
  const key = path.basename(req.params.key);
  let matchedDoc = null;
  const ownerClient = clientsState.find((client) => {
    const doc = (client.documents || []).find((d) => d.uploadedFileKey === key || (d.versions || []).some((v) => v.uploadedFileKey === key));
    if (doc) matchedDoc = doc.uploadedFileKey === key ? doc : doc.versions.find((v) => v.uploadedFileKey === key);
    return Boolean(doc);
  });
  if (!ownerClient || ownerClient.firmId !== req.user.firmId) {
    return res.status(404).json({ error: "File not found" });
  }
  if (matchedDoc.uploadedStoragePath) {
    const signedUrl = await createSignedDownloadUrl(matchedDoc.uploadedStoragePath);
    if (signedUrl) return res.redirect(signedUrl);
  }
  const filePath = path.join(uploadsDir, key);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found" });
  res.download(filePath, matchedDoc.uploadedFile || key);
});

app.post("/api/email", requireAuth, async (req, res) => {
  try {
    const { to, subject, html } = req.body || {};
    if (!to || !subject) return res.status(400).json({ error: "Missing email details" });
    const result = await sendEmail({ to, subject, html });
    res.json({ ok: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message || "Email failed" });
  }
});

app.use((err, req, res, next) => {
  console.error(`[error] ${req.method} ${req.path}:`, err.message);
  if (res.headersSent) return next(err);
  const status = err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
  const message = err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
    ? "File is too large. The maximum upload size is 15 MB."
    : err.message || "Request failed";
  res.status(status).json({ error: message });
});

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (error) => {
  console.error("[uncaughtException]", error);
});

if (!onVercel) {
  app.listen(port, () => {
    console.log(`ClientFlow API running on http://localhost:${port}`);
  });
}

export default app;
