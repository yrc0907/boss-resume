import { scoreJob } from "../shared/scoring";
import { DEFAULT_SETTINGS, type JobCandidate, type Settings } from "../shared/types";
import { getPlatformAdapter } from "./adapters";
import type { PlatformAdapter } from "./adapters/types";
import { findMatchingBossJob, mergeJobCandidate } from "./boss-api";
import { parseCardJob } from "./dom-parser";
import { extractPlatformJobs } from "./platform-api";

const marked = new Set<Element>();
const matchedJobs = new Map<Element, JobCandidate>();
const apiJobs = new Map<string, JobCandidate>();
let settings: Settings = DEFAULT_SETTINGS;
let matchCount = 0;
let lastCardCount = 0;
let lastScanAt = "";
let preloadRunning = false;
let lastSelectorHits: Record<string, number> = {};
let pageObserver: MutationObserver | null = null;
let routeWatcherInstalled = false;
let lastRouteKey = "";
const adapter: PlatformAdapter | null = getPlatformAdapter(location.hostname);

/** Boss 页面内容脚本：只读取岗位卡片并提供本地筛选/排队按钮，不执行发送动作。 */
void init();

async function init(): Promise<void> {
  if (!adapter) return;
  settings = await chrome.runtime.sendMessage<Settings>({ type: "GET_SETTINGS" });
  window.addEventListener("message", onPageBridgeMessage);
  window.postMessage({ source: "boss-job-helper-content", type: "READY" }, location.origin);
  installRouteWatcher();
  syncRouteUi();
  window.setInterval(() => { if (isAllowedPage()) scanCards(); }, 2500);
  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    const type = (message as { type?: string }).type;
    if (type === "SETTINGS_UPDATED") {
      settings = (message as { settings: Settings }).settings;
      resetDecorations();
      scanCards();
      return;
    }
    if (type === "GET_CONTENT_STATUS") {
      sendResponse({ platform: adapter.label, adapterKey: adapter.key, route: `${location.origin}${location.pathname}`, cardCount: lastCardCount, matchCount, lastScanAt, selectorHits: lastSelectorHits });
    }
  });
}

function isAllowedPage(): boolean {
  if (!adapter?.routes) return Boolean(adapter);
  return [...adapter.routes.list, ...adapter.routes.detail].some((route) => route.test(location.pathname));
}

/** 监听招聘网站 SPA 路由变化，岗位页显示工具条，聊天/个人页自动移除。 */
function installRouteWatcher(): void {
  if (routeWatcherInstalled) return;
  routeWatcherInstalled = true;
  for (const method of ["pushState", "replaceState"] as const) {
    const original = history[method];
    try {
      history[method] = function routeAwareHistory(this: History, ...args: Parameters<History[typeof method]>): void {
        original.apply(this, args);
        window.setTimeout(syncRouteUi, 0);
      } as History[typeof method];
    } catch {
      // 某些页面可能冻结 history 方法，保留 popstate 监听作为降级路径。
    }
  }
  window.addEventListener("popstate", () => window.setTimeout(syncRouteUi, 0));
  window.addEventListener("hashchange", () => window.setTimeout(syncRouteUi, 0));
}

function syncRouteUi(): void {
  const currentRouteKey = `${location.pathname}${location.search}`;
  if (isListPage() && lastRouteKey && lastRouteKey !== currentRouteKey && wasListRoute(lastRouteKey)) {
    apiJobs.clear();
    resetDecorations();
  }
  lastRouteKey = currentRouteKey;
  if (!isAllowedPage()) {
    document.querySelectorAll(".bjh-toolbar").forEach((node) => node.remove());
    pageObserver?.disconnect();
    pageObserver = null;
    return;
  }
  injectToolbar();
  if (adapter?.detail && isDetailPage()) injectDetailToolbar();
  if (!pageObserver) {
    pageObserver = new MutationObserver(() => scanCards());
    pageObserver.observe(document.body, { childList: true, subtree: true });
  }
  scanCards();
}

function isListPage(): boolean {
  return Boolean(adapter?.routes?.list.some((route) => route.test(location.pathname)));
}

function wasListRoute(routeKey: string): boolean {
  const path = routeKey.split("?", 1)[0];
  return Boolean(adapter?.routes?.list.some((route) => route.test(path)));
}

function scanCards(): void {
  if (!adapter) return;
  const cards = Array.from(new Set(adapter.cardSelectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)))));
  lastSelectorHits = Object.fromEntries(adapter.cardSelectors.map((selector) => [selector, document.querySelectorAll(selector).length]));
  lastCardCount = cards.length;
  lastScanAt = new Date().toISOString();
  matchCount = document.querySelectorAll(".bjh-job-match").length;
  for (const card of cards) {
    const job = parseJob(card);
    if (!job || marked.has(card)) continue;
    marked.add(card);
    job.score = scoreJob(job, settings);
    if (job.score >= settings.minScore && !containsBlacklist(job)) {
      matchCount += 1;
      matchedJobs.set(card, job);
      decorateCard(card, job);
    } else {
      card.classList.add("bjh-job-muted");
    }
  }
  updateToolbarCount(matchCount);
}

function parseJob(card: Element): JobCandidate | null {
  if (!adapter) return null;
  const domJob = parseCardJob(card, adapter, location.href);
  if (!domJob) return null;
  const apiJob = adapter.key === "zhipin" ? findMatchingBossJob(domJob, apiJobs.values()) : null;
  return apiJob ? mergeJobCandidate(domJob, apiJob) : domJob;
}

function containsBlacklist(job: JobCandidate): boolean {
  const text = `${job.title} ${job.company} ${job.description}`.toLowerCase();
  return settings.blacklist.some((word) => text.includes(word.toLowerCase()));
}

function decorateCard(card: Element, job: JobCandidate): void {
  card.classList.add("bjh-job-match");
  const badge = document.createElement("span");
  badge.className = "bjh-match-badge";
  badge.textContent = `匹配 ${job.score}`;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "bjh-queue-button";
  button.textContent = "加入投递准备";
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    button.disabled = true;
    try {
      const response = await chrome.runtime.sendMessage<unknown>({ type: "ADD_TO_QUEUE", job: { ...job, status: "queued" } });
      if (isErrorResponse(response)) throw new Error(response.error);
      button.textContent = isQueueMutation(response) && !response.added ? "已在队列" : "已加入队列";
      button.classList.add("is-added");
    } catch (error) {
      button.disabled = false;
      button.textContent = error instanceof Error ? error.message : "加入失败";
    }
  });
  const action = document.createElement("div");
  action.className = "bjh-card-actions";
  action.append(badge, button);
  card.append(action);
}

function injectToolbar(): void {
  if (document.querySelector(".bjh-toolbar")) return;
  const toolbar = document.createElement("aside");
  toolbar.className = "bjh-toolbar";
  toolbar.innerHTML = `<strong>${adapter?.label ?? "投递准备"}</strong><span class="bjh-toolbar-count">扫描中</span><button type="button" class="bjh-load-more">加载更多岗位</button><button type="button" class="bjh-add-all">加入全部匹配</button><button type="button" class="bjh-refresh">重新扫描</button>`;
  toolbar.querySelector(".bjh-load-more")?.addEventListener("click", () => void preloadJobs());
  toolbar.querySelector(".bjh-add-all")?.addEventListener("click", () => void addAllMatched());
  toolbar.querySelector(".bjh-refresh")?.addEventListener("click", () => {
    resetDecorations();
    scanCards();
  });
  document.body.append(toolbar);
}

function resetDecorations(): void {
  marked.clear();
  matchedJobs.clear();
  document.querySelectorAll(".bjh-card-actions, .bjh-match-badge").forEach((node) => node.remove());
  document.querySelectorAll(".bjh-job-match, .bjh-job-muted").forEach((node) => node.classList.remove("bjh-job-match", "bjh-job-muted"));
}

/** 将当前页面已经通过筛选的岗位批量加入本地队列，避免逐卡点击但不触发任何外部投递。 */
async function addAllMatched(): Promise<void> {
  const button = document.querySelector(".bjh-add-all") as HTMLButtonElement | null;
  if (!button || !matchedJobs.size) return;
  button.disabled = true;
  const jobs = Array.from(matchedJobs.values());
  let added = 0;
  for (const job of jobs) {
    const response = await chrome.runtime.sendMessage<unknown>({ type: "ADD_TO_QUEUE", job: { ...job, status: "queued" } });
    if (!isErrorResponse(response) && isQueueMutation(response) && response.added) added += 1;
  }
  button.textContent = `已加入 ${added} 条`;
  window.setTimeout(() => {
    button.disabled = false;
    button.textContent = "加入全部匹配";
  }, 1800);
}

/** 逐步滚动触发招聘网站懒加载，达到稳定次数后自动停止，不触发任何投递动作。 */
async function preloadJobs(): Promise<void> {
  const button = document.querySelector(".bjh-load-more") as HTMLButtonElement | null;
  if (!button || preloadRunning) return;
  preloadRunning = true;
  button.disabled = true;
  const initialCount = lastCardCount;
  let stableRounds = 0;
  let previousCount = initialCount;
  try {
    for (let round = 0; round < 40; round += 1) {
      window.scrollBy({ top: Math.max(320, Math.floor(window.innerHeight * 0.9)), behavior: "smooth" });
      await sleep(450);
      scanCards();
      if (lastCardCount === previousCount) stableRounds += 1;
      else stableRounds = 0;
      previousCount = lastCardCount;
      if (stableRounds >= 3) break;
    }
    button.textContent = `已加载 ${lastCardCount} 个`;
  } finally {
    window.setTimeout(() => {
      preloadRunning = false;
      button.disabled = false;
      button.textContent = "加载更多岗位";
    }, 1800);
  }
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function isErrorResponse(value: unknown): value is { error: string } {
  return typeof value === "object" && value !== null && "error" in value && typeof (value as { error?: unknown }).error === "string";
}

function isQueueMutation(value: unknown): value is { queue: unknown[]; added: boolean } {
  return typeof value === "object" && value !== null && "added" in value && typeof (value as { added?: unknown }).added === "boolean" && "queue" in value;
}

function updateToolbarCount(count: number): void {
  const node = document.querySelector(".bjh-toolbar-count");
  if (node) node.textContent = lastCardCount ? `${count} 个匹配岗位` : `${adapter?.label ?? "当前页面"} 未识别岗位卡片`;
}

/** 接收页面主世界的只读岗位接口事件，更新本地数据池后重新绑定当前卡片。 */
function onPageBridgeMessage(event: MessageEvent<unknown>): void {
  const message = event.data as { source?: string; type?: string; url?: string; payload?: unknown } | null;
  if (event.source !== window || event.origin !== location.origin || message?.source !== "boss-job-helper-page" || message.type !== "JOB_API_RESPONSE") return;
  const jobs = extractPlatformJobs(adapter?.key || "", message.payload, message.url || location.href);
  if (!jobs.length) return;
  let changed = false;
  for (const job of jobs) {
    const previous = apiJobs.get(job.id);
    if (!previous || previous.description !== job.description || previous.salary !== job.salary) {
      apiJobs.set(job.id, job);
      changed = true;
    }
  }
  if (changed) {
    resetDecorations();
    scanCards();
    updateDetailToolbar();
  }
}

function isDetailPage(): boolean {
  return /^\/job_detail(?:\/|$)/.test(location.pathname);
}

/** 详情页只读诊断：展示岗位信息和沟通/网申状态，提供加入本地队列按钮。 */
function injectDetailToolbar(): void {
  if (document.querySelector(".bjh-detail-toolbar") || !adapter?.detail) return;
  const toolbar = document.createElement("aside");
  toolbar.className = "bjh-toolbar bjh-detail-toolbar";
  toolbar.innerHTML = `<strong>岗位详情</strong><span class="bjh-detail-status">读取中</span><button type="button" class="bjh-detail-queue">加入投递准备</button>`;
  const queueButton = toolbar.querySelector(".bjh-detail-queue") as HTMLButtonElement | null;
  queueButton?.addEventListener("click", async () => {
    const job = parseDetailJob();
    if (!job) return;
    queueButton.disabled = true;
    const response = await chrome.runtime.sendMessage<unknown>({ type: "ADD_TO_QUEUE", job });
    if (isErrorResponse(response)) {
      queueButton.disabled = false;
      queueButton.textContent = response.error;
      return;
    }
    queueButton.textContent = "已加入队列";
  });
  document.body.append(toolbar);
  updateDetailToolbar();
}

function updateDetailToolbar(): void {
  const status = document.querySelector(".bjh-detail-status");
  if (!status) return;
  const job = parseDetailJob();
  if (!job) {
    status.textContent = "未识别岗位详情";
    return;
  }
  const actionText = adapter?.detail?.action.map((selector) => document.querySelector(selector)?.textContent?.trim() || "").find(Boolean) || "";
  status.textContent = `${job.title} · ${job.applicationType === "chat" ? "可沟通" : job.applicationType === "application" ? "可能网申" : "需人工确认"}`;
}

function parseDetailJob(): JobCandidate | null {
  if (!adapter?.detail) return null;
  const read = (selectors: string[]): string => selectors.map((selector) => document.querySelector(selector)?.textContent?.trim() || "").find(Boolean)?.replace(/\s+/g, " ") || "";
  const title = read(adapter.detail.title);
  const company = read(adapter.detail.company);
  if (!title || !company) return null;
  const apiJob = Array.from(apiJobs.values()).find((job) => job.title === title && job.company === company);
  const job: JobCandidate = {
    id: apiJob?.id || `${location.origin}${location.pathname}`,
    title,
    company,
    salary: read(adapter.detail.salary),
    location: read(adapter.detail.location),
    experience: "",
    education: "",
    tags: [],
    detailUrl: location.href,
    description: read(adapter.detail.description),
    score: 0,
    status: "new",
    capturedAt: new Date().toISOString(),
    platform: adapter.key,
    recruiter: read(adapter.detail.recruiter),
    activeTime: read(adapter.detail.activeTime),
    source: apiJob ? "merged" : "dom",
    sourceUrl: location.href,
    applicationType: read(adapter.detail.action).includes("立即沟通") ? "chat" : read(adapter.detail.action) ? "application" : "unknown",
  };
  job.score = scoreJob(job, settings);
  return job;
}
