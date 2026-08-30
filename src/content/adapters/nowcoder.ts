/** 牛客适配器模块：描述岗位卡片字段。 */
import { commonFields, type PlatformAdapter } from "./types";

/** 牛客岗位卡片适配器。 */
export const nowcoderAdapter: PlatformAdapter = { key: "nowcoder", label: "牛客", hosts: ["nowcoder.com"], cardSelectors: [".job-card", ".job-item", ".job-list-item", "[data-job-id]", ".demo-job-card"], fields: { title: [".job-name", ".job-title", "[data-field='title']", "h3"], company: [".company-name", ".company", "[data-field='company']"], ...commonFields } };
