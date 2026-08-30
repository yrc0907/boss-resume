import { DEFAULT_SETTINGS, type QueueItem, type Settings } from "../shared/types";

/** 弹窗控制器：编辑本地筛选条件、查看候选队列并复制准备好的招呼语。 */
void init();

async function init(): Promise<void> {
  const settings = await chrome.runtime.sendMessage<Settings>({ type: "GET_SETTINGS" });
  fillSettings({ ...DEFAULT_SETTINGS, ...settings });
  bindSettings();
  bindQueueActions();
  bindExport();
  await renderPageStatus();
  await renderQueue();
}

function fillSettings(settings: Settings): void {
  setValue("keywords", settings.keywords.join(", "));
  setValue("locations", settings.locations.join(", "));
  setValue("blacklist", settings.blacklist.join(", "));
  setValue("min-score", String(settings.minScore));
  setValue("greeting", settings.greetingTemplate);
}

function bindSettings(): void {
  document.querySelector("#save-settings")?.addEventListener("click", async () => {
    const next: Settings = {
      keywords: splitList(value("keywords")),
      locations: splitList(value("locations")),
      blacklist: splitList(value("blacklist")),
      minScore: Math.max(0, Math.min(100, Number(value("min-score")) || 0)),
      greetingTemplate: value("greeting") || DEFAULT_SETTINGS.greetingTemplate,
      maxQueueSize: DEFAULT_SETTINGS.maxQueueSize,
      autoScan: false,
    };
    await chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings: next });
    setStatus("已保存筛选条件", true);
  });
}

function bindQueueActions(): void {
  document.querySelector("#clear-queue")?.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "CLEAR_QUEUE" });
    await renderQueue();
    setStatus("队列已清空");
  });
}

/** 将本地候选队列导出为 CSV，供用户离线复盘，不向招聘平台发送任何内容。 */
function bindExport(): void {
  document.querySelector("#export-queue")?.addEventListener("click", async () => {
    const queue = await chrome.runtime.sendMessage<QueueItem[]>({ type: "GET_QUEUE" });
    const rows = [
      ["平台岗位", "公司", "地点", "薪资", "匹配分", "状态", "岗位链接"],
      ...queue.map((item) => [item.job.title, item.job.company, item.job.location, item.job.salary, String(item.job.score), item.state, item.job.detailUrl]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `boss-job-queue-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("CSV 已导出");
  });
}

/** 读取当前活动标签页的内容脚本状态，帮助用户区分平台未识别和岗位筛选为空。 */
async function renderPageStatus(): Promise<void> {
  const statusNode = document.querySelector("#page-status");
  if (!statusNode) return;
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0]?.id;
    if (tabId === undefined) throw new Error("没有活动标签页");
    const status = await chrome.tabs.sendMessage<{ platform: string; cardCount: number; matchCount: number }>(tabId, { type: "GET_CONTENT_STATUS" });
    statusNode.textContent = `${status.platform} · 已识别 ${status.cardCount} 个岗位 · 匹配 ${status.matchCount} 个`;
  } catch {
    statusNode.textContent = "当前页面未加载投递助手";
  }
}

async function renderQueue(): Promise<void> {
  const queue = await chrome.runtime.sendMessage<QueueItem[]>({ type: "GET_QUEUE" });
  const list = document.querySelector("#queue-list");
  const count = document.querySelector("#queue-count");
  if (!list || !count) return;
  count.textContent = String(queue.length);
  list.replaceChildren();
  if (!queue.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "还没有候选岗位";
    list.append(empty);
    return;
  }
  for (const item of queue) list.append(createQueueItem(item));
}

function createQueueItem(item: QueueItem): HTMLElement {
  const article = document.createElement("article");
  article.className = "queue-item";
  article.innerHTML = `<h3></h3><p></p><small>匹配 ${item.job.score} 分 · ${item.state === "queued" ? "待准备" : item.state}</small><div class="queue-actions"><a data-open target="_blank" rel="noreferrer">打开岗位</a><button type="button" data-copy>复制招呼语</button><button type="button" data-remove>移除</button></div>`;
  article.querySelector("h3")!.textContent = `${item.job.title} · ${item.job.company}`;
  article.querySelector("p")!.textContent = `${item.job.location || "未知地点"} · ${item.job.salary || "薪资待确认"}`;
  (article.querySelector("[data-open]") as HTMLAnchorElement).href = item.job.detailUrl;
  article.querySelector("[data-copy]")?.addEventListener("click", async () => {
    await navigator.clipboard.writeText(item.preparedGreeting);
    setStatus("招呼语已复制");
  });
  article.querySelector("[data-remove]")?.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "REMOVE_FROM_QUEUE", id: item.job.id });
    await renderQueue();
  });
  return article;
}

function splitList(input: string): string[] {
  return input.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean);
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function value(id: string): string {
  return (document.querySelector(`#${id}`) as HTMLInputElement | HTMLTextAreaElement | null)?.value.trim() || "";
}

function setValue(id: string, next: string): void {
  const element = document.querySelector(`#${id}`) as HTMLInputElement | HTMLTextAreaElement | null;
  if (element) element.value = next;
}

function setStatus(message: string, saved = false): void {
  const status = document.querySelector("#status");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("is-saved", saved);
  window.setTimeout(() => { status.textContent = "准备就绪"; status.classList.remove("is-saved"); }, 1800);
}
