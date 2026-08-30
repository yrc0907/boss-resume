import { commonFields, type PlatformAdapter } from "./types";

/** Boss 直聘岗位卡片适配器。 */
export const zhipinAdapter: PlatformAdapter = { key: "zhipin", label: "Boss 直聘", hosts: ["zhipin.com"], cardSelectors: [".job-card-wrapper", ".job-card", ".job-primary", "[ka='job-list'] > li", ".demo-job-card"], fields: { title: [".job-name", ".job-title", "[data-field='title']", "h3", "h4"], company: [".company-name", ".company-text", "[data-field='company']", ".company"], ...commonFields } };
