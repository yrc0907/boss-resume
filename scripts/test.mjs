import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile(new URL("../dist/manifest.json", import.meta.url), "utf8"));
const content = await readFile(new URL("../dist/content/content.js", import.meta.url), "utf8");
assert.equal(manifest.manifest_version, 3);
assert.ok(manifest.host_permissions.includes("http://localhost/*"));
assert.ok(manifest.content_scripts?.[0]?.matches.includes("https://www.zhipin.com/*"));
for (const host of ["zhaopin.com", "51job.com", "liepin.com", "shixiseng.com", "nowcoder.com", "yingjiesheng.com", "iguopin.com", "lagou.com", "58.com", "maimai.cn"]) {
  assert.ok(manifest.host_permissions.some((permission) => permission.includes(host)), `missing host permission: ${host}`);
}
assert.match(content, /bjh-queue-button/);
assert.match(content, /bjh-add-all/);
assert.doesNotMatch(content, /立即沟通/);
assert.doesNotMatch(content, /fetch\(/);
console.log("Local extension checks passed");
