import type { JobCandidate } from "../shared/types";
import type { PlatformAdapter } from "./adapters/types";

/** 解析岗位卡片的统一入口：选择器由平台提供，身份键和文本兜底由这里负责。 */
export function parseCardJob(card: Element, adapter: PlatformAdapter, sourceUrl: string): JobCandidate | null {
  const read = (selectors: string[]): string => {
    for (const selector of selectors) {
      const text = card.querySelector(selector)?.textContent?.trim().replace(/\s+/g, " ") || "";
      if (text) return text;
    }
    return "";
  };
  const salary = read(adapter.fields.salary) || readByClassFragment(card, "salary");
  const title = cleanJobTitle(read(adapter.fields.title) || readByClassFragment(card, "job-name") || readByClassFragment(card, "job-title") || firstHeading(card), salary);
  const company = read(adapter.fields.company) || readByClassFragment(card, "company") || readByClassFragment(card, "boss-name");
  if (!title || !company) return null;
  const detailAnchor = card.querySelector("a[href*='/job_detail/'], a.job-name, a[href]") as HTMLAnchorElement | null;
  const anchorHref = detailAnchor?.href || "";
  const detailUrl = anchorHref && safeUrl(anchorHref) ? anchorHref : sourceUrl;
  const identityKeys = extractIdentityKeys(card, detailUrl);
  return {
    id: identityKeys[0] || detailUrl,
    title,
    company,
    salary,
    location: read(adapter.fields.location) || readByClassFragment(card, "location"),
    experience: read(adapter.fields.experience),
    education: read(adapter.fields.education),
    tags: adapter.fields.tags.flatMap((selector) => Array.from(card.querySelectorAll(selector))).map((item) => item.textContent?.trim() || "").filter(Boolean),
    detailUrl,
    description: read(adapter.fields.description) || card.textContent?.trim().replace(/\s+/g, " ") || "",
    score: 0,
    status: "new",
    capturedAt: new Date().toISOString(),
    platform: adapter.key,
    source: "dom",
    sourceUrl,
    identityKeys,
  };
}

function readByClassFragment(root: Element, fragment: string): string {
  const selector = `[class*="${fragment}"]`;
  return root.querySelector(selector)?.textContent?.trim().replace(/\s+/g, " ") || "";
}

function firstHeading(root: Element): string {
  return root.querySelector("h1, h2, h3, h4")?.textContent?.trim().replace(/\s+/g, " ") || "";
}

/** Boss 卡片偶尔把薪资拼进岗位名，先清洗再用于匹配签名。 */
function cleanJobTitle(title: string, salary: string): string {
  let normalized = title.replace(/\s+/g, " ").trim();
  if (salary) normalized = normalized.replace(salary, "").trim();
  return normalized.replace(/[\uE000-\uF8FF][\uE000-\uF8FF\d.,+\-~Kk万年月薪/·]*$/g, "").trim();
}

/** 从 data 属性和岗位链接提取可用于跨接口合并的强身份键。 */
function extractIdentityKeys(card: Element, detailUrl: string): string[] {
  const keys = new Set<string>();
  const elements = [card, ...Array.from(card.querySelectorAll("a, [data-jobid], [data-job-id], [data-id], [data-lid], [data-securityid], [data-security-id]"))];
  for (const element of elements) {
    for (const attribute of ["data-jobid", "data-job-id", "data-id", "data-lid", "data-securityid", "data-security-id"]) {
      const value = element.getAttribute(attribute)?.trim();
      if (value) keys.add(value);
    }
    const href = element.getAttribute("href") || "";
    const detailMatch = href.match(/\/job_detail\/([A-Za-z0-9_~-]+)(?:\.html)?/);
    if (detailMatch?.[1]) keys.add(detailMatch[1]);
    for (const match of href.matchAll(/(?:jobId|encryptJobId|securityId)=([A-Za-z0-9_~-]+)/g)) keys.add(match[1]);
  }
  const fallbackMatch = detailUrl.match(/\/job_detail\/([A-Za-z0-9_~-]+)(?:\.html)?/);
  if (fallbackMatch?.[1]) keys.add(fallbackMatch[1]);
  return Array.from(keys);
}

function safeUrl(value: string): boolean {
  if (!value.trim()) return false;
  try {
    const url = new URL(value, location.href);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
