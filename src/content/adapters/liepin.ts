import { commonFields, type PlatformAdapter } from "./types";

/** 猎聘岗位卡片适配器。 */
export const liepinAdapter: PlatformAdapter = { key: "liepin", label: "猎聘", hosts: ["liepin.com"], cardSelectors: ["div[class*='job-card-pc-container']", ".job-card-pc", ".job-card", ".job-item", "[data-job-id]", ".demo-job-card"], fields: { title: [".job-title", ".job-name", "[data-field='title']", "h3"], company: [".company-name", ".company-title", ".company", "[data-field='company']"], ...commonFields } };
