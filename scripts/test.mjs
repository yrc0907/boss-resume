// 静态验收脚本：检查 Manifest、构建产物和禁止外发动作。
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile(new URL("../dist/manifest.json", import.meta.url), "utf8"));
const content = await readFile(new URL("../dist/content/content.js", import.meta.url), "utf8");
const bridge = await readFile(new URL("../dist/content/page-bridge.js", import.meta.url), "utf8");
const contentSource = await readFile(new URL("../src/content/content.ts", import.meta.url), "utf8");
assert.equal(manifest.manifest_version, 3);
assert.ok(manifest.host_permissions.includes("http://localhost/*"));
assert.ok(manifest.content_scripts?.[0]?.matches.includes("https://www.zhipin.com/*"));
assert.equal(manifest.content_scripts?.[0]?.world, "MAIN");
for (const host of ["zhaopin.com", "51job.com", "liepin.com", "shixiseng.com", "nowcoder.com", "yingjiesheng.com", "iguopin.com", "lagou.com", "58.com", "maimai.cn"]) {
  assert.ok(manifest.host_permissions.some((permission) => permission.includes(host)), `missing host permission: ${host}`);
}
assert.match(content, /bjh-queue-button/);
assert.match(content, /bjh-add-all/);
assert.match(content, /bjh-load-more/);
assert.match(content, /selectorHits/);
assert.doesNotMatch(content, /fetch\(/);
for (const forbidden of [/sendMsg/i, /sendResume/i, /\.btn-send/i, /form\.submit/i, /submit\(/i]) {
  assert.doesNotMatch(contentSource, forbidden, `forbidden outbound action in content script: ${forbidden}`);
}
assert.match(bridge, /JOB_API_RESPONSE/);
assert.match(bridge, /pendingMessages/);
assert.match(content, /event\.origin\s*!==\s*location\.origin/);
assert.doesNotMatch(bridge, /\.click\(/);
assert.doesNotMatch(bridge, /method\s*:\s*["']POST/i);
console.log("Local extension checks passed");
