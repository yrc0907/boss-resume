import { commonFields, type PlatformAdapter } from "./types";

/** 前程无忧岗位卡片适配器。 */
export const fiftyOneJobAdapter: PlatformAdapter = { key: "51job", label: "前程无忧", hosts: ["51job.com"], cardSelectors: ["[data-jobid]", "[data-analysis-jobid]", "[data-job-id]", ".joblist-item", ".job-card", ".job-item", ".demo-job-card"], fields: { title: ["[class*='jname text-cut']", ".jname", ".job-name", ".job-title", "[data-field='title']", "h3"], company: ["[class*='cname text-cut']", ".cname", ".company-name", ".company", "[data-field='company']"], ...commonFields } };
