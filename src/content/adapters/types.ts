/** 平台适配器契约：描述岗位卡片和字段选择器，不承担评分或发送。 */
export interface PlatformAdapter {
  key: string;
  label: string;
  hosts: string[];
  cardSelectors: string[];
  fields: Record<"title" | "company" | "salary" | "location" | "description" | "experience" | "education" | "tags", string[]>;
  routes?: { list: RegExp[]; detail: RegExp[] };
  detail?: {
    title: string[];
    company: string[];
    salary: string[];
    location: string[];
    description: string[];
    action: string[];
    recruiter: string[];
    activeTime: string[];
  };
}

type DetailFields = Omit<PlatformAdapter["fields"], "title" | "company">;

export const commonFields: DetailFields = {
  salary: [".salary", ".job-salary", "[data-field='salary']"],
  location: [".job-area", ".location", ".job-location", "[data-field='location']"],
  description: [".job-desc", ".job-seek", ".desc", "[data-field='description']"],
  experience: ["[data-field='experience']", ".experience"],
  education: ["[data-field='education']", ".education"],
  tags: [".tag-list li", ".tag", "[data-tag]"],
};
