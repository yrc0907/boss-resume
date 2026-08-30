import type { JobCandidate, Settings } from "./types";

/** 根据岗位文本计算本地可解释分数；不调用模型、不访问外部接口。 */
export function scoreJob(job: Pick<JobCandidate, "title" | "company" | "location" | "description" | "tags">, settings: Settings): number {
  const text = [job.title, job.company, job.location, job.description, ...job.tags]
    .join(" ")
    .toLowerCase();
  let score = 40;
  const keywordHits = settings.keywords.filter((keyword) => text.includes(keyword.toLowerCase())).length;
  const locationHits = settings.locations.filter((location) => text.includes(location.toLowerCase())).length;
  const blacklistHits = settings.blacklist.filter((word) => text.includes(word.toLowerCase())).length;
  score += Math.min(keywordHits * 15, 45);
  score += locationHits > 0 ? 15 : 0;
  score -= blacklistHits * 45;
  return Math.max(0, Math.min(100, score));
}

/** 将模板变量替换为岗位字段，便于用户在详情页人工确认前快速准备招呼语。 */
export function renderGreeting(template: string, job: Pick<JobCandidate, "title" | "company" | "location">): string {
  return template
    .replaceAll("{{title}}", job.title)
    .replaceAll("{{company}}", job.company)
    .replaceAll("{{location}}", job.location);
}
