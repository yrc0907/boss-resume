import { fiftyEightAdapter } from "./fifty-eight";
import { fiftyOneJobAdapter } from "./fifty-one-job";
import { iguopinAdapter } from "./iguopin";
import { lagouAdapter } from "./lagou";
import { liepinAdapter } from "./liepin";
import { maimaiAdapter } from "./maimai";
import { nowcoderAdapter } from "./nowcoder";
import { shixisengAdapter } from "./shixiseng";
import { yingjieshengAdapter } from "./yingjiesheng";
import { zhaopinAdapter } from "./zhaopin";
import { zhipinAdapter } from "./zhipin";
import type { PlatformAdapter } from "./types";

/** 所有平台适配器的唯一注册入口。 */
export const PLATFORM_ADAPTERS: PlatformAdapter[] = [demoAdapter, zhipinAdapter, zhaopinAdapter, fiftyOneJobAdapter, liepinAdapter, shixisengAdapter, nowcoderAdapter, yingjieshengAdapter, iguopinAdapter, lagouAdapter, fiftyEightAdapter, maimaiAdapter];

/** 根据当前域名选择适配器，未知站点返回 null。 */
export function getPlatformAdapter(hostname: string): PlatformAdapter | null {
  const normalized = hostname.toLowerCase().replace(/^www\./, "");
  return PLATFORM_ADAPTERS.find((adapter) => adapter.hosts.some((host) => normalized === host || normalized.endsWith(`.${host}`))) ?? null;
}
import { demoAdapter } from "./demo";
