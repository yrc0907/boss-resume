/** Boss 岗位接口解析模块：只提取公开岗位数据并生成统一对象。 */
import type { JobCandidate } from "../shared/types";

const TITLE_KEYS = ["jobName", "jobTitle", "positionName", "position", "title"];
const COMPANY_KEYS = ["brandName", "companyName", "encryptBrandName", "company"];
const ID_KEYS = ["encryptJobId", "encryptId", "jobId", "job_id", "securityId", "lid"];
const SALARY_KEYS = ["salaryDesc", "salaryName", "salary"];
const LOCATION_KEYS = ["locationName", "cityName", "city", "location"];
const DETAIL_KEYS = ["postDescription", "jobDescription", "description", "detail"];
const RECRUITER_KEYS = ["bossName", "bossNickName", "recruiter", "boss"];

/** 从 Boss 岗位接口响应中递归提取岗位字段，只保留公开岗位信息。 */
export function extractBossJobs(payload: unknown, sourceUrl: string): JobCandidate[] {
  const result = new Map<string, JobCandidate>();
  walk(payload, 0, (candidate) => {
    const title = pick(candidate, TITLE_KEYS);
    const company = pick(candidate, COMPANY_KEYS);
    if (!title || !company) return;
    const identityKeys = ID_KEYS.map((key) => pick(candidate, [key])).filter(Boolean);
    const id = identityKeys[0] || makeSignature(title, company, pick(candidate, SALARY_KEYS));
    const next: JobCandidate = {
      id,
      title,
      company,
      salary: pick(candidate, SALARY_KEYS),
      location: pick(candidate, LOCATION_KEYS),
      experience: pick(candidate, ["experienceName", "experience"]),
      education: pick(candidate, ["degreeName", "education"]),
      tags: [pick(candidate, LOCATION_KEYS), pick(candidate, ["experienceName", "experience"]), pick(candidate, ["degreeName", "education"])].filter(Boolean),
      detailUrl: pick(candidate, ["url", "jobUrl", "detailUrl"]) || sourceUrl,
      description: pick(candidate, DETAIL_KEYS),
      score: 0,
      status: "new",
      capturedAt: new Date().toISOString(),
      platform: "zhipin",
      recruiter: pick(candidate, RECRUITER_KEYS),
      recruiterTitle: pick(candidate, ["bossTitle", "postDescription"]),
      activeTime: pick(candidate, ["activeTimeDesc", "bossActiveTimeDesc", "bossActiveDesc"]),
      source: "api",
      sourceUrl,
      identityKeys,
    };
    const previous = result.get(id);
    result.set(id, previous ? mergeApiJob(previous, next) : next);
  });
  return Array.from(result.values());
}

/** 用强 ID 优先、岗位名加公司签名兜底，把接口岗位合并到 DOM 岗位。 */
export function mergeJobCandidate(domJob: JobCandidate, apiJob: JobCandidate): JobCandidate {
  return {
    ...domJob,
    ...apiJob,
    id: domJob.id || apiJob.id,
    identityKeys: Array.from(new Set([...(domJob.identityKeys || []), ...(apiJob.identityKeys || []), domJob.id, apiJob.id].filter(Boolean))),
    detailUrl: safeUrl(domJob.detailUrl) ? domJob.detailUrl : apiJob.detailUrl,
    title: apiJob.title || domJob.title,
    company: apiJob.company || domJob.company,
    salary: apiJob.salary || domJob.salary,
    location: apiJob.location || domJob.location,
    description: apiJob.description || domJob.description,
    tags: Array.from(new Set([...domJob.tags, ...apiJob.tags].filter(Boolean))),
    score: domJob.score,
    status: domJob.status,
    source: "merged",
  };
}

/** 根据岗位 ID 或岗位名/公司签名查找接口数据，防止 DOM 顺序变化造成错配。 */
export function findMatchingBossJob(domJob: JobCandidate, apiJobs: Iterable<JobCandidate>): JobCandidate | null {
  const list = Array.from(apiJobs);
  const domKeys = new Set([domJob.id, ...(domJob.identityKeys || [])].filter(Boolean));
  const exact = list.find((job) => [job.id, ...(job.identityKeys || [])].some((key) => domKeys.has(key)));
  if (exact) return exact;
  const signature = makeSignature(domJob.title, domJob.company, domJob.salary);
  const loose = makeSignature(domJob.title, domJob.company, "");
  return list.find((job) => makeSignature(job.title, job.company, job.salary) === signature || makeSignature(job.title, job.company, "") === loose) ?? null;
}

function walk(value: unknown, depth: number, visit: (candidate: Record<string, unknown>) => void): void {
  if (depth > 7 || value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item) => walk(item, depth + 1, visit));
    return;
  }
  const candidate = value as Record<string, unknown>;
  visit(candidate);
  Object.values(candidate).forEach((child) => walk(child, depth + 1, visit));
}

function pick(candidate: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = candidate[key];
    if (typeof value === "string" || typeof value === "number") {
      const normalized = String(value).replace(/\s+/g, " ").trim();
      if (normalized) return normalized;
    }
  }
  return "";
}

function makeSignature(title: string, company: string, salary: string): string {
  return `${title}|${company}|${salary}`.toLowerCase().replace(/\s+/g, "");
}

/** 接口摘要和详情可能分批到达，按非空字段合并，避免先到摘要覆盖完整信息。 */
function mergeApiJob(previous: JobCandidate, next: JobCandidate): JobCandidate {
  return {
    ...previous,
    title: next.title || previous.title,
    company: next.company || previous.company,
    salary: next.salary || previous.salary,
    location: next.location || previous.location,
    experience: next.experience || previous.experience,
    education: next.education || previous.education,
    description: next.description || previous.description,
    recruiter: next.recruiter || previous.recruiter,
    recruiterTitle: next.recruiterTitle || previous.recruiterTitle,
    activeTime: next.activeTime || previous.activeTime,
    detailUrl: next.detailUrl || previous.detailUrl,
    identityKeys: Array.from(new Set([...(previous.identityKeys || []), ...(next.identityKeys || [])])),
    tags: Array.from(new Set([...(previous.tags || []), ...(next.tags || [])].filter(Boolean))),
    source: "api",
  };
}

function safeUrl(value: string): boolean {
  try {
    const url = new URL(value, location.href);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
