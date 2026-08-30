import { commonFields, type PlatformAdapter } from "./types";

/** 拉勾招聘岗位卡片适配器。 */
export const lagouAdapter: PlatformAdapter = { key: "lagou", label: "拉勾招聘", hosts: ["lagou.com"], cardSelectors: [".job-item", ".job-card", ".list__item", "[data-job-id]", ".demo-job-card"], fields: { title: [".position", ".job-name", ".job-title", "[data-field='title']", "h3"], company: [".company", ".company-name", "[data-field='company']"], ...commonFields } };
