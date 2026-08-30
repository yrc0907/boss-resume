import type { JobCandidate } from "../shared/types";
import { extractBossJobs } from "./boss-api";

/** 按平台分派只读接口解析器；未知平台返回空数组，不猜测字段。 */
export function extractPlatformJobs(platform: string, payload: unknown, sourceUrl: string): JobCandidate[] {
  if (platform === "zhipin") return extractBossJobs(payload, sourceUrl);
  if (platform === "liepin") return extractLiepinJobs(payload, sourceUrl);
  return [];
}

/** 解析猎聘搜索接口的 jobCardList，适配 data.data.jobCardList 和 data.jobCardList 两种包装。 */
export function extractLiepinJobs(payload: unknown, sourceUrl: string): JobCandidate[] {
  const list = findCardList(payload);
  const jobs: JobCandidate[] = [];
  for (const item of list) {
    if (!isRecord(item)) continue;
    const job = asRecord(item.job);
    const company = asRecord(item.comp);
    const recruiter = asRecord(item.recruiter);
    const id = read(job, ["jobId", "id"]);
    const title = read(job, ["title", "jobTitle"]);
    const companyName = read(company, ["compName", "companyName", "name"]);
    if (!id || !title || !companyName) continue;
    jobs.push({
      id,
      title,
      company: companyName,
      salary: read(job, ["salary", "salaryDesc"]),
      location: read(job, ["dq", "locationName", "city"]),
      experience: read(job, ["requireWorkYears", "experience"]),
      education: read(job, ["requireEduLevel", "education"]),
      tags: [read(job, ["dq", "locationName", "city"]), read(job, ["requireWorkYears", "experience"]), read(job, ["requireEduLevel", "education"])].filter(Boolean),
      detailUrl: read(job, ["link", "url", "detailUrl"]) || sourceUrl,
      description: read(job, ["description", "jobDescription", "desc"]),
      score: 0,
      status: "new",
      capturedAt: new Date().toISOString(),
      platform: "liepin",
      recruiter: read(recruiter, ["recruiterName", "name"]),
      recruiterTitle: read(recruiter, ["recruiterTitle", "title"]),
      source: "api",
      sourceUrl,
      identityKeys: [id, read(recruiter, ["recruiterId"]), read(company, ["compId"])].filter(Boolean),
    });
  }
  return dedupe(jobs);
}

function findCardList(payload: unknown): unknown[] {
  if (!isRecord(payload)) return [];
  const nested = asRecord(payload.data);
  const deeper = asRecord(nested?.data);
  const candidates = [deeper?.jobCardList, nested?.jobCardList, payload.jobCardList];
  return candidates.find(Array.isArray) as unknown[] || [];
}

function dedupe(jobs: JobCandidate[]): JobCandidate[] {
  const unique = new Map<string, JobCandidate>();
  for (const job of jobs) {
    const previous = unique.get(job.id);
    unique.set(job.id, previous ? { ...previous, ...job, tags: Array.from(new Set([...previous.tags, ...job.tags])) } : job);
  }
  return Array.from(unique.values());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function read(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" || typeof value === "number") {
      const text = String(value).replace(/\s+/g, " ").trim();
      if (text) return text;
    }
  }
  return "";
}
