import { scoreJob } from "../shared/scoring";
import { DEFAULT_SETTINGS, type JobCandidate, type Settings } from "../shared/types";
import { getPlatformAdapter } from "./adapters";
import type { PlatformAdapter } from "./adapters/types";

const marked = new Set<Element>();
let settings: Settings = DEFAULT_SETTINGS;
let matchCount = 0;
const adapter: PlatformAdapter | null = getPlatformAdapter(location.hostname);

/** Boss 页面内容脚本：只读取岗位卡片并提供本地筛选/排队按钮，不执行发送动作。 */
void init();

async function init(): Promise<void> {
  if (!adapter) return;
  settings = await chrome.runtime.sendMessage<Settings>({ type: "GET_SETTINGS" });
  injectToolbar();
  scanCards();
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
  matchCount = 0;
  for (const card of cards) {
    const job = parseJob(card);
    if (!job || marked.has(card)) continue;
    marked.add(card);
    job.score = scoreJob(job, settings);
    if (job.score >= settings.minScore && !containsBlacklist(job)) {
      matchCount += 1;
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
  return {
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
  };
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
  toolbar.innerHTML = `<strong>${adapter?.label ?? "投递准备"}</strong><span class="bjh-toolbar-count">扫描中</span><button type="button" class="bjh-refresh">重新扫描</button>`;
  toolbar.querySelector(".bjh-refresh")?.addEventListener("click", () => {
    resetDecorations();
    scanCards();
  });
  document.body.append(toolbar);
}

function resetDecorations(): void {
  marked.clear();
  document.querySelectorAll(".bjh-card-actions, .bjh-match-badge").forEach((node) => node.remove());
  document.querySelectorAll(".bjh-job-match, .bjh-job-muted").forEach((node) => node.classList.remove("bjh-job-match", "bjh-job-muted"));
}

function isErrorResponse(value: unknown): value is { error: string } {
  return typeof value === "object" && value !== null && "error" in value && typeof (value as { error?: unknown }).error === "string";
}

function updateToolbarCount(count: number): void {
  const node = document.querySelector(".bjh-toolbar-count");
  if (node) node.textContent = `${count} 个匹配岗位`;
}
