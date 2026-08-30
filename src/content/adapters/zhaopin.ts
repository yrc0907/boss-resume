import { commonFields, type PlatformAdapter } from "./types";

/** 智联招聘岗位卡片适配器。 */
export const zhaopinAdapter: PlatformAdapter = { key: "zhaopin", label: "智联招聘", hosts: ["zhaopin.com"], cardSelectors: [".joblist-box__item", ".joblist-box .item", ".job-card", "[data-job-id]", ".demo-job-card"], fields: { title: [".jobinfo__name", ".job-name", "[data-field='title']", "h3"], company: [".companyinfo__name", ".company-name", "[data-field='company']", ".company"], ...commonFields } };
