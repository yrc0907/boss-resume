import { scoreJob } from "../shared/scoring";
import { DEFAULT_SETTINGS, type JobCandidate, type Settings } from "../shared/types";
import { getPlatformAdapter } from "./adapters";
import type { PlatformAdapter } from "./adapters/types";
import { extractBossJobs, findMatchingBossJob, mergeJobCandidate } from "./boss-api";

const marked = new Set<Element>();
const matchedJobs = new Map<Element, JobCandidate>();
const apiJobs = new Map<string, JobCandidate>();
let settings: Settings = DEFAULT_SETTINGS;
let matchCount = 0;
const adapter: PlatformAdapter | null = getPlatformAdapter(location.hostname);

/** Boss 页面内容脚本：只读取岗位卡片并提供本地筛选/排队按钮，不执行发送动作。 */
void init();

async function init(): Promise<void> {
  if (!adapter) return;
  settings = await chrome.runtime.sendMessage<Settings>({ type: "GET_SETTINGS" });
  window.addEventListener("message", onPageBridgeMessage);
  window.postMessage({ source: "boss-job-helper-content", type: "READY" }, location.origin);
  injectToolbar();
  scanCards();
  if (adapter.detail && isDetailPage()) injectDetailToolbar();
  const observer = new MutationObserver(() => scanCards());
  observer.observe(document.body, { childList: true, subtree: true });
  window.setInterval(scanCards, 2500);
  chrome.runtime.onMessage.addListener((message: unknown) => {
    if ((message as { type?: string }).type !== "SETTINGS_UPDATED") return;
    settings = (message as { settings: Settings }).settings;
    resetDecorations();
    scanCards();
  });
}

function scanCards(): void {
  if (!adapter) return;
  const cards = Array.from(new Set(adapter.cardSelectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)))));
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
  const read = (...selectors: string[]): string => {
    for (const selector of selectors) {
      const value = card.querySelector(selector)?.textContent?.trim();
      if (value) return value.replace(/\s+/g, " ");
    }
    return "";
  };
  const title = read(...adapter.fields.title);
  const company = read(...adapter.fields.company);
  if (!title || !company) return null;
  const detailUrl = (card.querySelector("a[href]") as HTMLAnchorElement | null)?.href ?? location.href;
  const domJob: JobCandidate = {
    id: card.getAttribute("data-job-id") || card.getAttribute("data-id") || detailUrl,
    title,
    company,
    salary: read(...adapter.fields.salary),
    location: read(...adapter.fields.location),
    experience: read(...adapter.fields.experience),
    education: read(...adapter.fields.education),
    tags: adapter.fields.tags.flatMap((selector) => Array.from(card.querySelectorAll(selector))).map((item) => item.textContent?.trim() || "").filter(Boolean),
    detailUrl,
    description: read(...adapter.fields.description) || card.textContent?.trim() || "",
    score: 0,
    status: "new",
    capturedAt: new Date().toISOString(),
    platform: adapter.key,
    source: "dom",
    sourceUrl: location.href,
  };
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
      button.textContent = "已加入队列";
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
  toolbar.innerHTML = `<strong>${adapter?.label ?? "投递准备"}</strong><span class="bjh-toolbar-count">扫描中</span><button type="button" class="bjh-add-all">加入全部匹配</button><button type="button" class="bjh-refresh">重新扫描</button>`;
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
    if (!isErrorResponse(response)) added += 1;
  }
  button.textContent = `已加入 ${added} 条`;
  window.setTimeout(() => {
    button.disabled = false;
    button.textContent = "加入全部匹配";
  }, 1800);
}

function isErrorResponse(value: unknown): value is { error: string } {
  return typeof value === "object" && value !== null && "error" in value && typeof (value as { error?: unknown }).error === "string";
}

function updateToolbarCount(count: number): void {
  const node = document.querySelector(".bjh-toolbar-count");
  if (node) node.textContent = `${count} 个匹配岗位`;
}

/** 接收页面主世界的只读岗位接口事件，更新本地数据池后重新绑定当前卡片。 */
function onPageBridgeMessage(event: MessageEvent<unknown>): void {
  const message = event.data as { source?: string; type?: string; url?: string; payload?: unknown } | null;
  if (event.source !== window || message?.source !== "boss-job-helper-page" || message.type !== "BOSS_JOB_API_RESPONSE") return;
  const jobs = extractBossJobs(message.payload, message.url || location.href);
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
  toolbar.querySelector(".bjh-detail-queue")?.addEventListener("click", () => {
    const job = parseDetailJob();
    if (!job) return;
    void chrome.runtime.sendMessage({ type: "ADD_TO_QUEUE", job });
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
  status.textContent = `${job.title} · ${actionText.includes("立即沟通") ? "可沟通" : "需人工确认"}`;
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
  };
  job.score = scoreJob(job, settings);
  return job;
}
