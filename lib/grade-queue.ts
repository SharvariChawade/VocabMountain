"use client";

import type { Grade } from "@/generated/prisma/client";

export type PendingGrade = {
  id: string;
  wordId: string;
  grade: Grade;
  revealed: boolean;
  ms: number;
  hook?: string;
  gradedAt: string;
};

const KEY = "vm.grades.pending";
const MAX_BATCH = 200;
const FLUSH_AT = 10;
const IDLE_MS = 5000;
const MAX_BACKOFF_MS = 30_000;

let pending: PendingGrade[] = [];
let inFlight = false;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let failures = 0;
let started = false;

function persist() {
  try {
    if (pending.length) localStorage.setItem(KEY, JSON.stringify(pending));
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode / quota. The in-memory queue still flushes this session.
  }
}

function restore() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as PendingGrade[];
    if (!Array.isArray(saved)) return;
    const known = new Set(pending.map((g) => g.id));
    pending = [...saved.filter((g) => g?.id && !known.has(g.id)), ...pending];
  } catch {
    try {
      localStorage.removeItem(KEY);
    } catch {}
  }
}

function clearIdle() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
}

function scheduleIdle() {
  clearIdle();
  idleTimer = setTimeout(() => void flush(), IDLE_MS);
}

/** Push a grade and return immediately — a swipe never awaits the network. */
export function enqueueGrade(grade: PendingGrade) {
  pending.push(grade);
  persist();
  if (pending.length >= FLUSH_AT) void flush();
  else scheduleIdle();
}

/** Flush pending grades. Safe to call at any time; retries on failure, never drops. */
export async function flush(): Promise<void> {
  clearIdle();
  if (inFlight || pending.length === 0) return;

  const batch = pending.slice(0, MAX_BATCH);
  inFlight = true;
  try {
    const res = await fetch("/api/grades", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ grades: batch }),
      keepalive: true,
    });
    if (!res.ok) throw new Error(String(res.status));

    const sent = new Set(batch.map((g) => g.id));
    pending = pending.filter((g) => !sent.has(g.id));
    failures = 0;
    persist();
  } catch {
    failures += 1;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(
      () => void flush(),
      Math.min(1000 * 2 ** (failures - 1), MAX_BACKOFF_MS),
    );
  } finally {
    inFlight = false;
  }

  if (pending.length && failures === 0) await flush();
}

// Beacons can't be confirmed, so entries stay queued; the client-minted ids make
// the next mount's replay a no-op server-side.
function beacon() {
  if (!pending.length) return;
  const body = JSON.stringify({ grades: pending.slice(0, MAX_BATCH) });
  try {
    if (navigator.sendBeacon(new URL("/api/grades", location.origin), new Blob([body], { type: "application/json" }))) return;
  } catch {}
  void flush();
}

/** Attach lifecycle listeners and replay anything left over from a previous session. */
export function startGradeQueue(): () => void {
  restore();
  if (pending.length) void flush();

  if (started) return () => {};
  started = true;

  const onHide = () => {
    if (document.visibilityState === "hidden") beacon();
  };
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", beacon);

  return () => {
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("pagehide", beacon);
    started = false;
  };
}

export function pendingCount() {
  return pending.length;
}

/** Skip / bury. Not batched — different body shape, and it's one call per session at most. */
export async function bury(wordId: string): Promise<void> {
  try {
    await fetch("/api/grades", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wordId, bury: true }),
      keepalive: true,
    });
  } catch {
    // A missed bury just means the word comes back today. Not worth queueing.
  }
}
