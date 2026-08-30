import assert from "node:assert/strict";
import { extractBossJobs, findMatchingBossJob, mergeJobCandidate } from "../src/content/boss-api";
import { extractLiepinJobs } from "../src/content/platform-api";
import { getPlatformAdapter } from "../src/content/adapters";
import type { JobCandidate } from "../src/shared/types";

/** 接口解析契约：用稳定的最小响应验证字段提取和身份匹配，不访问网络。 */
const payload = {
  zpData: {
    jobList: [
      {
        encryptJobId: "job-001",
        jobName: "货代操作主管",
        brandName: "海联供应链",
      },
      {
        encryptJobId: "job-001",
        securityId: "security-001",
        lid: "lid-001",
        jobName: "货代操作主管",
        salaryDesc: "12-18K",
        locationName: "深圳·南山",
        experienceName: "3-5年",
        degreeName: "本科",
        postDescription: "负责订舱、单证、客户沟通和供应链流程。",
        brandName: "海联供应链",
        bossName: "李经理",
        activeTimeDesc: "今日活跃",
      },
    ],
  },
};

const jobs = extractBossJobs(payload, "https://www.zhipin.com/wapi/zpgeek/job/list.json");
assert.equal(jobs.length, 1);
assert.equal(jobs[0].id, "job-001");
assert.equal(jobs[0].salary, "12-18K");
assert.equal(jobs[0].recruiter, "李经理");
assert.equal(jobs[0].source, "api");
assert.deepEqual(jobs[0].identityKeys, ["job-001", "security-001", "lid-001"]);

const domJob: JobCandidate = {
  id: "job-001",
  title: "货代操作主管",
  company: "海联供应链",
  salary: "",
  location: "深圳·南山",
  experience: "",
  education: "",
  tags: ["物流"],
  detailUrl: "https://www.zhipin.com/job_detail/job-001.html",
  description: "",
  score: 75,
  status: "new",
  capturedAt: new Date().toISOString(),
  identityKeys: ["security-001"],
};
const matched = findMatchingBossJob(domJob, jobs);
assert.ok(matched);
const merged = mergeJobCandidate(domJob, matched);
assert.equal(merged.description, "负责订舱、单证、客户沟通和供应链流程。");
assert.equal(merged.salary, "12-18K");
assert.deepEqual(merged.identityKeys, ["security-001", "job-001", "lid-001"]);
assert.deepEqual(merged.tags, ["物流", "深圳·南山", "3-5年", "本科"]);

for (const [host, key] of [
  ["www.zhipin.com", "zhipin"],
  ["sou.zhaopin.com", "zhaopin"],
  ["jobs.51job.com", "51job"],
  ["www.liepin.com", "liepin"],
  ["www.shixiseng.com", "shixiseng"],
  ["www.nowcoder.com", "nowcoder"],
  ["www.yingjiesheng.com", "yingjiesheng"],
  ["www.iguopin.com", "iguopin"],
  ["www.lagou.com", "lagou"],
  ["zhaopin.58.com", "58"],
  ["maimai.cn", "maimai"],
] as const) {
  assert.equal(getPlatformAdapter(host)?.key, key, `adapter route failed: ${host}`);
}

const zhipin = getPlatformAdapter("www.zhipin.com");
assert.ok(zhipin?.routes?.list.some((route) => route.test("/web/geek/jobs")));
assert.ok(zhipin?.routes?.detail.some((route) => route.test("/job_detail/abc123")));
assert.equal(zhipin?.routes?.list.some((route) => route.test("/web/geek/chat")), false);
assert.ok(zhipin?.routes?.list.some((route) => route.test("/web/geek/job")));

const liepinJobs = extractLiepinJobs({ data: { data: { jobCardList: [
  { job: { jobId: "lp-001", title: "供应链运营", salary: "10-15K", dq: "广州", requireWorkYears: "3-5年", requireEduLevel: "本科", link: "https://www.liepin.com/job/lp-001" }, comp: { compId: "co-001", compName: "华南物流" }, recruiter: { recruiterId: "hr-001", recruiterName: "王经理", recruiterTitle: "招聘负责人" } },
  { job: { jobId: "lp-001", title: "供应链运营" }, comp: { compId: "co-001", compName: "华南物流" }, recruiter: { recruiterId: "hr-001", recruiterName: "王经理" } },
] } } }, "https://www.liepin.com/search");
assert.equal(liepinJobs.length, 1);
assert.equal(liepinJobs[0].company, "华南物流");
assert.equal(liepinJobs[0].recruiter, "王经理");
assert.equal(liepinJobs[0].platform, "liepin");
assert.equal(liepinJobs[0].salary, "10-15K");

console.log("API and adapter contract checks passed");
