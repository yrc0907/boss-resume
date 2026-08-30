/** 脉脉适配器模块：描述岗位卡片字段。 */
import { commonFields, type PlatformAdapter } from "./types";

/** 脉脉岗位卡片适配器。 */
export const maimaiAdapter: PlatformAdapter = { key: "maimai", label: "脉脉", hosts: ["maimai.cn"], cardSelectors: [".job-card", ".job-item", "[data-job-id]", ".demo-job-card"], fields: { title: [".job-name", ".job-title", "[data-field='title']", "h3"], company: [".company-name", ".company", "[data-field='company']"], ...commonFields } };
