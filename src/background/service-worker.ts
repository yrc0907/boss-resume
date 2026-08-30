import { renderGreeting } from "../shared/scoring";
import { DEFAULT_SETTINGS, type QueueItem, type QueueMutationResult, type RuntimeMessage, type Settings } from "../shared/types";

const SETTINGS_KEY = "settings";
const QUEUE_KEY = "queue";
const STATS_KEY = "stats";

interface Stats {
  captured: number;
  queued: number;
  prepared: number;
}

/** 扩展后台存储层：集中管理设置、队列和统计，避免页面脚本直接写入业务状态。 */
chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  void handleMessage(message as RuntimeMessage)
    .then(sendResponse)
    .catch((error: unknown) => sendResponse({ error: error instanceof Error ? error.message : "操作失败" }));
  return true;
});

async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
  const merged = { ...DEFAULT_SETTINGS, ...(stored[SETTINGS_KEY] as Partial<Settings>) };
  return {
    ...merged,
    resumeProfiles: Array.isArray(merged.resumeProfiles) && merged.resumeProfiles.length ? merged.resumeProfiles : DEFAULT_SETTINGS.resumeProfiles,
    defaultResumeId: merged.defaultResumeId || DEFAULT_SETTINGS.defaultResumeId,
  };
}

async function getQueue(): Promise<QueueItem[]> {
  const stored = await chrome.storage.local.get({ [QUEUE_KEY]: [] });
  if (!Array.isArray(stored[QUEUE_KEY])) return [];
  const settings = await getSettings();
  return (stored[QUEUE_KEY] as QueueItem[]).map((item) => ({ ...item, resumeProfileId: item.resumeProfileId || settings.defaultResumeId }));
}

async function handleMessage(message: RuntimeMessage): Promise<unknown> {
  switch (message.type) {
    case "GET_SETTINGS":
      return getSettings();
    case "SAVE_SETTINGS":
      await chrome.storage.local.set({ [SETTINGS_KEY]: message.settings });
      await broadcastSettings(message.settings);
      return message.settings;
    case "GET_QUEUE":
      return getQueue();
    case "ADD_TO_QUEUE": {
      const settings = await getSettings();
      const queue = await getQueue();
      if (queue.some((item) => item.job.id === message.job.id)) return { queue, added: false } satisfies QueueMutationResult;
      if (queue.length >= settings.maxQueueSize) throw new Error(`队列已达到 ${settings.maxQueueSize} 条上限`);
      const next: QueueItem[] = [
        ...queue,
        {
          job: message.job,
          preparedGreeting: renderGreeting(settings.greetingTemplate, message.job),
          addedAt: new Date().toISOString(),
          state: "queued",
          resumeProfileId: settings.defaultResumeId,
        },
      ];
      await chrome.storage.local.set({ [QUEUE_KEY]: next });
      await incrementStats("queued");
      return { queue: next, added: true } satisfies QueueMutationResult;
    }
    case "UPDATE_QUEUE_STATE": {
      const queue = await getQueue();
      const next = queue.map((item) => item.job.id === message.id ? { ...item, state: message.state } : item);
      await chrome.storage.local.set({ [QUEUE_KEY]: next });
      if (message.state === "prepared") await incrementStats("prepared");
      return next;
    }
    case "UPDATE_QUEUE_RESUME": {
      const settings = await getSettings();
      const selected = settings.resumeProfiles.some((profile) => profile.id === message.resumeProfileId) ? message.resumeProfileId : settings.defaultResumeId;
      const queue = await getQueue();
      const next = queue.map((item) => item.job.id === message.id ? { ...item, resumeProfileId: selected } : item);
      await chrome.storage.local.set({ [QUEUE_KEY]: next });
      return next;
    }
    case "REMOVE_FROM_QUEUE": {
      const queue = await getQueue();
      const next = queue.filter((item) => item.job.id !== message.id);
      await chrome.storage.local.set({ [QUEUE_KEY]: next });
      return next;
    }
    case "CLEAR_QUEUE":
      await chrome.storage.local.set({ [QUEUE_KEY]: [] });
      return [];
    case "GET_STATS": {
      const stored = await chrome.storage.local.get({ [STATS_KEY]: { captured: 0, queued: 0, prepared: 0 } });
      return stored[STATS_KEY] as Stats;
    }
  }
}

async function incrementStats(key: keyof Stats): Promise<void> {
  const stored = await chrome.storage.local.get({ [STATS_KEY]: { captured: 0, queued: 0, prepared: 0 } });
  const stats = stored[STATS_KEY] as Stats;
  await chrome.storage.local.set({ [STATS_KEY]: { ...stats, [key]: stats[key] + 1 } });
}

async function broadcastSettings(settings: Settings): Promise<void> {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.flatMap((tab) => tab.id === undefined ? [] : [chrome.tabs.sendMessage(tab.id, { type: "SETTINGS_UPDATED", settings }).catch(() => undefined)]));
}
