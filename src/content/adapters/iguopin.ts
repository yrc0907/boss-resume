import { commonFields, type PlatformAdapter } from "./types";

/** 国聘岗位卡片适配器。 */
export const iguopinAdapter: PlatformAdapter = { key: "iguopin", label: "国聘", hosts: ["iguopin.com"], cardSelectors: [".job-item", ".job-card", "[data-job-id]", ".demo-job-card"], fields: { title: [".job-name", ".job-title", "[data-field='title']", "h3"], company: [".company-name", ".company", "[data-field='company']"], ...commonFields } };
