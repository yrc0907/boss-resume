/** 实习僧适配器模块：描述岗位卡片字段。 */
import { commonFields, type PlatformAdapter } from "./types";

/** 实习僧岗位卡片适配器。 */
export const shixisengAdapter: PlatformAdapter = { key: "shixiseng", label: "实习僧", hosts: ["shixiseng.com"], cardSelectors: [".job-list-item", ".intern-item", ".job-card", "[data-job-id]", ".demo-job-card"], fields: { title: [".job-title", ".job-name", "[data-field='title']", "h3"], company: [".company-name", ".company", "[data-field='company']"], ...commonFields } };
