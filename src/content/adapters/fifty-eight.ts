/** 58 同城招聘适配器模块：描述岗位卡片字段。 */
import { commonFields, type PlatformAdapter } from "./types";

/** 58 同城招聘岗位卡片适配器。 */
export const fiftyEightAdapter: PlatformAdapter = { key: "58", label: "58 同城招聘", hosts: ["58.com"], cardSelectors: [".job-item", ".job-card", ".list-item", "[data-job-id]", ".demo-job-card"], fields: { title: [".job-name", ".job-title", "[data-field='title']", "h3"], company: [".company-name", ".company", "[data-field='company']"], ...commonFields } };
