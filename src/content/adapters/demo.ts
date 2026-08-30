/** 本地演示适配器模块：只服务 localhost 验收页。 */
import { commonFields, type PlatformAdapter } from "./types";

/** 本地演示页适配器：只用于验收扩展，不读取真实招聘网站。 */
export const demoAdapter: PlatformAdapter = { key: "demo", label: "本地演示", hosts: ["localhost", "127.0.0.1"], cardSelectors: [".demo-job-card"], fields: { title: [".job-name"], company: [".company-name"], ...commonFields } };
