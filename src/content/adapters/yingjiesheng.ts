import { commonFields, type PlatformAdapter } from "./types";

/** 应届生求职网岗位卡片适配器。 */
export const yingjieshengAdapter: PlatformAdapter = { key: "yingjiesheng", label: "应届生求职网", hosts: ["yingjiesheng.com"], cardSelectors: [".job-item", ".job-card", "[data-job-id]", ".demo-job-card"], fields: { title: [".job-name", ".job-title", "[data-field='title']", "h3"], company: [".company-name", ".company", "[data-field='company']"], ...commonFields } };
