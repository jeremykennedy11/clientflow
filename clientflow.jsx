import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  LayoutDashboard, Users, FileText, MessageSquare, DollarSign, LogOut,
  Upload, CheckCircle2, Clock, AlertTriangle, XCircle, Send, Copy,
  Sparkles, ArrowRight, Mail, Lock, ChevronRight, ChevronLeft, Plus,
  Building2, Calendar, Bell, Loader2, Menu, X, Check, MinusCircle,
  FileStack, Search, Wand2, Trash2, Link2, ExternalLink
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

/* ---------------------------------------------------------------------- */
/*  Design tokens — ledger / paper-trail aesthetic                        */
/* ---------------------------------------------------------------------- */
const FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');";

const GLOBAL_CSS = `
${FONT_IMPORT}
.dc-root{
  --bg:#F6F3EA; --bg-panel:#FFFFFF; --bg-alt:#EFEADB;
  --ink:#1E2A38; --ink-soft:#5A6472; --ink-faint:#8B93A0;
  --line:#DED6C1;
  --gold:#C89B3C; --gold-dark:#9C7627; --gold-bg:#F5EBD3;
  --green:#2F6F4F; --green-bg:#E1EDE4;
  --red:#B4432F; --red-bg:#F4E1DA;
  --blue:#3B5C7A; --blue-bg:#E4EBF1;
  --gray-bg:#EAE5D6;
  --serif:'Fraunces', Georgia, serif;
  --sans:'Inter', -apple-system, sans-serif;
  --mono:'IBM Plex Mono', monospace;
  font-family:var(--sans);
  color:var(--ink);
  background:var(--bg);
  min-height:100vh;
  width:100%;
  position:relative;
}
.dc-root *{ box-sizing:border-box; }
.dc-serif{ font-family:var(--serif); }
.dc-mono{ font-family:var(--mono); }

/* ruled-paper texture used behind hero / panels */
.dc-ruled{
  background-image: repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(30,42,56,0.055) 28px);
}

.dc-btn{
  display:inline-flex; align-items:center; gap:8px;
  font-family:var(--sans); font-weight:600; font-size:14px;
  padding:11px 20px; border-radius:7px; border:1px solid transparent;
  cursor:pointer; transition:all .15s ease; white-space:nowrap;
}
.dc-btn-primary{ background:var(--ink); color:#F6F3EA; }
.dc-btn-primary:hover{ background:#0F1822; }
.dc-btn-gold{ background:var(--gold); color:#2A1F08; }
.dc-btn-gold:hover{ background:var(--gold-dark); color:#fff; }
.dc-btn-outline{ background:transparent; color:var(--ink); border-color:var(--ink); }
.dc-btn-outline:hover{ background:var(--ink); color:#F6F3EA; }
.dc-btn-ghost{ background:transparent; color:var(--ink-soft); border-color:var(--line); }
.dc-btn-ghost:hover{ border-color:var(--ink-soft); color:var(--ink); }
.dc-btn:disabled{ opacity:.55; cursor:not-allowed; }
.dc-btn-sm{ padding:7px 13px; font-size:12.5px; border-radius:6px; }

.dc-card{
  background:var(--bg-panel); border:1px solid var(--line);
  border-radius:12px; padding:22px;
}
.dc-input, .dc-select, .dc-textarea{
  width:100%; font-family:var(--sans); font-size:14px;
  border:1px solid var(--line); border-radius:7px; padding:10px 12px;
  background:#fff; color:var(--ink); outline:none;
}
.dc-input:focus, .dc-select:focus, .dc-textarea:focus{ border-color:var(--gold-dark); box-shadow:0 0 0 3px rgba(200,155,60,0.18); }
.dc-label{ font-size:12.5px; font-weight:600; color:var(--ink-soft); text-transform:uppercase; letter-spacing:.06em; display:block; margin-bottom:6px; }

/* stamp-style status badge -- signature element */
.dc-stamp{
  display:inline-flex; align-items:center; gap:6px;
  font-family:var(--mono); font-size:10.5px; font-weight:600;
  letter-spacing:.08em; text-transform:uppercase;
  padding:4px 10px 4px 9px; border-radius:100px;
  border:1.4px dashed currentColor;
  transform:rotate(-1.2deg);
}

.dc-table{ width:100%; border-collapse:collapse; font-size:14px; }
.dc-table th{ text-align:left; font-size:11.5px; text-transform:uppercase; letter-spacing:.06em; color:var(--ink-faint); font-weight:600; padding:10px 14px; border-bottom:1.5px solid var(--line); }
.dc-table td{ padding:14px; border-bottom:1px solid var(--line); vertical-align:middle; }
.dc-table tr:hover td{ background:var(--bg-alt); cursor:pointer; }

.dc-scroll::-webkit-scrollbar{ width:8px; height:8px; }
.dc-scroll::-webkit-scrollbar-thumb{ background:var(--line); border-radius:8px; }

@media (max-width:860px){
  .dc-sidebar{ display:none !important; }
  .dc-main{ padding:18px !important; }
  .dc-hide-mobile{ display:none !important; }
}
`;

/* ---------------------------------------------------------------------- */
/*  Sample demo data                                                      */
/* ---------------------------------------------------------------------- */
const STATUSES = ["Not requested","Requested","Received","In review","Approved","Rejected","Not applicable","Overdue"];

const STATUS_STYLE = {
  "Not requested": { fg:"#8B93A0" },
  "Requested":     { fg:"#3B5C7A" },
  "Received":      { fg:"#3B5C7A" },
  "In review":     { fg:"#9C7627" },
  "Approved":      { fg:"#2F6F4F" },
  "Rejected":      { fg:"#B4432F" },
  "Not applicable":{ fg:"#8B93A0" },
  "Overdue":       { fg:"#B4432F" },
};

const TEMPLATES = {
  "Monthly bookkeeping close": ["Bank statement","Credit card statement","Loan statement","Payroll summary","Receipts (misc.)"],
  "Tax prep": ["Prior year tax return","W-2s","1099s","Mortgage interest statement","Charitable contribution receipts"],
  "Payroll setup": ["EIN confirmation letter","Employee W-4s","Employee I-9s","Direct deposit forms","State withholding registration"],
  "New client onboarding": ["Prior year financials","Chart of accounts","Bank statements (last 3 months)","Formation documents","Voided check"],
  "Cleanup project": ["Bank statements (12 months)","Credit card statements (12 months)","Prior tax returns","Existing bookkeeping file","Loan agreements"],
  "1099 collection": ["Vendor W-9s","Vendor payment totals","Contractor agreements"],
  "Loan application support": ["Profit & loss statement","Balance sheet","Bank statements (6 months)","Tax returns (2 years)","Debt schedule"],
};

function mkDoc(id, name, category, status, note="", dueDate=null) {
  return { id, name, category, status, note, dueDate, uploadedAt: status==="Received"||status==="Approved"||status==="In review" ? "recently" : null };
}

const initialClients = [
  {
    id: "c1", name: "Sarah Whitfield", email: "sarah@whitfielddesign.com", company: "Whitfield Design Co.",
    phone: "(555) 201-3345", status: "Overdue", lastContacted: "Jun 21, 2026", nextFollowUp: "Jul 5, 2026",
    notes: "Prefers email over text. Usually responsive within 2 days once reminded.",
    documents: [
      mkDoc("d1","March bank statement","Bank statements","Overdue"),
      mkDoc("d2","March credit card statement","Credit card statements","Overdue"),
      mkDoc("d3","March payroll summary","Payroll reports","Overdue"),
      mkDoc("d4","February bank statement","Bank statements","Approved"),
    ],
    log: [
      { date:"Jun 14, 2026", type:"Email", note:"Initial document request sent." },
      { date:"Jun 21, 2026", type:"Email", note:"First reminder sent — no response yet." },
    ],
  },
  {
    id: "c2", name: "Marcus Chen", email: "marcus@chencontracting.com", company: "Chen & Sons Contracting",
    phone: "(555) 480-1187", status: "Requested", lastContacted: "Jun 28, 2026", nextFollowUp: "Jul 8, 2026",
    notes: "Tax prep client — annual filer. New this year.",
    documents: [
      mkDoc("d5","Vendor W-9 — Riverside Supply","1099s","Received"),
      mkDoc("d6","Vendor W-9 — Delgado Electric","1099s","Requested"),
      mkDoc("d7","Vendor payment totals 2025","1099s","Requested"),
      mkDoc("d8","Prior year tax return","Tax forms","Approved"),
    ],
    log: [
      { date:"Jun 28, 2026", type:"Email", note:"1099 collection request sent for tax year 2025." },
    ],
  },
  {
    id: "c3", name: "Priya Anand", email: "priya@anandwellness.com", company: "Anand Wellness Studio",
    phone: "(555) 662-9034", status: "In review", lastContacted: "Jun 30, 2026", nextFollowUp: "Jul 4, 2026",
    notes: "Monthly close client. Very organized — uploads promptly.",
    documents: [
      mkDoc("d9","June bank statement","Bank statements","In review"),
      mkDoc("d10","June credit card statement","Credit card statements","Approved"),
      mkDoc("d11","June receipts (misc.)","Receipts","Approved"),
      mkDoc("d12","Studio lease agreement","Loan documents","Not applicable"),
    ],
    log: [
      { date:"Jun 25, 2026", type:"Portal upload", note:"Uploaded June bank + credit card statements." },
      { date:"Jun 30, 2026", type:"Email", note:"Confirmed receipt, statement under review." },
    ],
  },
  {
    id: "c4", name: "David Ortiz", email: "david@ortizautogroup.com", company: "Ortiz Auto Group",
    phone: "(555) 774-2210", status: "Approved", lastContacted: "Jun 18, 2026", nextFollowUp: "Jul 18, 2026",
    notes: "Low-maintenance client. All caught up for the quarter.",
    documents: [
      mkDoc("d13","Q2 profit and loss","Profit and loss documents","Approved"),
      mkDoc("d14","Q2 balance sheet","Balance sheet documents","Approved"),
      mkDoc("d15","Floor plan loan statement","Loan documents","Approved"),
    ],
    log: [
      { date:"Jun 18, 2026", type:"Email", note:"Quarterly package approved and filed." },
    ],
  },
  {
    id: "c5", name: "Linda Kwan", email: "linda@kwanfamilytrust.com", company: "Kwan Family Trust",
    phone: "(555) 390-5521", status: "Not requested", lastContacted: "—", nextFollowUp: "Jul 10, 2026",
    notes: "New client onboarding — kickoff call scheduled for next week.",
    documents: [
      mkDoc("d16","Formation documents","Vendor documents","Not requested"),
      mkDoc("d17","Chart of accounts","Vendor documents","Not requested"),
      mkDoc("d18","Bank statements (last 3 months)","Bank statements","Not requested"),
      mkDoc("d19","Voided check","Vendor documents","Not requested"),
    ],
    log: [],
  },
  {
    id: "c6", name: "Tomás Reyes", email: "tomas@reyeslogistics.com", company: "Reyes Logistics LLC",
    phone: "(555) 118-6602", status: "Rejected", lastContacted: "Jun 29, 2026", nextFollowUp: "Jul 3, 2026",
    notes: "Uploaded a personal statement by mistake for the business bank account item.",
    documents: [
      mkDoc("d20","May bank statement","Bank statements","Rejected","Wrong account — please re-upload the business account statement."),
      mkDoc("d21","May fuel receipts","Receipts","Received"),
      mkDoc("d22","Driver payroll report","Payroll reports","Requested"),
    ],
    log: [
      { date:"Jun 29, 2026", type:"Review", note:"Bank statement rejected — requested correct account." },
    ],
  },
];

const STORAGE_KEY = "clientflow-state";
const AUTH_STORAGE_KEY = "clientflow-auth";
const PORTAL_AUTH_STORAGE_KEY = "clientflow-portal-auth";
// In dev, the API runs on its own port (3001); in a production build, frontend and API are
// served from the same Vercel deployment, so relative "/api/..." paths just work same-origin.
const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL ?? (import.meta.env?.DEV ? "http://localhost:3001" : "");

function getSavedState() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getSavedAuth() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getSavedPortalAuth() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PORTAL_AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePortalAuth(token, client) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PORTAL_AUTH_STORAGE_KEY, JSON.stringify({ token, client }));
}

function clearPortalAuth() {
  if (typeof window !== "undefined") window.localStorage.removeItem(PORTAL_AUTH_STORAGE_KEY);
}

// A client reaches their portal two ways: a magic link (:identifier/:token in the URL, no
// login) or a persistent login (client session token, no URL secret needed). Both funnel
// into the same set of /api/portal/... action endpoints, just with a different base + auth.
function getPortalRequestConfig(portalAccess, portalSessionToken) {
  if (portalSessionToken) {
    return { mePath: "/api/portal/session/me", actionBase: "/api/portal/session", authHeader: `Bearer ${portalSessionToken}` };
  }
  if (portalAccess) {
    const base = `/api/portal/${encodeURIComponent(portalAccess.identifier)}/${portalAccess.token}`;
    return { mePath: base, actionBase: base, authHeader: null };
  }
  return null;
}

function getPortalLoginRouteFromLocation() {
  if (typeof window === "undefined") return false;
  return /^\/portal\/login\/?$/.test(window.location.pathname);
}

function createPortalSlug(client) {
  const base = `${client?.name || "client"} ${client?.company || "portal"}`;
  return String(base)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "client-portal";
}

function getPortalRouteFromLocation() {
  if (typeof window === "undefined") return null;
  const match = window.location.pathname.match(/^\/(?:portal|p)\/([^/]+)\/([^/]+)\/?$/);
  if (!match) return null;
  return { identifier: decodeURIComponent(match[1]), token: decodeURIComponent(match[2]) };
}

function getResetTokenFromLocation() {
  if (typeof window === "undefined") return null;
  if (!/^\/reset-password\/?$/.test(window.location.pathname)) return null;
  return new URLSearchParams(window.location.search).get("token") || "";
}

function getVerifyTokenFromLocation() {
  if (typeof window === "undefined") return null;
  if (!/^\/verify-email\/?$/.test(window.location.pathname)) return null;
  return new URLSearchParams(window.location.search).get("token") || "";
}

function getStaticPageFromLocation() {
  if (typeof window === "undefined") return null;
  if (/^\/privacy\/?$/.test(window.location.pathname)) return "privacy";
  if (/^\/terms\/?$/.test(window.location.pathname)) return "terms";
  return null;
}

let refreshInFlight = null;

async function tryRefreshSession() {
  const auth = getSavedAuth();
  if (!auth?.refreshToken) return null;
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: auth.refreshToken }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)
      .finally(() => { refreshInFlight = null; });
  }
  const data = await refreshInFlight;
  if (data?.token) {
    const current = getSavedAuth() || {};
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
      ...current,
      token: data.token,
      refreshToken: data.refreshToken || current.refreshToken,
      user: data.user || current.user,
    }));
    return data.token;
  }
  if (typeof window !== "undefined") window.localStorage.removeItem(AUTH_STORAGE_KEY);
  return null;
}

async function authedFetch(path, options = {}) {
  const doFetch = (token) => {
    const headers = { ...(options.headers || {}) };
    if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      body: options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body,
    });
  };

  let res = await doFetch(getSavedAuth()?.token);
  if (res.status === 401 && !path.startsWith("/api/auth/")) {
    const newToken = await tryRefreshSession();
    if (newToken) res = await doFetch(newToken);
  }
  return res;
}

async function apiRequest(path, options = {}) {
  const res = await authedFetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

/* ---------------------------------------------------------------------- */
/*  Claude API helper                                                     */
/* ---------------------------------------------------------------------- */
async function askClara(system, messages) {
  try {
    const data = await apiRequest("/api/assistant", { method: "POST", body: { system, messages } });
    return data.reply || "Clara couldn't generate a response just now — please try again.";
  } catch (e) {
    const userMessage = (messages || []).filter((m) => m.role === "user").slice(-1)[0]?.content || "";
    const lower = userMessage.toLowerCase();
    const clientDataMatch = system.match(/CLIENT DATA:\s*(\[[\s\S]*\])/);
    let clientData = [];
    if (clientDataMatch) {
      try {
        clientData = JSON.parse(clientDataMatch[1]);
      } catch {
        clientData = [];
      }
    }

    if (lower.includes("overdue") || lower.includes("who still owes") || lower.includes("missing documents")) {
      const overdue = clientData.filter((c) => c.missing && c.missing.length > 0);
      if (overdue.length) {
        const lines = overdue.map((c) => `${c.name} — ${c.missing.join(", ")}`).join("\n");
        return `Here’s the current picture:\n${lines}`;
      }
    }

    if (lower.includes("draft") || lower.includes("follow-up") || lower.includes("reminder")) {
      return "Here’s a polished follow-up draft: \nHi there, I’m following up on the remaining documents needed to keep your file moving. Please upload the items still outstanding when you can, and I’ll help keep everything on track. Thanks!";
    }

    if (lower.includes("summarize")) {
      return `I can see ${clientData.length} clients in the current pipeline, with the most urgent follow-ups centered on missing documents and overdue items.`;
    }

    return "I’m ready to help with client follow-ups, document status summaries, and next-step suggestions for your bookkeeping workflow.";
  }
}

function clientsSummaryForAI(clients) {
  return clients.map(c => ({
    name: c.name, company: c.company, status: c.status, nextFollowUp: c.nextFollowUp,
    missing: c.documents.filter(d => ["Requested","Overdue","Rejected"].includes(d.status)).map(d => d.name),
  }));
}

function normalizeClients(clients) {
  return Array.isArray(clients) ? clients : [];
}

/* ---------------------------------------------------------------------- */
/*  Small shared components                                               */
/* ---------------------------------------------------------------------- */
function StatusStamp({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE["Not requested"];
  return <span className="dc-stamp" style={{ color: s.fg }}>{status}</span>;
}

function Logo({ size = 30 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <div style={{
        width: size, height: size, borderRadius: "50%", border: "2px solid var(--ink)",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        transform: "rotate(-6deg)",
      }}>
        <span className="dc-serif" style={{ fontSize: size * 0.5, fontWeight: 700, lineHeight: 1 }}>C</span>
      </div>
      <span className="dc-serif" style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em" }}>
        Client<span style={{ color: "var(--gold-dark)" }}>Flow</span>
      </span>
    </div>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="dc-card" style={{ borderTop: `3px solid ${accent || "var(--ink)"}` }}>
      <div className="dc-mono" style={{ fontSize: 11, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: ".07em" }}>{label}</div>
      <div className="dc-serif" style={{ fontSize: 34, fontWeight: 700, margin: "6px 0 2px" }}>{value}</div>
      {sub && <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{sub}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Landing Page                                                          */
/* ---------------------------------------------------------------------- */
function Landing({ onStart, onDemo, onPortalLogin }) {
  const [openFaq, setOpenFaq] = useState(null);
  const faqs = [
    ["Is Clara a real person or software?", "Clara is your AI employee — software that drafts messages, tracks document status, and organizes follow-ups on your behalf. Your firm stays in control of every send."],
    ["Do clients need to create an account?", "No. Clients open a secure portal link, upload what's requested, and leave comments — no login required."],
    ["Can Clara send messages automatically?", "By default Clara drafts every message for your review. Auto-send for routine reminders can be turned on per client."],
    ["What if a client uploads the wrong document?", "Mark the item Rejected with a note, and Clara will draft a polite correction request automatically."],
  ];
  return (
    <div className="dc-root">
      <style>{GLOBAL_CSS}</style>
      {/* nav */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "22px 6vw", borderBottom: "1px solid var(--line)" }}>
        <Logo />
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="dc-btn dc-btn-ghost dc-hide-mobile" onClick={onPortalLogin}>Client login</button>
          <button className="dc-btn dc-btn-ghost dc-hide-mobile" onClick={onStart}>Log in</button>
          <button className="dc-btn dc-btn-ghost dc-hide-mobile" onClick={onDemo}>View demo</button>
          <button className="dc-btn dc-btn-primary" onClick={onStart}>Start free trial</button>
        </div>
      </div>

      {/* hero */}
      <div className="dc-ruled" style={{ padding: "9vw 6vw 7vw", textAlign: "center" }}>
        <div className="dc-mono" style={{ fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--gold-dark)", marginBottom: 18 }}>
          — an AI employee for accounting firms —
        </div>
        <h1 className="dc-serif" style={{ fontSize: "clamp(34px,6vw,64px)", fontWeight: 700, lineHeight: 1.06, maxWidth: 900, margin: "0 auto" }}>
          Hire Clara, your AI Client Documentation Assistant.
        </h1>
        <p style={{ fontSize: 18, color: "var(--ink-soft)", maxWidth: 560, margin: "22px auto 34px", lineHeight: 1.6 }}>
          Stop chasing clients for missing documents. Clara organizes requests, drafts follow-ups, and keeps every client file moving.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button className="dc-btn dc-btn-gold" style={{ padding: "14px 26px", fontSize: 15 }} onClick={onStart}>
            Start free trial <ArrowRight size={16} />
          </button>
          <button className="dc-btn dc-btn-outline" style={{ padding: "14px 26px", fontSize: 15 }} onClick={onDemo}>
            View demo
          </button>
        </div>
      </div>

      {/* features */}
      <div style={{ padding: "5vw 6vw", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 18 }}>
          {[
            [FileStack, "Track every document", "See missing, received, reviewed, and approved items across all clients at a glance."],
            [Wand2, "Clara drafts the follow-up", "Friendly, professional reminders written in your firm's voice — never robotic, never nagging."],
            [Upload, "A portal clients actually use", "One secure link. No login. Clients upload, comment, or mark items not applicable in seconds."],
            [Bell, "Never lose track of who owes what", "Clara flags overdue items and suggests exactly who to follow up with next."],
          ].map(([Icon, title, body], i) => (
            <div className="dc-card" key={i}>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: "var(--gold-bg)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <Icon size={19} color="var(--gold-dark)" />
              </div>
              <div className="dc-serif" style={{ fontWeight: 600, fontSize: 17, marginBottom: 6 }}>{title}</div>
              <div style={{ fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.55 }}>{body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* clara example message */}
      <div style={{ padding: "3vw 6vw", maxWidth: 720, margin: "0 auto" }}>
        <div className="dc-card" style={{ background: "var(--ink)", color: "#F6F3EA", border: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Sparkles size={16} color="var(--gold)" />
            <span className="dc-mono" style={{ fontSize: 11.5, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--gold)" }}>Clara drafted this in 4 seconds</span>
          </div>
          <p style={{ fontSize: 14.5, lineHeight: 1.7, fontStyle: "italic", opacity: .92 }}>
            "Hi Sarah, I hope you're doing well. We're still missing your March bank statement, March credit card statement, and payroll summary.
            Please upload them using the secure link below when you have a chance. Once we receive those, we'll be able to continue with your monthly bookkeeping close. Thank you!"
          </p>
        </div>
      </div>

      {/* pricing preview */}
      <div style={{ padding: "5vw 6vw", maxWidth: 1100, margin: "0 auto" }}>
        <h2 className="dc-serif" style={{ textAlign: "center", fontSize: 28, marginBottom: 30 }}>Simple, transparent pricing</h2>
        <PricingCards compact onStart={onStart} />
      </div>

      {/* testimonials */}
      <div style={{ padding: "3vw 6vw 5vw", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 18 }}>
          {[
            ["\"Clara cut our monthly close from three weeks of chasing down to about four days.\"", "— Managing Partner, boutique bookkeeping firm"],
            ["\"Clients actually use the portal. That alone was worth switching.\"", "— Firm Owner, tax prep practice"],
            ["\"The follow-up drafts sound like us, not like a robot. We barely edit them.\"", "— Senior Bookkeeper"],
          ].map(([quote, who], i) => (
            <div className="dc-card" key={i}>
              <p style={{ fontSize: 14, lineHeight: 1.6, fontStyle: "italic", color: "var(--ink-soft)" }}>{quote}</p>
              <div className="dc-mono" style={{ fontSize: 11.5, marginTop: 12, color: "var(--ink-faint)" }}>{who}</div>
            </div>
          ))}
        </div>
      </div>

      {/* faq */}
      <div style={{ padding: "3vw 6vw 7vw", maxWidth: 720, margin: "0 auto" }}>
        <h2 className="dc-serif" style={{ textAlign: "center", fontSize: 26, marginBottom: 24 }}>Frequently asked questions</h2>
        {faqs.map(([q, a], i) => (
          <div key={i} style={{ borderBottom: "1px solid var(--line)", padding: "16px 0", cursor: "pointer" }} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 600, fontSize: 15 }}>
              {q}
              <ChevronRight size={16} style={{ transform: openFaq === i ? "rotate(90deg)" : "none", transition: "transform .15s", flexShrink: 0 }} />
            </div>
            {openFaq === i && <p style={{ fontSize: 13.5, color: "var(--ink-soft)", marginTop: 10, lineHeight: 1.6 }}>{a}</p>}
          </div>
        ))}
      </div>

      <div style={{ borderTop: "1px solid var(--line)", padding: "24px 6vw", textAlign: "center", fontSize: 12.5, color: "var(--ink-faint)" }}>
        <div style={{ marginBottom: 6 }}>
          <a href="/privacy" style={{ color: "var(--ink-soft)", marginRight: 14 }}>Privacy Policy</a>
          <a href="/terms" style={{ color: "var(--ink-soft)" }}>Terms of Service</a>
        </div>
        ClientFlow — stop chasing clients for documents.
      </div>
    </div>
  );
}

const CONTACT_EMAIL = "jeremykennedy717@gmail.com"; // swap for sales@yourdomain.com once the domain exists

function PricingCards({ compact, onStart, onCheckout }) {
  const plans = [
    { name: "Starter", price: 49, features: ["1 AI employee: Clara", "Up to 10 clients", "100 AI messages/month", "Secure document portal", "Basic templates"] },
    { name: "Professional", price: 149, popular: true, features: ["Clara included", "Up to 50 clients", "1,000 AI messages/month", "Advanced templates", "Communication history", "Priority support"] },
    { name: "Firm", price: 349, features: ["Clara included", "Up to 250 clients", "5,000 AI messages/month", "Team users", "Custom branding", "Advanced reporting"] },
    { name: "Enterprise", custom: true, features: ["Everything in Firm", "Unlimited clients & AI messages", "Dedicated success manager", "Custom onboarding & training", "Security review & DPA", "Priority phone support"] },
  ];
  const contactSales = () => {
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("ClientFlow — Enterprise plan inquiry")}`;
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 18, alignItems: "stretch" }}>
      {plans.map((p) => (
        <div key={p.name} className="dc-card" style={{
          display: "flex", flexDirection: "column", position: "relative",
          border: p.popular ? "1.5px solid var(--gold-dark)" : "1px solid var(--line)",
        }}>
          {p.popular && (
            <div className="dc-stamp" style={{ color: "var(--gold-dark)", position: "absolute", top: -13, left: 20, background: "var(--bg-panel)" }}>Most popular</div>
          )}
          <div className="dc-serif" style={{ fontSize: 19, fontWeight: 600, marginTop: 6 }}>{p.name}</div>
          <div style={{ margin: "10px 0 16px" }}>
            {p.custom ? (
              <>
                <span className="dc-serif" style={{ fontSize: 36, fontWeight: 700 }}>Custom</span>
                <span style={{ color: "var(--ink-soft)", fontSize: 13, display: "block" }}>tailored to your practice</span>
              </>
            ) : (
              <>
                <span className="dc-serif" style={{ fontSize: 36, fontWeight: 700 }}>${p.price}</span>
                <span style={{ color: "var(--ink-soft)", fontSize: 13 }}> /month</span>
              </>
            )}
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 9, marginBottom: 18 }}>
            {p.features.map((f) => (
              <div key={f} style={{ display: "flex", gap: 8, fontSize: 13.5, color: "var(--ink-soft)" }}>
                <Check size={15} color="var(--green)" style={{ flexShrink: 0, marginTop: 1 }} /> {f}
              </div>
            ))}
          </div>
          {p.custom ? (
            <button className="dc-btn dc-btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={contactSales}>
              Contact us
            </button>
          ) : (
            <button className={`dc-btn ${p.popular ? "dc-btn-gold" : "dc-btn-outline"}`} style={{ width: "100%", justifyContent: "center" }} onClick={() => onCheckout ? onCheckout(p.name.toLowerCase()) : onStart()}>
              {onCheckout ? `Choose ${p.name}` : "Start free trial"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Login                                                                  */
/* ---------------------------------------------------------------------- */
function Login({ onSubmit, onBack }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await onSubmit({ mode, name, email, password });
      if (mode === "forgot") {
        setSuccess("If that account exists, a reset email has been prepared.");
      }
    } catch (err) {
      setError(err.message || "We couldn't complete that request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dc-root" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div style={{ display: "inline-block" }}><Logo /></div>
        </div>
        <div className="dc-card">
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <button className={`dc-btn dc-btn-sm ${mode === "login" ? "dc-btn-primary" : "dc-btn-ghost"}`} onClick={() => setMode("login")}>Log in</button>
            <button className={`dc-btn dc-btn-sm ${mode === "signup" ? "dc-btn-primary" : "dc-btn-ghost"}`} onClick={() => setMode("signup")}>Create account</button>
            <button className={`dc-btn dc-btn-sm ${mode === "forgot" ? "dc-btn-primary" : "dc-btn-ghost"}`} onClick={() => setMode("forgot")}>Reset password</button>
          </div>

          <div className="dc-serif" style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>{mode === "login" ? "Welcome back" : mode === "forgot" ? "Reset your password" : "Create your firm account"}</div>
          <div style={{ fontSize: 13.5, color: "var(--ink-soft)", marginBottom: 22 }}>{mode === "login" ? "Sign in to your dashboard" : mode === "forgot" ? "We'll email a secure reset link if the account exists" : "Start managing client requests and follow-ups"}</div>

          <form onSubmit={handleSubmit}>
            {mode === "signup" && (
              <div style={{ marginBottom: 14 }}>
                <label className="dc-label">Name</label>
                <input className="dc-input" type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <label className="dc-label">Email</label>
              <div style={{ position: "relative" }}>
                <Mail size={15} style={{ position: "absolute", left: 11, top: 12, color: "var(--ink-faint)" }} />
                <input className="dc-input" style={{ paddingLeft: 34 }} type="email" placeholder="you@yourfirm.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>
            {mode !== "forgot" && (
              <div style={{ marginBottom: 16 }}>
                <label className="dc-label">Password</label>
                <div style={{ position: "relative" }}>
                  <Lock size={15} style={{ position: "absolute", left: 11, top: 12, color: "var(--ink-faint)" }} />
                  <input className="dc-input" style={{ paddingLeft: 34 }} type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
              </div>
            )}
            {error && <div style={{ color: "var(--red)", fontSize: 12.5, marginBottom: 12 }}>{error}</div>}
            {success && <div style={{ color: "var(--green)", fontSize: 12.5, marginBottom: 12 }}>{success}</div>}
            <button type="submit" className="dc-btn dc-btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={loading}>
              {loading ? "Please wait..." : mode === "login" ? "Log in" : mode === "forgot" ? "Send reset link" : "Create account"}
            </button>
          </form>
        </div>
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button className="dc-btn dc-btn-ghost dc-btn-sm" onClick={onBack}><ChevronLeft size={13} /> Back to homepage</button>
        </div>
      </div>
    </div>
  );
}

function PortalLogin({ onSubmit, onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await onSubmit({ email, password });
    } catch (err) {
      setError(err.message || "We couldn't sign you in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dc-root" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div style={{ display: "inline-block" }}><Logo /></div>
        </div>
        <div className="dc-card">
          <div className="dc-serif" style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Client portal login</div>
          <div style={{ fontSize: 13.5, color: "var(--ink-soft)", marginBottom: 22 }}>For clients who've set up a persistent login. New here? Use the secure link your firm sent you instead.</div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label className="dc-label">Email</label>
              <div style={{ position: "relative" }}>
                <Mail size={15} style={{ position: "absolute", left: 11, top: 12, color: "var(--ink-faint)" }} />
                <input className="dc-input" style={{ paddingLeft: 34 }} type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="dc-label">Password</label>
              <div style={{ position: "relative" }}>
                <Lock size={15} style={{ position: "absolute", left: 11, top: 12, color: "var(--ink-faint)" }} />
                <input className="dc-input" style={{ paddingLeft: 34 }} type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </div>
            {error && <div style={{ color: "var(--red)", fontSize: 12.5, marginBottom: 12 }}>{error}</div>}
            <button type="submit" className="dc-btn dc-btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={loading}>
              {loading ? "Please wait..." : "Log in"}
            </button>
          </form>
        </div>
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button className="dc-btn dc-btn-ghost dc-btn-sm" onClick={onBack}><ChevronLeft size={13} /> Back to homepage</button>
        </div>
      </div>
    </div>
  );
}

function ResetPassword({ token, onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters long."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      await apiRequest("/api/auth/reset-password", { method: "POST", body: { token, password } });
      setDone(true);
    } catch (err) {
      setError(err.message || "That reset link is invalid or has expired.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dc-root" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div style={{ display: "inline-block" }}><Logo /></div>
        </div>
        <div className="dc-card">
          {done ? (
            <>
              <div className="dc-serif" style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Password updated</div>
              <div style={{ fontSize: 13.5, color: "var(--ink-soft)", marginBottom: 20 }}>Your password has been changed. You can now sign in with your new password.</div>
              <button className="dc-btn dc-btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={onDone}>Go to sign in</button>
            </>
          ) : (
            <>
              <div className="dc-serif" style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Choose a new password</div>
              <div style={{ fontSize: 13.5, color: "var(--ink-soft)", marginBottom: 22 }}>Enter and confirm your new password below.</div>
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 14 }}>
                  <label className="dc-label">New password</label>
                  <div style={{ position: "relative" }}>
                    <Lock size={15} style={{ position: "absolute", left: 11, top: 12, color: "var(--ink-faint)" }} />
                    <input className="dc-input" style={{ paddingLeft: 34 }} type="password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label className="dc-label">Confirm password</label>
                  <div style={{ position: "relative" }}>
                    <Lock size={15} style={{ position: "absolute", left: 11, top: 12, color: "var(--ink-faint)" }} />
                    <input className="dc-input" style={{ paddingLeft: 34 }} type="password" placeholder="Repeat new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
                  </div>
                </div>
                {error && <div style={{ color: "var(--red)", fontSize: 12.5, marginBottom: 12 }}>{error}</div>}
                <button type="submit" className="dc-btn dc-btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={loading}>
                  {loading ? "Please wait..." : "Update password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function VerifyEmailBanner() {
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const [devLink, setDevLink] = useState("");

  const resend = async () => {
    setState("sending");
    try {
      const data = await apiRequest("/api/auth/resend-verification", { method: "POST" });
      if (data.verifyLink) setDevLink(data.verifyLink);
      setState("sent");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="dc-card" style={{ marginBottom: 18, borderColor: "var(--gold-dark)", background: "var(--gold-bg)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, padding: "14px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5 }}>
        <Mail size={16} color="var(--gold-dark)" />
        <span><strong>Verify your email.</strong> We sent a confirmation link to your inbox — some features may be limited until you verify.</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {state === "sent" && <span style={{ fontSize: 12.5, color: "var(--green)" }}>Sent! Check your inbox.</span>}
        {state === "error" && <span style={{ fontSize: 12.5, color: "var(--red)" }}>Couldn't resend — try again.</span>}
        {devLink && <a href={devLink} style={{ fontSize: 12.5, color: "var(--gold-dark)" }}>Open verification link</a>}
        <button className="dc-btn dc-btn-outline dc-btn-sm" onClick={resend} disabled={state === "sending"}>
          {state === "sending" ? "Sending..." : "Resend email"}
        </button>
      </div>
    </div>
  );
}

function VerifyEmail({ token, onDone }) {
  const [status, setStatus] = useState("verifying"); // verifying | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest("/api/auth/verify-email", { method: "POST", body: { token } })
      .then((data) => { if (active) { setStatus("success"); setMessage(data.message || "Email verified."); } })
      .catch((err) => { if (active) { setStatus("error"); setMessage(err.message || "That verification link is invalid or has already been used."); } });
    return () => { active = false; };
  }, [token]);

  return (
    <div className="dc-root" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div style={{ display: "inline-block" }}><Logo /></div>
        </div>
        <div className="dc-card" style={{ textAlign: "center" }}>
          {status === "verifying" && <div style={{ fontSize: 14, color: "var(--ink-soft)" }}><Loader2 size={16} style={{ animation: "spin 1s linear infinite", verticalAlign: -3 }} /> Verifying your email...</div>}
          {status === "success" && (
            <>
              <CheckCircle2 size={34} color="var(--green)" style={{ marginBottom: 10 }} />
              <div className="dc-serif" style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Email verified</div>
              <div style={{ fontSize: 13.5, color: "var(--ink-soft)", marginBottom: 20 }}>{message}</div>
              <button className="dc-btn dc-btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={onDone}>Continue to ClientFlow</button>
            </>
          )}
          {status === "error" && (
            <>
              <XCircle size={34} color="var(--red)" style={{ marginBottom: 10 }} />
              <div className="dc-serif" style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Verification failed</div>
              <div style={{ fontSize: 13.5, color: "var(--ink-soft)", marginBottom: 20 }}>{message}</div>
              <button className="dc-btn dc-btn-outline" style={{ width: "100%", justifyContent: "center" }} onClick={onDone}>Back to ClientFlow</button>
            </>
          )}
        </div>
      </div>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );
}

const LEGAL_CONTENT = {
  privacy: {
    title: "Privacy Policy",
    updated: "July 3, 2026",
    sections: [
      ["Who we are", "ClientFlow provides document collection and follow-up tools for bookkeeping and accounting firms. This policy describes what we collect and how we handle it when firms and their clients use the service."],
      ["Information we collect", "Account information (name, email, hashed password), firm and client records you create in the app, documents uploaded through the client portal, communication logs, and usage data needed to operate plan limits and billing."],
      ["How we use it", "To provide the service: storing and organizing client documents, generating AI-drafted follow-up messages, sending emails you initiate, and processing subscription payments. We do not sell personal information or use your clients' documents to train AI models."],
      ["Where data lives", "Application data and uploaded documents are stored with Supabase (hosted PostgreSQL and private file storage). Emails are delivered via Resend. AI drafting requests are processed by Anthropic (and OpenAI as a fallback). Payments are handled by Stripe — we never see or store full card numbers."],
      ["Document security", "Portal uploads are stored in private buckets and are only reachable through authenticated, time-limited links scoped to your firm."],
      ["Retention & deletion", "Your data is retained while your account is active. You can delete clients and their documents at any time, and you can request full account deletion by contacting us."],
      ["Your rights", "Depending on your jurisdiction, you may have rights to access, correct, export, or delete your personal information. Contact us to exercise them."],
      ["Contact", "Questions about this policy can be sent to the email address listed on our website."],
    ],
  },
  terms: {
    title: "Terms of Service",
    updated: "July 3, 2026",
    sections: [
      ["The service", "ClientFlow helps firms request, collect, track, and follow up on client documents, with AI-assisted message drafting. It is provided on a subscription basis."],
      ["Accounts", "You are responsible for the accuracy of your account information and for keeping your credentials secure. You must have the right to upload and process the client information you put into the service."],
      ["Acceptable use", "Don't use the service to send spam, store unlawful content, attempt to access other firms' data, or resell the service without permission."],
      ["AI-generated content", "Clara drafts messages and summaries automatically. You are responsible for reviewing AI-generated content before sending it to your clients. AI output may contain errors."],
      ["Fees & billing", "Paid plans are billed monthly through Stripe. Plan limits (clients, AI messages, uploads) apply as described on the pricing page. You can cancel at any time; access continues through the end of the paid period."],
      ["Your data", "You own your firm's and clients' data. We claim no rights to it beyond what is needed to operate the service."],
      ["Availability & warranty", "The service is provided \"as is\" without warranties of any kind. We do not guarantee uninterrupted availability."],
      ["Limitation of liability", "To the maximum extent permitted by law, our total liability for any claim is limited to the amounts you paid for the service in the twelve months preceding the claim."],
      ["Termination", "We may suspend accounts that violate these terms. You may stop using the service and cancel your subscription at any time."],
      ["Changes", "We may update these terms; material changes will be communicated by email or in-app notice."],
    ],
  },
};

function LegalPage({ page, onBack }) {
  const content = LEGAL_CONTENT[page];
  return (
    <div className="dc-root">
      <style>{GLOBAL_CSS}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "22px 6vw", borderBottom: "1px solid var(--line)" }}>
        <Logo />
        <button className="dc-btn dc-btn-ghost dc-btn-sm" onClick={onBack}><ChevronLeft size={13} /> Back</button>
      </div>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px 80px" }}>
        <h1 className="dc-serif" style={{ fontSize: 32, fontWeight: 700, marginBottom: 6 }}>{content.title}</h1>
        <div className="dc-mono" style={{ fontSize: 12, color: "var(--ink-faint)", marginBottom: 28 }}>Last updated: {content.updated}</div>
        {content.sections.map(([heading, body]) => (
          <div key={heading} style={{ marginBottom: 22 }}>
            <h2 className="dc-serif" style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>{heading}</h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--ink-soft)", margin: 0 }}>{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  App shell (post-login)                                                */
/* ---------------------------------------------------------------------- */
const NAV = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["clients", "Clients", Users],
  ["builder", "Document requests", FileText],
  ["clara", "Clara assistant", MessageSquare],
  ["portal", "Client portal preview", Upload],
  ["admin", "Admin settings", Building2],
  ["pricing", "Plan & billing", DollarSign],
];

function Sidebar({ page, setPage, onLogout, mobileOpen, setMobileOpen, canManageTeam }) {
  const visibleNav = NAV.filter(([key]) => key !== "admin" || canManageTeam);
  const content = (
    <>
      <div style={{ padding: "22px 20px" }}><Logo size={28} /></div>
      <div style={{ padding: "0 12px", flex: 1 }}>
        {visibleNav.map(([key, label, Icon]) => (
          <div
            key={key}
            onClick={() => { setPage(key); setMobileOpen(false); }}
            style={{
              display: "flex", alignItems: "center", gap: 11, padding: "11px 12px", borderRadius: 8,
              fontSize: 13.5, fontWeight: 500, cursor: "pointer", marginBottom: 2,
              background: page === key ? "var(--ink)" : "transparent",
              color: page === key ? "#F6F3EA" : "var(--ink-soft)",
            }}
          >
            <Icon size={16} /> {label}
          </div>
        ))}
      </div>
      <div style={{ padding: 16, borderTop: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", color: "var(--ink-soft)", fontSize: 13.5 }} onClick={onLogout}>
          <LogOut size={15} /> Log out
        </div>
      </div>
    </>
  );
  return (
    <>
      <div className="dc-sidebar" style={{ width: 232, minHeight: "100vh", borderRight: "1px solid var(--line)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        {content}
      </div>
      {mobileOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(30,42,56,0.4)" }} onClick={() => setMobileOpen(false)}>
          <div style={{ width: 232, background: "var(--bg)", minHeight: "100vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
            {content}
          </div>
        </div>
      )}
    </>
  );
}

function TopBar({ title, setMobileOpen }) {
  return (
    <div style={{ display: "none" }} className="dc-hide-mobile">
      {/* placeholder for symmetry; mobile bar rendered separately */}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Dashboard                                                              */
/* ---------------------------------------------------------------------- */
function Dashboard({ clients, setPage, setSelectedId, authUser, team, invitations, onManageTeam, canManageTeam, activityLog, billingSummary, invoices }) {
  const totalClients = clients.length;
  const allDocs = clients.flatMap(c => c.documents);
  const missingClients = clients.filter(c => c.documents.some(d => ["Requested","Overdue","Rejected"].includes(d.status))).length;
  const requested = allDocs.filter(d => d.status === "Requested").length;
  const received = allDocs.filter(d => ["Received","In review","Approved"].includes(d.status)).length;
  const overdue = allDocs.filter(d => d.status === "Overdue").length;

  const chartData = STATUSES.map(s => ({ name: s.replace(" documents","").replace("Not ","Not-"), value: allDocs.filter(d => d.status === s).length }))
    .filter(d => d.value > 0);

  const overdueClients = clients.filter(c => c.documents.some(d => d.status === "Overdue"));
  const notRequestedClients = clients.filter(c => c.documents.length > 0 && c.documents.every(d => d.status === "Not requested"));
  const rejectedClients = clients.filter(c => c.documents.some(d => d.status === "Rejected"));
  const suggestions = [
    overdueClients.length > 0 && `Follow up with ${overdueClients.map(c => c.name.split(" ")[0]).join(" and ")} — overdue documents are blocking their file.`,
    ...notRequestedClients.map(c => `${c.name}'s checklist hasn't been sent yet — send their document request.`),
    ...rejectedClients.map(c => `${c.name} has a rejected upload — draft a correction request.`),
  ].filter(Boolean);
  if (suggestions.length === 0) {
    suggestions.push(clients.length === 0
      ? "Add your first client to start tracking document requests."
      : "All client files are on track — no follow-ups needed right now.");
  }

  return (
    <div>
      <SectionHeader eyebrow="Overview" title="Dashboard" desc="Here's where every client file stands today." />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 22 }}>
        <StatCard label="Total clients" value={totalClients} accent="var(--ink)" />
        <StatCard label="Missing documents" value={missingClients} sub="clients affected" accent="var(--red)" />
        <StatCard label="Requested" value={requested} sub="awaiting upload" accent="var(--blue)" />
        <StatCard label="Received" value={received} sub="in pipeline or approved" accent="var(--green)" />
        <StatCard label="Overdue" value={overdue} sub="past due date" accent="var(--red)" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
        <div className="dc-card">
          <div className="dc-serif" style={{ fontWeight: 600, marginBottom: 14 }}>Documents by status</div>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ left: -20 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10.5, fill: "var(--ink-soft)" }} interval={0} angle={-20} textAnchor="end" height={55} />
                <YAxis tick={{ fontSize: 11, fill: "var(--ink-soft)" }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--line)" }} />
                <Bar dataKey="value" fill="#C89B3C" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="dc-card">
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
            <Sparkles size={15} color="var(--gold-dark)" />
            <span className="dc-serif" style={{ fontWeight: 600 }}>Clara's suggested next actions</span>
          </div>
          {suggestions.map((s, i) => (
            <div key={i} style={{ fontSize: 13, color: "var(--ink-soft)", padding: "10px 0", borderBottom: i < suggestions.length - 1 ? "1px solid var(--line)" : "none", lineHeight: 1.5 }}>
              {s}
            </div>
          ))}
          <button className="dc-btn dc-btn-gold dc-btn-sm" style={{ marginTop: 14, width: "100%", justifyContent: "center" }} onClick={() => setPage("clara")}>
            Ask Clara for more <ArrowRight size={13} />
          </button>
        </div>
      </div>

      <div className="dc-card" style={{ marginTop: 16 }}>
        <div className="dc-serif" style={{ fontWeight: 600, marginBottom: 12 }}>Team access</div>
        <div style={{ display: "grid", gap: 10 }}>
          {team?.length ? team.map((member) => (
            <div key={member.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{member.name}</div>
                <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{member.email}</div>
              </div>
              <span className="dc-stamp" style={{ color: member.role === "owner" ? "var(--gold-dark)" : "var(--blue)" }}>{member.role}</span>
            </div>
          )) : <div style={{ color: "var(--ink-soft)", fontSize: 13.5 }}>No team members yet.</div>}
          {canManageTeam ? <button className="dc-btn dc-btn-outline dc-btn-sm" style={{ width: "fit-content" }} onClick={() => onManageTeam()}>Manage team access</button> : <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>Members can view client work but cannot manage team access.</div>}
        </div>
      </div>

      <div className="dc-card" style={{ marginTop: 16 }}>
        <div className="dc-serif" style={{ fontWeight: 600, marginBottom: 12 }}>Billing & plan</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600 }}>{billingSummary?.plan ? billingSummary.plan.charAt(0).toUpperCase() + billingSummary.plan.slice(1) : "Professional"} plan</div>
            <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>Includes Clara, team access, and secure client portals.</div>
          </div>
          <div style={{ textAlign: "right" }}>
            {billingSummary?.plan === "enterprise" ? (
              <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>Custom pricing</div>
            ) : (
              <>
                <div className="dc-mono" style={{ fontSize: 12, color: "var(--gold-dark)" }}>Next invoice • {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>${billingSummary?.limits?.price || 149} / month</div>
              </>
            )}
          </div>
        </div>
        <div style={{ marginTop: 12, display: "grid", gap: 8, fontSize: 13, color: "var(--ink-soft)" }}>
          <div>AI messages: {billingSummary?.usage?.aiMessages || 0} / {(billingSummary?.limits?.aiMessages || 1000) >= 1000000 ? "Unlimited" : (billingSummary?.limits?.aiMessages || 1000)}</div>
          <div>Uploads: {billingSummary?.usage?.uploads || 0} / {(billingSummary?.limits?.uploads || 250) >= 1000000 ? "Unlimited" : (billingSummary?.limits?.uploads || 250)}</div>
          <div>Portal uploads: {billingSummary?.usage?.portalUploads || 0}</div>
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="dc-btn dc-btn-outline dc-btn-sm" onClick={() => setPage("pricing")}>View plans & invoices</button>
        </div>
      </div>

      <div className="dc-card" style={{ marginTop: 16 }}>
        <div className="dc-serif" style={{ fontWeight: 600, marginBottom: 12 }}>Recent activity</div>
        {activityLog?.length ? activityLog.slice(-6).reverse().map((item) => (
          <div key={item.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
            <div style={{ fontWeight: 600 }}>{item.action}</div>
            <div style={{ color: "var(--ink-soft)" }}>{item.detail}</div>
            <div className="dc-mono" style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 2 }}>{new Date(item.createdAt).toLocaleString()}</div>
          </div>
        )) : <div style={{ color: "var(--ink-soft)", fontSize: 13.5 }}>No activity yet.</div>}
      </div>

    </div>
  );
}

function AdminSettings({ authUser, team, invitations, onInvite, canManageTeam }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submitInvite = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setMessage("");
    try {
      const result = await onInvite(email.trim(), role);
      setMessage(result?.invite ? `Invitation sent to ${result.invite.email}` : "Invite request completed.");
      setEmail("");
      setRole("member");
    } catch (error) {
      setMessage(error.message || "We couldn't send the invitation.");
    } finally {
      setLoading(false);
    }
  };

  if (!canManageTeam) {
    return (
      <div>
        <SectionHeader eyebrow="Access control" title="Admin settings" desc="Only owners and admins can manage team access and invitations." />
        <div className="dc-card" style={{ maxWidth: 640 }}>
          <div style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.6 }}>
            Your current role is <strong>{authUser?.role || "member"}</strong>. You can view the workspace and client records, but only owners and admins can send invitations or change access settings.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader eyebrow="Access control" title="Admin settings" desc="Manage team members, invitations, and permissions for your firm." />
      <div style={{ display: "grid", gap: 16 }}>
        <div className="dc-card">
          <div className="dc-serif" style={{ fontWeight: 600, marginBottom: 10 }}>Invite a teammate</div>
          <form onSubmit={submitInvite} style={{ display: "grid", gap: 12 }}>
            <div>
              <label className="dc-label">Email address</label>
              <input className="dc-input" type="email" placeholder="teammate@yourfirm.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="dc-label">Role</label>
              <select className="dc-select" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {message && <div style={{ fontSize: 12.5, color: message.includes("sent") ? "var(--green)" : "var(--red)" }}>{message}</div>}
            <button className="dc-btn dc-btn-primary" style={{ width: "fit-content" }} disabled={loading}>
              {loading ? "Sending..." : "Send invitation"}
            </button>
          </form>
        </div>

        <div className="dc-card">
          <div className="dc-serif" style={{ fontWeight: 600, marginBottom: 10 }}>Current team</div>
          <div style={{ display: "grid", gap: 10 }}>
            {team?.length ? team.map((member) => (
              <div key={member.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{member.name}</div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{member.email}</div>
                </div>
                <span className="dc-stamp" style={{ color: member.role === "owner" ? "var(--gold-dark)" : "var(--blue)" }}>{member.role}</span>
              </div>
            )) : <div style={{ color: "var(--ink-soft)", fontSize: 13.5 }}>No team members yet.</div>}
          </div>
        </div>

        <div className="dc-card">
          <div className="dc-serif" style={{ fontWeight: 600, marginBottom: 8 }}>Permission model</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: "var(--ink-soft)", lineHeight: 1.7 }}>
            <li>Owners and admins can send invitations, change access, and manage client request workflows.</li>
            <li>Members can view clients, respond to portal uploads, and use Clara, but they cannot create new requests or change access settings.</li>
            <li>Client portal uploads remain available without requiring a login.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ eyebrow, title, desc, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
      <div>
        <div className="dc-mono" style={{ fontSize: 11, color: "var(--gold-dark)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>{eyebrow}</div>
        <div className="dc-serif" style={{ fontSize: 26, fontWeight: 700 }}>{title}</div>
        {desc && <div style={{ fontSize: 13.5, color: "var(--ink-soft)", marginTop: 4 }}>{desc}</div>}
      </div>
      {right}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Clients list                                                          */
/* ---------------------------------------------------------------------- */
function ClientsList({ clients, onSelect, setPage, onAddClient, onBulkRemind, canManageClients }) {
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", company: "", phone: "" });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");
  const [reminding, setReminding] = useState(false);
  const [remindResult, setRemindResult] = useState("");
  const filtered = clients.filter(c => (c.name || "").toLowerCase().includes(q.toLowerCase()) || (c.company || "").toLowerCase().includes(q.toLowerCase()));
  const overdueCount = clients.filter(c => c.documents.some(d => d.status === "Overdue")).length;

  const remindOverdue = async () => {
    if (!onBulkRemind || reminding) return;
    setReminding(true);
    setRemindResult("");
    try {
      const data = await onBulkRemind();
      setRemindResult(`Reminded ${data?.sent || 0} client${data?.sent === 1 ? "" : "s"}`);
    } catch (error) {
      setRemindResult(error.message || "Couldn't send reminders");
    } finally {
      setReminding(false);
      setTimeout(() => setRemindResult(""), 3500);
    }
  };

  const submitAdd = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    setAdding(true);
    setAddError("");
    const email = form.email.trim();
    try {
      await onAddClient({ name: form.name.trim(), email, company: form.company.trim(), phone: form.phone.trim() });
      setForm({ name: "", email: "", company: "", phone: "" });
      setShowAdd(false);
      setAddSuccess(`Client added — invite email sent to ${email}`);
      setTimeout(() => setAddSuccess(""), 4500);
    } catch (error) {
      setAddError(error.message || "Couldn't add the client.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div>
      <SectionHeader eyebrow={`${clients.length} clients`} title="Clients" desc="Every client Clara is tracking documents for."
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {remindResult && <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{remindResult}</span>}
            {canManageClients && overdueCount > 0 && (
              <button className="dc-btn dc-btn-outline" onClick={remindOverdue} disabled={reminding}>
                <Bell size={15} /> {reminding ? "Sending..." : `Remind all overdue (${overdueCount})`}
              </button>
            )}
            {canManageClients && <button className="dc-btn dc-btn-outline" onClick={() => setShowAdd(!showAdd)}><Plus size={15} /> Add client</button>}
            <button className="dc-btn dc-btn-gold" onClick={() => setPage("builder")}><Plus size={15} /> New request</button>
          </div>
        } />
      {addSuccess && <div style={{ color: "var(--green)", fontSize: 12.5, marginBottom: 12 }}>✓ {addSuccess}</div>}
      {showAdd && (
        <div className="dc-card" style={{ marginBottom: 16 }}>
          <div className="dc-serif" style={{ fontWeight: 600, marginBottom: 12 }}>Add a client</div>
          <form onSubmit={submitAdd}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label className="dc-label">Name</label>
                <input className="dc-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Client name" required />
              </div>
              <div>
                <label className="dc-label">Email</label>
                <input className="dc-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="client@company.com" required />
              </div>
              <div>
                <label className="dc-label">Company</label>
                <input className="dc-input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Company (optional)" />
              </div>
              <div>
                <label className="dc-label">Phone</label>
                <input className="dc-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(555) 000-0000 (optional)" />
              </div>
            </div>
            {addError && <div style={{ color: "var(--red)", fontSize: 12.5, marginBottom: 10 }}>{addError}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="dc-btn dc-btn-primary dc-btn-sm" disabled={adding}>{adding ? "Adding..." : "Add client"}</button>
              <button type="button" className="dc-btn dc-btn-ghost dc-btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
      <div className="dc-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: 14, borderBottom: "1px solid var(--line)", position: "relative" }}>
          <Search size={15} style={{ position: "absolute", left: 26, top: 26, color: "var(--ink-faint)" }} />
          <input className="dc-input" style={{ paddingLeft: 34, maxWidth: 300 }} placeholder="Search clients..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="dc-table">
            <thead>
              <tr>
                <th>Client</th><th className="dc-hide-mobile">Company</th><th>Status</th>
                <th className="dc-hide-mobile">Missing</th><th className="dc-hide-mobile">Last contacted</th><th className="dc-hide-mobile">Next follow-up</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const missing = c.documents.filter(d => ["Requested","Overdue","Rejected"].includes(d.status)).length;
                return (
                  <tr key={c.id} onClick={() => onSelect(c.id)}>
                    <td><strong>{c.name}</strong><div style={{ fontSize: 12, color: "var(--ink-faint)" }}>{c.email}</div></td>
                    <td className="dc-hide-mobile">{c.company}</td>
                    <td><StatusStamp status={c.status} /></td>
                    <td className="dc-hide-mobile">{missing}</td>
                    <td className="dc-hide-mobile dc-mono" style={{ fontSize: 12 }}>{c.lastContacted}</td>
                    <td className="dc-hide-mobile dc-mono" style={{ fontSize: 12 }}>{c.nextFollowUp}</td>
                    <td><ChevronRight size={15} color="var(--ink-faint)" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Client chat (firm side)                                               */
/* ---------------------------------------------------------------------- */
function ChatThread({ thread, mineIs, emptyText }) {
  const scrollRef = useRef(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [thread.length]);
  return (
    <div ref={scrollRef} className="dc-scroll" style={{ maxHeight: 260, overflowY: "auto", padding: "4px 2px", marginBottom: 10 }}>
      {thread.length === 0 && <div style={{ fontSize: 12.5, color: "var(--ink-faint)", textAlign: "center", padding: "18px 0" }}>{emptyText}</div>}
      {thread.map((m) => {
        const mine = m.from === mineIs;
        return (
          <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 8 }}>
            <div style={{
              maxWidth: "82%", padding: "8px 12px", borderRadius: 10, fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap",
              background: mine ? "var(--ink)" : "var(--bg-alt)",
              color: mine ? "#F6F3EA" : "var(--ink)",
            }}>
              <div className="dc-mono" style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".06em", opacity: .65, marginBottom: 2 }}>
                {m.authorName} · {new Date(m.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} {new Date(m.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </div>
              {m.text}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ClientChat({ client }) {
  const [thread, setThread] = useState(client.messages || []);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = () => apiRequest(`/api/clients/${client.id}/messages`)
      .then((data) => { if (active) setThread(data.messages || []); })
      .catch(() => {});
    load();
    const timer = setInterval(load, 20000);
    return () => { active = false; clearInterval(timer); };
  }, [client.id]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      const data = await apiRequest(`/api/clients/${client.id}/messages`, { method: "POST", body: { text: text.trim() } });
      setThread(data.messages || []);
      setText("");
    } catch (err) {
      setError(err.message || "Couldn't send — are you signed in?");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="dc-card">
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
        <MessageSquare size={15} color="var(--gold-dark)" />
        <span className="dc-serif" style={{ fontWeight: 600 }}>Messages with {client.name.split(" ")[0]}</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-faint)", marginBottom: 10 }}>Chat directly instead of emailing — {client.name.split(" ")[0]} sees and replies to these in their portal, and gets an email nudge for each new message.</div>
      <ChatThread thread={thread} mineIs="firm" emptyText="No messages yet — say hello." />
      <div style={{ display: "flex", gap: 8 }}>
        <input className="dc-input" placeholder={`Message ${client.name.split(" ")[0]}...`} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <button className="dc-btn dc-btn-primary" onClick={send} disabled={sending}><Send size={14} /></button>
      </div>
      {error && <div style={{ color: "var(--red)", fontSize: 12, marginTop: 6 }}>{error}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Client profile                                                        */
/* ---------------------------------------------------------------------- */
function DocPreview({ url, authed, authHeader, fileName, mimeType }) {
  const [state, setState] = useState({ status: "loading", url: null });

  useEffect(() => {
    if (!url) return undefined;
    let active = true;
    let objectUrl = null;
    setState({ status: "loading", url: null });
    (async () => {
      try {
        const res = authed
          ? await authedFetch(url)
          : await fetch(`${API_BASE_URL}${url}`, authHeader ? { headers: { Authorization: authHeader } } : undefined);
        if (!res.ok) throw new Error("preview fetch failed");
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (active) setState({ status: "ready", url: objectUrl });
      } catch {
        if (active) setState({ status: "error", url: null });
      }
    })();
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url, authed, authHeader]);

  const isImage = (mimeType || "").startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp)$/i.test(fileName || "");
  const isPdf = mimeType === "application/pdf" || /\.pdf$/i.test(fileName || "");
  if (!isImage && !isPdf) return null;
  if (state.status === "loading") return <div style={{ fontSize: 11.5, color: "var(--ink-faint)", padding: "6px 0" }}>Loading preview…</div>;
  if (state.status === "error") return null;
  return isImage
    ? <img src={state.url} alt={fileName} style={{ maxWidth: "100%", maxHeight: 240, borderRadius: 8, border: "1px solid var(--line)", marginTop: 8, display: "block" }} />
    : (
      <iframe
        src={`${state.url}#toolbar=0&navpanes=0`}
        title={fileName}
        style={{ width: "100%", height: 280, border: "1px solid var(--line)", borderRadius: 8, marginTop: 8, background: "var(--bg-alt)" }}
      />
    );
}

function DocVersionHistory({ versions, downloadFile }) {
  const [open, setOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(null);
  return (
    <div style={{ marginTop: 5 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ fontSize: 11.5, color: "var(--ink-faint)", background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}
      >
        {open ? "Hide" : "Show"} {versions.length} earlier version{versions.length === 1 ? "" : "s"}
      </button>
      {open && (
        <div style={{ marginTop: 6, paddingLeft: 10, borderLeft: "2px solid var(--line)" }}>
          {[...versions].reverse().map((v, i) => (
            <div key={i} style={{ padding: "4px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 11.5, color: "var(--ink-soft)" }}>
                <span>{v.uploadedFile} {v.uploadedAt ? `· ${new Date(v.uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}</span>
                <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                  <button
                    onClick={() => setPreviewIndex(previewIndex === i ? null : i)}
                    style={{ fontSize: 11.5, color: "var(--ink-faint)", background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}
                  >
                    {previewIndex === i ? "Hide" : "Preview"}
                  </button>
                  <button
                    onClick={() => downloadFile(v)}
                    style={{ fontSize: 11.5, color: "var(--gold-dark)", background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}
                  >
                    Download
                  </button>
                </div>
              </div>
              {previewIndex === i && <DocPreview url={v.uploadedUrl} authed={true} fileName={v.uploadedFile} mimeType={v.uploadedMimeType} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ClientProfile({ client, updateClient, onBack, onRemoveClient, setPage, canManageClients }) {
  const [tone, setTone] = useState("Friendly");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState("");
  const [selectedDocs, setSelectedDocs] = useState(() => new Set());
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");

  const handleRemove = async () => {
    if (!onRemoveClient) return;
    setRemoving(true);
    setRemoveError("");
    try {
      await onRemoveClient(client.id);
    } catch (error) {
      setRemoveError(error.message || "Couldn't remove this client.");
      setRemoving(false);
    }
  };

  const missing = client.documents.filter(d => ["Requested","Overdue","Rejected"].includes(d.status));

  const toggleDocSelected = (docId) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  const bulkSetStatus = (status) => {
    if (!canManageClients || selectedDocs.size === 0) return;
    updateClient({
      ...client,
      documents: client.documents.map(d => selectedDocs.has(d.id) ? { ...d, status } : d),
    });
    setSelectedDocs(new Set());
  };
  const reminders = client.reminders || { enabled: false, cadenceDays: 7, tone: "Friendly" };

  const saveReminders = (patch) => {
    if (!canManageClients) return;
    updateClient({ ...client, reminders: { ...reminders, ...patch } });
  };

  const emailDraft = async () => {
    if (!draft.trim() || !canManageClients) return;
    setSending(true);
    setSendResult("");
    try {
      const data = await apiRequest(`/api/clients/${client.id}/send-followup`, { method: "POST", body: { message: draft } });
      if (data.client) updateClient(data.client);
      setSendResult(`Sent to ${client.email}`);
    } catch (error) {
      setSendResult(error.message || "Send failed");
    } finally {
      setSending(false);
      setTimeout(() => setSendResult(""), 3500);
    }
  };

  const setDocStatus = (docId, status) => {
    if (!canManageClients) return;
    updateClient({
      ...client,
      documents: client.documents.map(d => d.id === docId ? { ...d, status } : d),
    });
  };

  const generateFollowUp = async () => {
    if (!canManageClients) return;
    setLoading(true);
    const system = "You are Clara, an AI Client Documentation Assistant working for a bookkeeping/accounting firm. You write client follow-up messages that are professional, polite, organized, and persistent — never robotic or annoying. Keep messages concise (under 120 words), and end with a light call to action to use the secure upload link. Return only the message text, no subject line, no preamble.";
    const missingNames = missing.map(d => d.name).join(", ") || "a few remaining items";
    const userMsg = `Draft a ${tone.toLowerCase()} follow-up message to ${client.name} at ${client.company}. Missing documents: ${missingNames}. Next follow-up date: ${client.nextFollowUp}.`;
    const text = await askClara(system, [{ role: "user", content: userMsg }]);
    setDraft(text);
    setLoading(false);
  };

  const copyDraft = () => { navigator.clipboard.writeText(draft); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  const downloadFile = async (doc) => {
    try {
      if (doc.uploadedUrl.startsWith("http")) {
        window.open(doc.uploadedUrl, "_blank");
        return;
      }
      const res = await authedFetch(doc.uploadedUrl);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = doc.uploadedFile || "document";
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      window.alert("Couldn't download that file — it may have been removed.");
    }
  };
  const sharePortalLink = async () => {
    if (!canManageClients) return;
    const token = client.portalToken || `${client.id}-secure-token`;
    const slug = client.portalSlug || createPortalSlug(client);
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
    const link = `${origin}/p/${encodeURIComponent(slug)}/${token}`;
    navigator.clipboard.writeText(link);
    try {
      await apiRequest("/api/email", {
        method: "POST",
        body: {
          to: client.email,
          subject: `Secure portal link for ${client.name}`,
          html: `<p>Open your secure portal here: <a href="${link}">${link}</a></p>`,
        },
      });
    } catch {
      // fall back silently if email is unavailable
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1800);
  };

  return (
    <div>
      <button className="dc-btn dc-btn-ghost dc-btn-sm" style={{ marginBottom: 16 }} onClick={onBack}><ChevronLeft size={13} /> All clients</button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: confirmingRemove ? 14 : 22, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="dc-serif" style={{ fontSize: 26, fontWeight: 700 }}>{client.name}</div>
          <div style={{ fontSize: 13.5, color: "var(--ink-soft)", display: "flex", gap: 14, marginTop: 6, flexWrap: "wrap" }}>
            <span><Building2 size={13} style={{ verticalAlign: -2 }} /> {client.company}</span>
            <span><Mail size={13} style={{ verticalAlign: -2 }} /> {client.email}</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <StatusStamp status={client.status} />
          {canManageClients && !confirmingRemove && (
            <button
              className="dc-btn dc-btn-ghost dc-btn-sm"
              title="Remove client"
              style={{ color: "var(--ink-faint)" }}
              onClick={() => setConfirmingRemove(true)}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {canManageClients && confirmingRemove && (
        <div className="dc-card" style={{ borderColor: "var(--red)", marginBottom: 22 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>Remove {client.name}?</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 10 }}>
            This permanently deletes their document checklist, uploads, and message history, and disables their portal link. This can't be undone.
          </div>
          {removeError && <div style={{ color: "var(--red)", fontSize: 12, marginBottom: 8 }}>{removeError}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="dc-btn dc-btn-sm" style={{ background: "var(--red)", borderColor: "var(--red)", color: "#fff" }} onClick={handleRemove} disabled={removing}>
              {removing ? "Removing..." : "Yes, remove client"}
            </button>
            <button className="dc-btn dc-btn-ghost dc-btn-sm" onClick={() => { setConfirmingRemove(false); setRemoveError(""); }} disabled={removing}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginBottom: 16, alignItems: "start" }}>
        <div className="dc-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <FileStack size={15} color="var(--gold-dark)" />
                <span className="dc-serif" style={{ fontWeight: 600 }}>Document checklist</span>
              </div>
              {canManageClients && selectedDocs.size > 0 && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="dc-btn dc-btn-outline dc-btn-sm" onClick={() => bulkSetStatus("Approved")}>Approve selected ({selectedDocs.size})</button>
                  <button className="dc-btn dc-btn-ghost dc-btn-sm" onClick={() => bulkSetStatus("Rejected")}>Reject selected ({selectedDocs.size})</button>
                </div>
              )}
            </div>

            {client.documents.length === 0 && (
              <div style={{ fontSize: 13, color: "var(--ink-faint)", padding: "4px 0 8px" }}>No documents requested yet.</div>
            )}

            {client.documents.length > 0 && (() => {
              const total = client.documents.length;
              const done = client.documents.filter(d => ["Received", "In review", "Approved"].includes(d.status)).length;
              const pct = Math.round((done / total) * 100);
              return (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--ink-soft)", marginBottom: 5 }}>
                    <span>{done} of {total} received</span>
                    <span>{pct}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: "var(--bg-alt)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: "var(--gold-dark)", transition: "width .3s ease" }} />
                  </div>
                </div>
              );
            })()}

            {client.documents.map(d => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "11px 0", borderBottom: "1px solid var(--line)", gap: 10, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: "1 1 320px", minWidth: 0 }}>
                  {canManageClients && (
                    <input type="checkbox" style={{ marginTop: 4 }} checked={selectedDocs.has(d.id)} onChange={() => toggleDocSelected(d.id)} />
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: 13.5 }}>{d.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>{d.category}{d.dueDate ? ` · due ${d.dueDate}` : ""}{d.note ? ` — ${d.note}` : ""}</div>
                    {d.uploadedUrl && (
                      <button
                        onClick={() => downloadFile(d)}
                        style={{ fontSize: 11.5, color: "var(--gold-dark)", display: "inline-block", marginTop: 4, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}
                      >
                        Download uploaded file
                      </button>
                    )}
                    {d.uploadedUrl && <DocPreview url={d.uploadedUrl} authed={true} fileName={d.uploadedFile} mimeType={d.uploadedMimeType} />}
                    {d.linkUrl && (
                      <div style={{ marginTop: 4 }}>
                        <a href={d.linkUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, color: "var(--gold-dark)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Link2 size={12} /> Open Google Doc <ExternalLink size={11} />
                        </a>
                      </div>
                    )}
                    {d.aiClassificationFlag?.suggested && (
                      <div style={{ fontSize: 11.5, color: "var(--red)", marginTop: 4 }}>
                        Clara thinks this might actually be "{d.aiClassificationFlag.suggested}" — worth a look.
                      </div>
                    )}
                    {d.versions?.length > 0 && <DocVersionHistory versions={d.versions} downloadFile={downloadFile} />}
                  </div>
                </div>
                <select className="dc-select" style={{ width: "auto", minWidth: 140, fontSize: 12.5, flexShrink: 0 }} value={d.status} onChange={(e) => setDocStatus(d.id, e.target.value)} disabled={!canManageClients}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            ))}
        </div>

        <ClientChat client={client} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
        <div>
          <div className="dc-card">
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
              <Clock size={15} color="var(--gold-dark)" />
              <span className="dc-serif" style={{ fontWeight: 600 }}>Communication history</span>
            </div>
            {client.log.length === 0 && <div style={{ fontSize: 13, color: "var(--ink-faint)" }}>No communication logged yet.</div>}
            {client.log.map((l, i) => (
              <div key={i} style={{ fontSize: 13, padding: "9px 0", borderBottom: "1px solid var(--line)" }}>
                <span className="dc-mono" style={{ color: "var(--ink-faint)", fontSize: 11.5 }}>{l.date} · {l.type}</span>
                <div style={{ color: "var(--ink-soft)", marginTop: 2 }}>{l.note}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="dc-card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
              <Sparkles size={15} color="var(--gold-dark)" />
              <span className="dc-serif" style={{ fontWeight: 600 }}>Clara's follow-up</span>
            </div>
            <label className="dc-label">Tone</label>
            <select className="dc-select" style={{ marginBottom: 12 }} value={tone} onChange={(e) => setTone(e.target.value)}>
              <option>Friendly</option><option>Professional</option><option>Firm</option><option>Urgent</option>
            </select>
            <button className="dc-btn dc-btn-primary dc-btn-sm" style={{ width: "100%", justifyContent: "center", marginBottom: 12 }} onClick={generateFollowUp} disabled={loading || !canManageClients}>
              {loading ? <><Loader2 size={13} className="dc-spin" style={{ animation: "spin 1s linear infinite" }} /> Generating...</> : <>Generate follow-up</>}
            </button>
            {draft && (
              <>
                <textarea className="dc-textarea" style={{ minHeight: 140, fontSize: 13, lineHeight: 1.5 }} value={draft} onChange={(e) => setDraft(e.target.value)} />
                <button className="dc-btn dc-btn-gold dc-btn-sm" style={{ width: "100%", justifyContent: "center", marginTop: 10 }} onClick={emailDraft} disabled={sending || !canManageClients}>
                  <Send size={13} /> {sending ? "Sending..." : "Email to client"}
                </button>
                <button className="dc-btn dc-btn-outline dc-btn-sm" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} onClick={copyDraft}>
                  <Copy size={13} /> {copied ? "Copied!" : "Copy message"}
                </button>
                {sendResult && <div style={{ fontSize: 12.5, marginTop: 8, textAlign: "center", color: sendResult.startsWith("Sent") ? "var(--green)" : "var(--red)" }}>{sendResult}</div>}
              </>
            )}
          </div>

          <div className="dc-card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
              <Bell size={15} color="var(--gold-dark)" />
              <span className="dc-serif" style={{ fontWeight: 600 }}>Automatic reminders</span>
            </div>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13, cursor: canManageClients ? "pointer" : "default", color: "var(--ink-soft)", lineHeight: 1.5 }}>
              <input type="checkbox" checked={reminders.enabled} onChange={(e) => saveReminders({ enabled: e.target.checked })} disabled={!canManageClients} style={{ marginTop: 3 }} />
              <span>Let Clara chase outstanding documents automatically — drafted, emailed, and logged without you lifting a finger.</span>
            </label>
            {reminders.enabled && (
              <>
                <label className="dc-label" style={{ marginTop: 12 }}>Frequency</label>
                <select className="dc-select" value={reminders.cadenceDays || 7} onChange={(e) => saveReminders({ cadenceDays: Number(e.target.value) })} disabled={!canManageClients}>
                  <option value={3}>Every 3 days</option>
                  <option value={7}>Weekly</option>
                  <option value={14}>Every 2 weeks</option>
                </select>
                <label className="dc-label" style={{ marginTop: 10 }}>Tone</label>
                <select className="dc-select" value={reminders.tone || "Friendly"} onChange={(e) => saveReminders({ tone: e.target.value })} disabled={!canManageClients}>
                  <option>Friendly</option><option>Professional</option><option>Firm</option><option>Urgent</option>
                </select>
                <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 10, lineHeight: 1.5 }}>
                  {reminders.nextSendAt
                    ? `Next reminder: ${new Date(reminders.nextSendAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                    : "First reminder goes out within ~15 minutes when documents are outstanding."}
                  {(reminders.sentCount || 0) >= 6 && " Paused after 6 reminders without a response — sending a manual follow-up resumes the schedule."}
                </div>
              </>
            )}
          </div>

          {client.recurring?.enabled && (
            <div className="dc-card" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                <Bell size={15} color="var(--gold-dark)" />
                <span className="dc-serif" style={{ fontWeight: 600 }}>Recurring requests</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>
                "{client.recurring.title}" regenerates <strong>{client.recurring.cadence}</strong>.<br />
                Next run: {new Date(client.recurring.nextRunAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                {client.recurring.lastRunAt && <>, last sent {new Date(client.recurring.lastRunAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</>}.
              </div>
              <button
                className="dc-btn dc-btn-ghost dc-btn-sm"
                style={{ width: "100%", justifyContent: "center", marginTop: 12 }}
                onClick={() => updateClient({ ...client, recurring: { ...client.recurring, enabled: false } })}
                disabled={!canManageClients}
              >
                Stop recurring
              </button>
            </div>
          )}

          <div className="dc-card">
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
              <Link2 size={15} color="var(--gold-dark)" />
              <span className="dc-serif" style={{ fontWeight: 600 }}>Client portal</span>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 12 }}>Share a secure link for {client.name} to upload documents directly.</div>
            <button className="dc-btn dc-btn-gold dc-btn-sm" style={{ width: "100%", justifyContent: "center", marginBottom: 8 }} onClick={sharePortalLink} disabled={!canManageClients}>
              <Send size={13} /> {linkCopied ? "Link shared!" : "Send request link"}
            </button>
            <button className="dc-btn dc-btn-ghost dc-btn-sm" style={{ width: "100%", justifyContent: "center" }} onClick={() => setPage("portal")}>
              Preview as client
            </button>
          </div>
        </div>
      </div>

      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Document request builder                                              */
/* ---------------------------------------------------------------------- */
function RequestBuilder({ clients, addRequest, setRecurringChecklist, canManageClients }) {
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [period, setPeriod] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [notes, setNotes] = useState("");
  const [template, setTemplate] = useState("");
  const [items, setItems] = useState([]);
  const [customItem, setCustomItem] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [confirmedRecurring, setConfirmedRecurring] = useState(false);
  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [cadence, setCadence] = useState("monthly");

  const applyTemplate = (t) => {
    setTemplate(t);
    setTitle(t);
    setItems(TEMPLATES[t] ? TEMPLATES[t].map((n, i) => ({ id: `n${i}`, name: n })) : []);
  };

  const addCustom = () => {
    if (!customItem.trim()) return;
    setItems([...items, { id: `custom-${Date.now()}`, name: customItem.trim() }]);
    setCustomItem("");
  };

  const submit = () => {
    if (!canManageClients || !clientId || !title || items.length === 0) return;
    addRequest(clientId, title, dueDate, items, { period, priority, notes });
    if (recurringEnabled) {
      const nextRunAt = new Date();
      nextRunAt.setMonth(nextRunAt.getMonth() + (cadence === "quarterly" ? 3 : 1));
      setRecurringChecklist(clientId, {
        enabled: true,
        cadence,
        title,
        priority,
        notes,
        items: items.map((it) => ({ name: it.name })),
        createdAt: new Date().toISOString(),
        lastRunAt: null,
        nextRunAt: nextRunAt.toISOString(),
      });
    }
    setConfirmed(true);
    setConfirmedRecurring(recurringEnabled);
    setTimeout(() => setConfirmed(false), 2500);
    setTitle(""); setDueDate(""); setPeriod(""); setNotes(""); setItems([]); setTemplate("");
    setRecurringEnabled(false); setCadence("monthly");
  };

  return (
    <div>
      <SectionHeader eyebrow="New request" title="Document request builder" desc="Start from a reusable template or build a custom checklist." />
      {!canManageClients && <div className="dc-card" style={{ marginBottom: 16, borderColor: "var(--gold-dark)" }}>Members can review request templates, but only owners and admins can create or send new document requests.</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 16 }}>
        <div className="dc-card">
          <div className="dc-serif" style={{ fontWeight: 600, marginBottom: 14 }}>Templates</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.keys(TEMPLATES).map(t => (
              <div key={t} onClick={() => applyTemplate(t)}
                style={{ padding: "10px 12px", borderRadius: 7, border: `1px solid ${template === t ? "var(--gold-dark)" : "var(--line)"}`, background: template === t ? "var(--gold-bg)" : "transparent", cursor: "pointer", fontSize: 13.5, fontWeight: 500 }}>
                {t} <span style={{ color: "var(--ink-faint)", fontSize: 11.5, fontWeight: 400 }}>({TEMPLATES[t].length} items)</span>
              </div>
            ))}
          </div>
        </div>

        <div className="dc-card">
          <div className="dc-serif" style={{ fontWeight: 600, marginBottom: 14 }}>Request details</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label className="dc-label">Client</label>
              <select className="dc-select" value={clientId} onChange={(e) => setClientId(e.target.value)} disabled={!canManageClients}>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="dc-label">Priority</label>
              <select className="dc-select" value={priority} onChange={(e) => setPriority(e.target.value)} disabled={!canManageClients}>
                <option>Low</option><option>Normal</option><option>High</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="dc-label">Request title</label>
            <input className="dc-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. June bookkeeping close" disabled={!canManageClients} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label className="dc-label">Due date</label>
              <input className="dc-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={!canManageClients} />
            </div>
            <div>
              <label className="dc-label">Tax year / period</label>
              <input className="dc-input" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="e.g. Q2 2026" disabled={!canManageClients} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="dc-label">Notes to client</label>
            <textarea className="dc-textarea" style={{ minHeight: 60 }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional message shown in the portal" disabled={!canManageClients} />
          </div>

          <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 7, border: "1px solid var(--line)" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: canManageClients ? "pointer" : "default" }}>
              <input type="checkbox" checked={recurringEnabled} onChange={(e) => setRecurringEnabled(e.target.checked)} disabled={!canManageClients} />
              <span>Repeat automatically for retainer clients (bookkeeping close, payroll, etc.)</span>
            </label>
            {recurringEnabled && (
              <select className="dc-select" style={{ marginTop: 8 }} value={cadence} onChange={(e) => setCadence(e.target.value)} disabled={!canManageClients}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            )}
          </div>

          <label className="dc-label">Checklist items</label>
          {items.map(it => (
            <div key={it.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", fontSize: 13, borderBottom: "1px solid var(--line)" }}>
              {it.name}
              <X size={13} style={{ cursor: "pointer", color: "var(--ink-faint)" }} onClick={() => setItems(items.filter(i => i.id !== it.id))} />
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input className="dc-input" placeholder="Add custom item..." value={customItem} onChange={(e) => setCustomItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCustom()} />
            <button className="dc-btn dc-btn-ghost dc-btn-sm" onClick={addCustom} disabled={!canManageClients}><Plus size={13} /></button>
          </div>

          <button className="dc-btn dc-btn-gold" style={{ width: "100%", justifyContent: "center", marginTop: 18 }} onClick={submit} disabled={!canManageClients || !clientId || !title || items.length === 0}>
            Create request
          </button>
          {confirmed && (
            <div style={{ textAlign: "center", color: "var(--green)", fontSize: 12.5, marginTop: 8 }}>
              ✓ Request created and added to client checklist{confirmedRecurring ? " — set to repeat automatically" : ""}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Client Portal (simulated client-facing view)                          */
/* ---------------------------------------------------------------------- */
function ClientPortalLanding({ client, onContinue }) {
  return (
    <div style={{ maxWidth: 680, margin: "40px auto", padding: 24 }}>
      <div className="dc-card" style={{ textAlign: "center", padding: 32, border: "2px solid var(--ink)" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}><Logo size={30} /></div>
        <div style={{ padding: "10px 14px", borderRadius: 999, background: "var(--gold-bg)", color: "var(--gold-dark)", display: "inline-block", fontSize: 12.5, fontWeight: 700, marginBottom: 12, letterSpacing: ".06em", textTransform: "uppercase" }}>
          Secure upload portal
        </div>
        <div className="dc-serif" style={{ fontSize: 28, fontWeight: 700, marginBottom: 10 }}>{client?.company || "Your firm"}</div>
        <div style={{ fontSize: 14.5, color: "var(--ink-soft)", marginBottom: 18, lineHeight: 1.6 }}>
          Please continue to upload your documents and leave a message for {client?.name || "your accountant"}. Everything is sent securely through your firm’s portal.
        </div>
        <button className="dc-btn dc-btn-primary" onClick={onContinue}>Continue to portal</button>
      </div>
    </div>
  );
}

function PortalChat({ portalConfig, initialMessages, firmLabel }) {
  const [thread, setThread] = useState(initialMessages || []);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!portalConfig) return;
    let active = true;
    const load = () => fetch(`${API_BASE_URL}${portalConfig.mePath}`, portalConfig.authHeader ? { headers: { Authorization: portalConfig.authHeader } } : undefined)
      .then((res) => res.json())
      .then((data) => { if (active && data.client) setThread(data.client.messages || []); })
      .catch(() => {});
    load();
    const timer = setInterval(load, 20000);
    return () => { active = false; clearInterval(timer); };
  }, [portalConfig?.mePath, portalConfig?.authHeader]);

  const send = async () => {
    if (!text.trim() || sending || !portalConfig) return;
    setSending(true);
    try {
      const headers = { "Content-Type": "application/json" };
      if (portalConfig.authHeader) headers.Authorization = portalConfig.authHeader;
      const res = await fetch(`${API_BASE_URL}${portalConfig.actionBase}/message`, {
        method: "POST",
        headers,
        body: JSON.stringify({ text: text.trim() }),
      });
      const data = await res.json();
      if (res.ok) { setThread(data.messages || []); setText(""); }
    } catch {
      // leave the text in place so the client can retry
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ marginTop: 16 }}>
      <label className="dc-label">Messages</label>
      <div style={{ fontSize: 12, color: "var(--ink-faint)", marginBottom: 8 }}>Questions about what to upload? Message {firmLabel} directly — no email needed.</div>
      <ChatThread thread={thread} mineIs="client" emptyText="No messages yet." />
      <div style={{ display: "flex", gap: 8 }}>
        <input className="dc-input" placeholder="Type a message..." value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <button className="dc-btn dc-btn-primary" onClick={send} disabled={sending}><Send size={14} /></button>
      </div>
    </div>
  );
}

function ClientPortal({ clients, clientId, setClientId, updateClient, publicPortal = false, portalClientOverride = null, portalAccess = null, portalSessionToken = null, onPortalLoginSaved = null, onPortalLogout = null }) {
  const [localClient, setLocalClient] = useState(portalClientOverride);
  useEffect(() => { setLocalClient(portalClientOverride); }, [portalClientOverride?.id]);
  const client = publicPortal ? (localClient || portalClientOverride) : (clients.find(c => c.id === clientId) || clients[0] || null);
  const portalConfig = publicPortal ? getPortalRequestConfig(portalAccess, portalSessionToken) : null;
  const [showLanding, setShowLanding] = useState(publicPortal);
  const [uploads, setUploads] = useState({});
  const [uploadError, setUploadError] = useState("");
  const [generalUploadStatus, setGeneralUploadStatus] = useState("idle");
  const [linkState, setLinkState] = useState({});
  const [loginSetup, setLoginSetup] = useState({ password: "", confirm: "", status: "idle", error: "" });

  const patchDoc = (docId, patch) => {
    const nextClient = { ...client, documents: client.documents.map(d => d.id === docId ? { ...d, ...patch } : d) };
    if (publicPortal) setLocalClient(nextClient);
    else updateClient(nextClient);
    return nextClient;
  };

  const setDocStatus = async (docId, status) => {
    patchDoc(docId, { status });
    if (publicPortal && portalConfig && status === "Not applicable") {
      try {
        const headers = { "Content-Type": "application/json" };
        if (portalConfig.authHeader) headers.Authorization = portalConfig.authHeader;
        await fetch(`${API_BASE_URL}${portalConfig.actionBase}/doc-status`, {
          method: "POST",
          headers,
          body: JSON.stringify({ docId, status }),
        });
      } catch {
        // keep the optimistic local update; the firm still sees the upload log
      }
    }
  };

  const handleUpload = async (docId, event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadError("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("docId", docId);

    try {
      let res;
      if (publicPortal && portalConfig) {
        const headers = portalConfig.authHeader ? { Authorization: portalConfig.authHeader } : undefined;
        res = await fetch(`${API_BASE_URL}${portalConfig.actionBase}/upload`, { method: "POST", body: formData, headers });
      } else {
        res = await authedFetch("/api/uploads", { method: "POST", body: formData });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setUploads((prev) => ({ ...prev, [docId]: data.fileName }));
      patchDoc(docId, {
        status: "Received",
        uploadedAt: new Date().toISOString(),
        uploadedFile: data.fileName,
        uploadedMimeType: data.mimeType || null,
        ...(data.url ? { uploadedUrl: data.url, uploadedFileKey: data.fileKey, uploadedStoragePath: data.storagePath || null } : {}),
      });
    } catch (error) {
      setUploadError(error.message || "Upload failed");
    }
  };

  const handleGeneralUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadError("");
    setGeneralUploadStatus("uploading");

    const formData = new FormData();
    formData.append("file", file);

    try {
      let res;
      if (publicPortal && portalConfig) {
        const headers = portalConfig.authHeader ? { Authorization: portalConfig.authHeader } : undefined;
        res = await fetch(`${API_BASE_URL}${portalConfig.actionBase}/upload`, { method: "POST", body: formData, headers });
      } else {
        res = await authedFetch("/api/uploads", { method: "POST", body: formData });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      if (data.client) {
        if (publicPortal) setLocalClient(data.client);
        else updateClient(data.client);
      }
      setGeneralUploadStatus("done");
      setTimeout(() => setGeneralUploadStatus("idle"), 3000);
    } catch (error) {
      setUploadError(error.message || "Upload failed");
      setGeneralUploadStatus("idle");
    }
  };

  const toggleLinkInput = (key) => {
    setLinkState((prev) => ({ ...prev, [key]: { ...(prev[key] || { value: "", saving: false, error: "" }), open: !prev[key]?.open } }));
  };

  const setLinkValue = (key, value) => {
    setLinkState((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), value } }));
  };

  const submitLink = async (docId) => {
    const key = docId || "__general__";
    const url = (linkState[key]?.value || "").trim();
    if (!url || !portalConfig) return;
    setLinkState((prev) => ({ ...prev, [key]: { ...prev[key], saving: true, error: "" } }));
    try {
      const headers = { "Content-Type": "application/json" };
      if (portalConfig.authHeader) headers.Authorization = portalConfig.authHeader;
      const res = await fetch(`${API_BASE_URL}${portalConfig.actionBase}/link`, {
        method: "POST",
        headers,
        body: JSON.stringify(docId ? { docId, url } : { url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save that link.");
      if (data.client) {
        if (publicPortal) setLocalClient(data.client);
        else updateClient(data.client);
      }
      setLinkState((prev) => ({ ...prev, [key]: { open: false, value: "", saving: false, error: "" } }));
    } catch (error) {
      setLinkState((prev) => ({ ...prev, [key]: { ...prev[key], saving: false, error: error.message || "Couldn't save that link." } }));
    }
  };

  const setupPersistentLogin = async () => {
    if (!portalConfig) return;
    if (loginSetup.password.length < 8) {
      setLoginSetup((p) => ({ ...p, status: "error", error: "Password must be at least 8 characters." }));
      return;
    }
    if (loginSetup.password !== loginSetup.confirm) {
      setLoginSetup((p) => ({ ...p, status: "error", error: "Passwords don't match." }));
      return;
    }
    setLoginSetup((p) => ({ ...p, status: "saving", error: "" }));
    try {
      const res = await fetch(`${API_BASE_URL}${portalConfig.actionBase}/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: loginSetup.password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not set up your login.");
      onPortalLoginSaved?.(data.token, data.client);
      setLoginSetup({ password: "", confirm: "", status: "done", error: "" });
    } catch (error) {
      setLoginSetup((p) => ({ ...p, status: "error", error: error.message || "Could not set up your login." }));
    }
  };

  if (!client) {
    return (
      <div>
        {!publicPortal && <SectionHeader eyebrow="Preview" title="Client portal preview" desc="This is what your client sees when they open their secure link." />}
        <div className="dc-card" style={{ maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
          <div className="dc-serif" style={{ fontWeight: 700, fontSize: 22, marginBottom: 8 }}>No client loaded yet</div>
          <div style={{ fontSize: 13.5, color: "var(--ink-soft)" }}>The portal preview will appear here once a client is available.</div>
        </div>
      </div>
    );
  }

  if (showLanding && publicPortal) {
    return <ClientPortalLanding client={client} onContinue={() => setShowLanding(false)} />;
  }

  return (
    <div>
      {!publicPortal && (
        <SectionHeader eyebrow="Preview" title="Client portal preview" desc="This is what your client sees when they open their secure link."
          right={
            <select className="dc-select" style={{ width: "auto" }} value={client.id} onChange={(e) => setClientId(e.target.value)}>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          } />
      )}

      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div className="dc-card" style={{ border: "2px solid var(--ink)", marginBottom: 16 }}>
          <div style={{ padding: "12px 14px", borderRadius: 12, background: "var(--gold-bg)", border: "1px solid var(--line)", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Logo size={24} />
                <div style={{ textAlign: "left" }}>
                  <div className="dc-serif" style={{ fontSize: 16, fontWeight: 700 }}>{client.company || "Your firm"}</div>
                  <div style={{ fontSize: 12.2, color: "var(--ink-soft)" }}>Secure upload portal</div>
                </div>
              </div>
              <div className="dc-mono" style={{ fontSize: 11, color: "var(--gold-dark)", textTransform: "uppercase", letterSpacing: ".08em" }}>Powered by ClientFlow</div>
            </div>
          </div>
          <div style={{ textAlign: "center", marginBottom: 18 }}>
            <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 4 }}>Prepared for <strong>{client.name}</strong> — {client.company}</div>
          </div>
          <div className="dc-card" style={{ background: "var(--bg-alt)", border: "none", marginBottom: 0, fontSize: 13, color: "var(--ink-soft)" }}>
            Hi {client.name.split(" ")[0]}, please upload the items below when you get a chance. If something doesn't apply to you, just mark it "Not applicable."
          </div>

          {client.documents.length > 0 && (() => {
            const total = client.documents.filter(d => d.status !== "Not applicable").length || client.documents.length;
            const done = client.documents.filter(d => ["Received", "In review", "Approved"].includes(d.status)).length;
            const pct = Math.round((done / total) * 100);
            return (
              <div style={{ marginTop: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--ink-soft)", marginBottom: 6 }}>
                  <span>{done} of {total} documents received</span>
                  <span>{pct}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: "var(--bg-alt)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: "var(--gold-dark)", transition: "width .3s ease" }} />
                </div>
              </div>
            );
          })()}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16, marginBottom: 16, alignItems: "start" }}>
        <div className="dc-card">
          <div className="dc-serif" style={{ fontWeight: 600, marginBottom: 14 }}>Documents</div>
          {client.documents.map(d => (
            <div key={d.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{d.name}</div>
                <StatusStamp status={d.status} />
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <label className="dc-btn dc-btn-outline dc-btn-sm" style={{ flex: 1, justifyContent: "center", cursor: "pointer", minWidth: 140 }}>
                  <Upload size={13} /> {uploads[d.id] ? "Uploaded" : "Upload"}
                  <input type="file" style={{ display: "none" }} onChange={(event) => handleUpload(d.id, event)} />
                </label>
                <button className="dc-btn dc-btn-outline dc-btn-sm" onClick={() => toggleLinkInput(d.id)}><Link2 size={13} /> Google Docs</button>
                <button className="dc-btn dc-btn-ghost dc-btn-sm" onClick={() => setDocStatus(d.id, "Not applicable")}><MinusCircle size={13} /> N/A</button>
              </div>
              {linkState[d.id]?.open && (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <input
                    className="dc-input" placeholder="Paste a Google Docs, Sheets, or Drive link"
                    value={linkState[d.id]?.value || ""}
                    onChange={(e) => setLinkValue(d.id, e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitLink(d.id)}
                  />
                  <button className="dc-btn dc-btn-primary dc-btn-sm" onClick={() => submitLink(d.id)} disabled={linkState[d.id]?.saving}>
                    {linkState[d.id]?.saving ? "Saving..." : "Save"}
                  </button>
                </div>
              )}
              {linkState[d.id]?.error && <div style={{ color: "var(--red)", fontSize: 11.5, marginTop: 4 }}>{linkState[d.id].error}</div>}
              {d.uploadedFile && (
                <div style={{ marginTop: 7 }}>
                  <div style={{ fontSize: 11.5, color: "var(--green)" }}>Saved file: {d.uploadedFile}</div>
                  {d.uploadedFileKey && portalConfig && (
                    <DocPreview
                      url={`${portalConfig.actionBase}/files/${encodeURIComponent(d.uploadedFileKey)}`}
                      authed={false}
                      authHeader={portalConfig.authHeader}
                      fileName={d.uploadedFile}
                      mimeType={d.uploadedMimeType}
                    />
                  )}
                </div>
              )}
              {d.linkUrl && (
                <div style={{ marginTop: 7, fontSize: 11.5 }}>
                  <a href={d.linkUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold-dark)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Link2 size={12} /> Open Google Doc <ExternalLink size={11} />
                  </a>
                </div>
              )}
            </div>
          ))}

          {publicPortal && portalConfig && (
            <div className="dc-card" style={{ background: "var(--bg-alt)", border: "none", marginTop: 4, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Have something else to share?</div>
              <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 10 }}>Upload any file, or share a Google Docs/Sheets link, even if it's not on the list above.</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <label className="dc-btn dc-btn-outline dc-btn-sm" style={{ cursor: "pointer" }}>
                  <Upload size={13} /> {generalUploadStatus === "uploading" ? "Uploading..." : generalUploadStatus === "done" ? "Uploaded" : "Upload a file"}
                  <input type="file" style={{ display: "none" }} onChange={handleGeneralUpload} disabled={generalUploadStatus === "uploading"} />
                </label>
                <button className="dc-btn dc-btn-outline dc-btn-sm" onClick={() => toggleLinkInput("__general__")}><Link2 size={13} /> Google Docs link</button>
              </div>
              {linkState.__general__?.open && (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <input
                    className="dc-input" placeholder="Paste a Google Docs, Sheets, or Drive link"
                    value={linkState.__general__?.value || ""}
                    onChange={(e) => setLinkValue("__general__", e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitLink(null)}
                  />
                  <button className="dc-btn dc-btn-primary dc-btn-sm" onClick={() => submitLink(null)} disabled={linkState.__general__?.saving}>
                    {linkState.__general__?.saving ? "Saving..." : "Save"}
                  </button>
                </div>
              )}
              {linkState.__general__?.error && <div style={{ color: "var(--red)", fontSize: 11.5, marginTop: 4 }}>{linkState.__general__.error}</div>}
            </div>
          )}
          {uploadError && <div style={{ color: "var(--red)", fontSize: 12.5, marginTop: 8 }}>{uploadError}</div>}
        </div>

        <div className="dc-card">
          <PortalChat
            portalConfig={portalConfig}
            initialMessages={client.messages || []}
            firmLabel={client.company || "your firm"}
          />
        </div>
        </div>

        {publicPortal && portalSessionToken && (
          <div style={{ marginTop: 16, textAlign: "center" }}>
            <button className="dc-btn dc-btn-ghost dc-btn-sm" onClick={onPortalLogout}>Log out</button>
          </div>
        )}

        {publicPortal && !portalSessionToken && portalConfig && (
          <div className="dc-card" style={{ background: "var(--bg-alt)", border: "none", marginTop: 16 }}>
            {loginSetup.status === "done" ? (
              <div style={{ fontSize: 12.5, color: "var(--green)" }}>
                ✓ Persistent login set up — next time, sign in at <strong>/portal/login</strong> with {client.email} instead of using this link.
              </div>
            ) : (
              <>
                <div className="dc-serif" style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 4 }}>Set up a persistent login</div>
                <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 10 }}>
                  Repeat client? Set a password once and sign in directly next time instead of needing a new link each visit.
                </div>
                <div style={{ display: "grid", gap: 8, maxWidth: 420 }}>
                  <input
                    className="dc-input" type="password" placeholder="Create a password"
                    value={loginSetup.password}
                    onChange={(e) => setLoginSetup((p) => ({ ...p, password: e.target.value }))}
                  />
                  <input
                    className="dc-input" type="password" placeholder="Confirm password"
                    value={loginSetup.confirm}
                    onChange={(e) => setLoginSetup((p) => ({ ...p, confirm: e.target.value }))}
                  />
                  <button className="dc-btn dc-btn-outline dc-btn-sm" onClick={setupPersistentLogin} disabled={loginSetup.status === "saving"}>
                    {loginSetup.status === "saving" ? "Saving..." : "Set up login"}
                  </button>
                  {loginSetup.error && <div style={{ color: "var(--red)", fontSize: 12 }}>{loginSetup.error}</div>}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Clara Assistant chat                                                  */
/* ---------------------------------------------------------------------- */
function ClaraChat({ clients }) {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi, I'm Clara. Ask me who owes documents, request a follow-up draft, or have me summarize your client statuses." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  const suggestions = ["Who still owes bank statements?", "Which clients are overdue?", "Summarize missing documents for all clients.", "Write a firmer second reminder for Sarah."];

  const send = async (text) => {
    const content = text ?? input;
    if (!content.trim()) return;
    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    const system = `You are Clara, an AI Client Documentation Assistant for a bookkeeping/accounting firm. You speak in a professional bookkeeping/accounting tone: organized, precise, warm but not chatty. You have access to the firm's current client document data as JSON below — use it to answer questions accurately. When asked to draft messages, keep them under 120 words and end with a light call to action.\n\nCLIENT DATA:\n${JSON.stringify(clientsSummaryForAI(clients))}`;
    const apiMessages = next.map(m => ({ role: m.role, content: m.content }));
    const reply = await askClara(system, apiMessages);
    setMessages(m => [...m, { role: "assistant", content: reply }]);
    setLoading(false);
  };

  return (
    <div>
      <SectionHeader eyebrow="AI employee" title="Clara" desc="Ask about client status, or have Clara draft a message." />
      <div className="dc-card" style={{ padding: 0, display: "flex", flexDirection: "column", height: "60vh", maxHeight: 620 }}>
        <div ref={scrollRef} className="dc-scroll" style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 12 }}>
              <div style={{
                maxWidth: "78%", padding: "10px 14px", borderRadius: 12, fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-wrap",
                background: m.role === "user" ? "var(--ink)" : "var(--bg-alt)",
                color: m.role === "user" ? "#F6F3EA" : "var(--ink)",
              }}>
                {m.role === "assistant" && <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}><Sparkles size={11} color="var(--gold-dark)" /><span className="dc-mono" style={{ fontSize: 10, color: "var(--gold-dark)", textTransform: "uppercase" }}>Clara</span></div>}
                {m.content}
              </div>
            </div>
          ))}
          {loading && <div style={{ fontSize: 12.5, color: "var(--ink-faint)", display: "flex", alignItems: "center", gap: 6 }}><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Clara is typing...</div>}
        </div>
        <div style={{ padding: 14, borderTop: "1px solid var(--line)" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {suggestions.map(s => (
              <button key={s} className="dc-btn dc-btn-ghost dc-btn-sm" onClick={() => send(s)}>{s}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="dc-input" placeholder="Ask Clara anything..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
            <button className="dc-btn dc-btn-primary" onClick={() => send()} disabled={loading}><Send size={14} /></button>
          </div>
        </div>
      </div>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Main App                                                              */
/* ---------------------------------------------------------------------- */
export default function App() {
  const savedState = getSavedState();
  const savedAuth = getSavedAuth();
  const savedPortalAuth = getSavedPortalAuth();
  const initialPortalRoute = getPortalRouteFromLocation();
  const initialPortalLoginRoute = getPortalLoginRouteFromLocation();
  const [resetToken, setResetToken] = useState(() => getResetTokenFromLocation());
  const [verifyToken, setVerifyToken] = useState(() => getVerifyTokenFromLocation());
  const [staticPage, setStaticPage] = useState(() => getStaticPageFromLocation());
  const [view, setView] = useState(savedState?.view || (initialPortalLoginRoute ? "portal-login" : ((initialPortalRoute || savedPortalAuth?.token) ? "portal-public" : "landing"))); // landing | login | app | portal-public | portal-login
  const [page, setPage] = useState(savedState?.page || ((initialPortalRoute || savedPortalAuth?.token) ? "portal" : "dashboard"));
  const [portalLoginRoute, setPortalLoginRoute] = useState(initialPortalLoginRoute);
  const [portalSessionAuth, setPortalSessionAuth] = useState(savedPortalAuth);
  const [clients, setClients] = useState(() => normalizeClients(savedState?.clients || initialClients));
  const [selectedId, setSelectedId] = useState(savedState?.selectedId || null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [portalClientId, setPortalClientId] = useState(savedState?.portalClientId || initialClients[0].id);
  const [authUser, setAuthUser] = useState(savedAuth?.user || null);
  const [authReady, setAuthReady] = useState(Boolean(savedAuth));
  const canManageTeam = ["owner", "admin"].includes(authUser?.role || "owner");
  const [portalRoute, setPortalRoute] = useState(initialPortalRoute);
  const [portalClientData, setPortalClientData] = useState(null);
  const [portalError, setPortalError] = useState("");
  const [teamMembers, setTeamMembers] = useState(savedAuth?.team || []);
  const [invitations, setInvitations] = useState(savedAuth?.invitations || []);
  const [billingSummary, setBillingSummary] = useState(savedAuth?.billingSummary || null);
  const [invoices, setInvoices] = useState(savedAuth?.invoices || []);
  const [activityLog, setActivityLog] = useState(savedAuth?.activityLog || []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ view, page, clients, selectedId, portalClientId }));
    }
  }, [view, page, clients, selectedId, portalClientId]);

  useEffect(() => {
    setPortalRoute(getPortalRouteFromLocation());
    setPortalLoginRoute(getPortalLoginRouteFromLocation());
  }, []);

  useEffect(() => {
    if (portalRoute) {
      setView("portal-public");
      setPage("portal");
    }
  }, [portalRoute]);

  useEffect(() => {
    if (portalLoginRoute) setView("portal-login");
  }, [portalLoginRoute]);

  useEffect(() => {
    if (!portalRoute) return;
    let active = true;
    fetch(`${API_BASE_URL}/api/portal/${encodeURIComponent(portalRoute.identifier)}/${portalRoute.token}`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data.client) {
          setPortalClientData(data.client);
        } else {
          setPortalError(data.error || "Portal link is invalid");
        }
      })
      .catch(() => {
        if (active) setPortalError("Unable to load portal link");
      });
    return () => { active = false; };
  }, [portalRoute?.clientId, portalRoute?.token]);

  // Resume a persistent client login (no magic link in the URL, just a saved session token).
  useEffect(() => {
    if (portalRoute || !portalSessionAuth?.token) return;
    let active = true;
    fetch(`${API_BASE_URL}/api/portal/session/me`, { headers: { Authorization: `Bearer ${portalSessionAuth.token}` } })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!active) return;
        if (ok && data.client) {
          setPortalClientData(data.client);
        } else {
          clearPortalAuth();
          setPortalSessionAuth(null);
          setPortalError(data.error || "Your session has expired. Please sign in again.");
        }
      })
      .catch(() => {
        if (active) setPortalError("Unable to load your portal session.");
      });
    return () => { active = false; };
  }, [portalRoute, portalSessionAuth?.token]);

  useEffect(() => {
    if (!savedAuth?.token) {
      setAuthReady(true);
      return;
    }

    let active = true;
    apiRequest("/api/me")
      .then((data) => {
        if (!active) return;
        setAuthUser(data.user);
        setClients(normalizeClients(data.clients));
        setTeamMembers(data.team || []);
        setInvitations(data.invitations || []);
        setBillingSummary(data.billingSummary || null);
        setInvoices(data.invoices || []);
        setActivityLog(data.activityLog || []);
        setView("app");
        setPage("dashboard");
        setAuthReady(true);
      })
      .catch(() => {
        if (!active) return;
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(AUTH_STORAGE_KEY);
        }
        setAuthUser(null);
        setView("login");
        setAuthReady(true);
      });

    return () => {
      active = false;
    };
  }, [savedAuth?.token]);

  const persistClient = (client) => {
    if (!authUser?.id) return;
    // Chat messages are managed by their own endpoints — never send a possibly-stale copy
    const { messages, ...rest } = client;
    apiRequest(`/api/clients/${client.id}`, { method: "PUT", body: { client: rest } }).catch(() => {});
  };

  const updateClient = (updated) => {
    setClients((cs) => cs.map((c) => c.id === updated.id ? updated : c));
    persistClient(updated);
  };

  const removeClient = async (clientId) => {
    const data = await apiRequest(`/api/clients/${clientId}`, { method: "DELETE" });
    setClients(normalizeClients(data.clients || []));
  };

  const handlePortalLoginSubmit = async ({ email, password }) => {
    const res = await fetch(`${API_BASE_URL}/api/portal/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Invalid email or password.");
    savePortalAuth(data.token, data.client);
    setPortalSessionAuth({ token: data.token, client: data.client });
    setPortalClientData(data.client);
    setPortalError("");
    if (typeof window !== "undefined") window.history.replaceState({}, "", "/");
    setPortalLoginRoute(false);
    setView("portal-public");
    setPage("portal");
  };

  const handlePortalLoginSaved = (token, client) => {
    savePortalAuth(token, client);
    setPortalSessionAuth({ token, client });
  };

  const handlePortalLogout = () => {
    clearPortalAuth();
    setPortalSessionAuth(null);
    setPortalClientData(null);
    setPortalError("");
    if (typeof window !== "undefined") window.history.replaceState({}, "", "/");
    setPortalRoute(null);
    setView("landing");
    setPage("dashboard");
  };

  const setRecurringChecklist = (clientId, config) => {
    setClients((cs) => {
      let updatedClient = null;
      const next = cs.map((c) => {
        if (c.id !== clientId) return c;
        updatedClient = { ...c, recurring: config };
        return updatedClient;
      });
      if (updatedClient) persistClient(updatedClient);
      return next;
    });
  };

  const bulkRemindOverdue = async () => {
    const data = await apiRequest("/api/clients/bulk-remind", { method: "POST" });
    if (data?.clients) setClients(normalizeClients(data.clients));
    return data;
  };

  const addClient = async (info) => {
    if (authUser?.id) {
      const data = await apiRequest("/api/clients", { method: "POST", body: { client: info } });
      setClients((prev) => [...prev, data.client]);
      return data.client;
    }
    const local = {
      id: `c-${Date.now()}`,
      name: info.name, email: info.email, company: info.company || "", phone: info.phone || "",
      status: "Not requested", lastContacted: "—", nextFollowUp: "—", notes: "",
      documents: [], log: [],
    };
    setClients((prev) => [...prev, local]);
    return local;
  };

  const addRequest = (clientId, title, dueDate, items, { period, priority, notes } = {}) => {
    setClients((cs) => {
      let updatedClient = null;
      const next = cs.map((c) => {
        if (c.id !== clientId) return c;
        updatedClient = {
          ...c,
          documents: [...c.documents, ...items.map((it, i) => mkDoc(`${it.id}-${Date.now()}-${i}`, it.name, title, "Requested", "", dueDate || null))],
          log: [...c.log, {
            date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            type: "Request created",
            note: [
              `"${title}" checklist sent${dueDate ? ` (due ${dueDate})` : ""}${period ? ` for ${period}` : ""}.`,
              priority && priority !== "Normal" ? `Priority: ${priority}.` : "",
              notes ? `Note to client: ${notes}` : "",
            ].filter(Boolean).join(" "),
          }],
        };
        return updatedClient;
      });
      if (updatedClient) persistClient(updatedClient);
      return next;
    });
  };

  const handleAuthSubmit = async ({ mode, name, email, password }) => {
    if (mode === "forgot") {
      await apiRequest("/api/auth/forgot-password", { method: "POST", body: { email } });
      return;
    }
    const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
    const payload = mode === "signup" ? { name, email, password } : { email, password };
    const data = await apiRequest(endpoint, { method: "POST", body: payload });
    if (typeof window !== "undefined") {
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token: data.token, refreshToken: data.refreshToken, user: data.user }));
    }
    setAuthUser(data.user);
    setClients(normalizeClients(data.clients));
    setTeamMembers(data.team || []);
    setInvitations(data.invitations || []);
    setBillingSummary(data.billingSummary || null);
    setInvoices(data.invoices || []);
    setActivityLog(data.activityLog || []);
    setView("app");
    setPage("dashboard");
  };

  const handleLogout = () => {
    const auth = getSavedAuth();
    if (auth?.refreshToken) {
      apiRequest("/api/auth/logout", { method: "POST", body: { refreshToken: auth.refreshToken } }).catch(() => {});
    }
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }
    setAuthUser(null);
    setTeamMembers([]);
    setInvitations([]);
    setBillingSummary(null);
    setInvoices([]);
    setActivityLog([]);
    setView("landing");
    setPage("dashboard");
    setSelectedId(null);
  };

  const inviteTeammate = async (email, role = "member") => {
    if (!email) return null;
    const data = await apiRequest("/api/invites", { method: "POST", body: { email, role } });
    if (data?.invite) {
      setInvitations((prev) => [...prev, data.invite]);
    }
    return data;
  };

  const handleCheckout = async (plan) => {
    const data = await apiRequest("/api/billing/checkout", { method: "POST", body: { plan } });
    if (data?.billingSummary) setBillingSummary(data.billingSummary);
    if (data?.invoice) {
      setInvoices((prev) => [data.invoice, ...prev]);
    }
    if (data?.checkoutUrl) {
      window.alert(`Checkout started for ${plan}. Open ${data.checkoutUrl}`);
    }
  };

  if (staticPage) {
    return <LegalPage page={staticPage} onBack={() => {
      if (typeof window !== "undefined") window.history.replaceState({}, "", "/");
      setStaticPage(null);
    }} />;
  }

  if (verifyToken !== null) {
    return <VerifyEmail token={verifyToken} onDone={() => {
      if (typeof window !== "undefined") window.history.replaceState({}, "", "/");
      setVerifyToken(null);
      if (authUser) setAuthUser({ ...authUser, emailVerified: true });
    }} />;
  }

  if (resetToken !== null) {
    return <ResetPassword token={resetToken} onDone={() => {
      if (typeof window !== "undefined") window.history.replaceState({}, "", "/");
      setResetToken(null);
      setView("login");
    }} />;
  }

  if (!authReady) return null;
  if (view === "landing") return <Landing onStart={() => setView("login")} onDemo={() => { setClients(initialClients); setView("app"); setPage("dashboard"); }} onPortalLogin={() => { if (typeof window !== "undefined") window.history.pushState({}, "", "/portal/login"); setPortalLoginRoute(true); setView("portal-login"); }} />;
  if (view === "login") return <Login onSubmit={handleAuthSubmit} onBack={() => setView("landing")} />;
  if (view === "portal-login") return <PortalLogin onSubmit={handlePortalLoginSubmit} onBack={() => { if (typeof window !== "undefined") window.history.replaceState({}, "", "/"); setPortalLoginRoute(false); setView("landing"); }} />;

  const selectedClient = clients.find(c => c.id === selectedId);
  const isPortalSession = !portalRoute && Boolean(portalSessionAuth?.token);

  if ((portalRoute || isPortalSession) && portalClientData) {
    return (
      <div className="dc-root" style={{ padding: 24 }}>
        <style>{GLOBAL_CSS}</style>
        <ClientPortal
          clients={clients}
          clientId={portalClientData.id}
          setClientId={() => {}}
          updateClient={updateClient}
          publicPortal={true}
          portalClientOverride={portalClientData}
          portalAccess={portalRoute}
          portalSessionToken={isPortalSession ? portalSessionAuth.token : null}
          onPortalLoginSaved={handlePortalLoginSaved}
          onPortalLogout={handlePortalLogout}
        />
      </div>
    );
  }

  if ((portalRoute || isPortalSession) && portalError) {
    return (
      <div className="dc-root" style={{ padding: 24 }}>
        <style>{GLOBAL_CSS}</style>
        <div className="dc-card" style={{ maxWidth: 520, margin: "40px auto", textAlign: "center" }}>
          <div className="dc-serif" style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>{portalRoute ? "This portal link is no longer available" : "Your session has ended"}</div>
          <div style={{ color: "var(--ink-soft)", fontSize: 13.5, marginBottom: 16 }}>{portalError}</div>
          {isPortalSession && (
            <button className="dc-btn dc-btn-outline dc-btn-sm" onClick={() => { if (typeof window !== "undefined") window.history.pushState({}, "", "/portal/login"); setPortalLoginRoute(true); setView("portal-login"); }}>
              Sign in again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="dc-root" style={{ display: "flex" }}>
      <style>{GLOBAL_CSS}</style>
      <Sidebar page={page} setPage={(p) => { setPage(p); setSelectedId(null); }} onLogout={handleLogout} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} canManageTeam={canManageTeam} />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* mobile top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--line)" }} className="dc-mobile-bar">
          <Logo size={24} />
          <Menu size={20} style={{ cursor: "pointer" }} onClick={() => setMobileOpen(true)} />
        </div>
        <style>{"@media (min-width:861px){.dc-mobile-bar{display:none}}"}</style>

        <div className="dc-main" style={{ padding: 32, maxWidth: 1100 }}>
          {authUser && authUser.emailVerified === false && <VerifyEmailBanner />}
          {page === "dashboard" && <Dashboard clients={clients} setPage={setPage} setSelectedId={setSelectedId} authUser={authUser} team={teamMembers} invitations={invitations} onManageTeam={() => setPage("admin")} canManageTeam={canManageTeam} activityLog={activityLog} billingSummary={billingSummary} invoices={invoices} />}
          {page === "clients" && !selectedClient && <ClientsList clients={clients} onSelect={setSelectedId} setPage={setPage} onAddClient={addClient} onBulkRemind={bulkRemindOverdue} canManageClients={canManageTeam} />}
          {page === "clients" && selectedClient && (
            <ClientProfile client={selectedClient} updateClient={updateClient} onBack={() => setSelectedId(null)} onRemoveClient={async (id) => { await removeClient(id); setSelectedId(null); }} setPage={setPage} canManageClients={canManageTeam} />
          )}
          {page === "builder" && <RequestBuilder clients={clients} addRequest={addRequest} setRecurringChecklist={setRecurringChecklist} canManageClients={canManageTeam} />}
          {page === "admin" && <AdminSettings authUser={authUser} team={teamMembers} invitations={invitations} onInvite={inviteTeammate} canManageTeam={canManageTeam} />}
          {page === "clara" && <ClaraChat clients={clients} />}
          {page === "portal" && <ClientPortal clients={clients} clientId={portalClientId} setClientId={setPortalClientId} updateClient={updateClient} />}
          {page === "pricing" && (
            <div>
              <SectionHeader eyebrow="Plan & billing" title="Choose your plan" desc="All plans include Clara, your AI documentation assistant." />
              <PricingCards onStart={() => {}} onCheckout={handleCheckout} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
