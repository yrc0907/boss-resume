import { commonFields, type PlatformAdapter } from "./types";

/** 前程无忧岗位卡片适配器。 */
export const fiftyOneJobAdapter: PlatformAdapter = { key: "51job", label: "前程无忧", hosts: ["51job.com"], cardSelectors: [".joblist-item", ".job-card", ".job-item", "[data-job-id]", ".demo-job-card"], fields: { title: [".jname", ".job-name", ".job-title", "[data-field='title']", "h3"], company: [".cname", ".company-name", ".company", "[data-field='company']"], ...commonFields } };
