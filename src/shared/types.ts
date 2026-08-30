/** 岗位候选对象：来源于页面公开岗位卡片，不包含账号凭据或敏感个人数据。 */
export interface JobCandidate {
  id: string;
  title: string;
  company: string;
  salary: string;
  location: string;
  experience: string;
  education: string;
  tags: string[];
  detailUrl: string;
  description: string;
  score: number;
  status: "new" | "queued" | "prepared" | "skipped";
  capturedAt: string;
  platform?: string;
  recruiter?: string;
  recruiterTitle?: string;
  activeTime?: string;
  source?: "dom" | "api" | "merged";
  sourceUrl?: string;
  applicationType?: "chat" | "application" | "unknown";
  identityKeys?: string[];
}

/** 用户筛选设置：只影响本地匹配与排序，不触发任何外部发送。 */
export interface Settings {
  keywords: string[];
  locations: string[];
  blacklist: string[];
  minScore: number;
  greetingTemplate: string;
  maxQueueSize: number;
  autoScan: boolean;
  resumeProfiles: ResumeProfile[];
  defaultResumeId: string;
}

/** 本地简历版本索引：只保存用户自定义名称，不保存文件内容或路径。 */
export interface ResumeProfile {
  id: string;
  label: string;
}

/** 投递准备队列项：记录准备状态，最终发送由用户手动完成。 */
export interface QueueItem {
  job: JobCandidate;
  preparedGreeting: string;
  addedAt: string;
  state: "queued" | "prepared" | "opened" | "done";
  resumeProfileId: string;
}

/** 队列写入结果：同时返回最新队列和本次是否真的新增。 */
export interface QueueMutationResult {
  queue: QueueItem[];
  added: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  keywords: ["货代", "物流", "供应链"],
  locations: ["深圳", "广州"],
  blacklist: ["销售", "外包", "兼职", "培训贷"],
  minScore: 60,
  greetingTemplate:
    "您好，我对贵司的{{title}}岗位很感兴趣。我有相关业务经验，希望有机会进一步沟通。",
  maxQueueSize: 30,
  autoScan: false,
  resumeProfiles: [{ id: "default", label: "默认简历" }],
  defaultResumeId: "default",
};

export type RuntimeMessage =
  | { type: "GET_SETTINGS" }
  | { type: "SAVE_SETTINGS"; settings: Settings }
  | { type: "GET_QUEUE" }
  | { type: "ADD_TO_QUEUE"; job: JobCandidate }
  | { type: "UPDATE_QUEUE_STATE"; id: string; state: QueueItem["state"] }
  | { type: "UPDATE_QUEUE_RESUME"; id: string; resumeProfileId: string }
  | { type: "REMOVE_FROM_QUEUE"; id: string }
  | { type: "CLEAR_QUEUE" }
  | { type: "GET_STATS" };
