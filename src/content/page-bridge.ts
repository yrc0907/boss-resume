const BRIDGE_FLAG = "__bossJobHelperPageBridgeInstalled__";
const MESSAGE_SOURCE = "boss-job-helper-page";
const CONTENT_SOURCE = "boss-job-helper-content";
let contentReady = false;
const pendingMessages: Array<{ url: string; payload: unknown }> = [];

/** 页面主世界只读桥接：观察 Boss 岗位 GET 响应并转发脱敏后的 JSON，不修改请求、不发起新请求。 */
if (!(window as unknown as Record<string, unknown>)[BRIDGE_FLAG]) {
  (window as unknown as Record<string, unknown>)[BRIDGE_FLAG] = true;
  window.addEventListener("message", (event) => {
    const message = event.data as { source?: string; type?: string } | null;
    if (event.source !== window || message?.source !== CONTENT_SOURCE || message.type !== "READY") return;
    contentReady = true;
    while (pendingMessages.length) {
      const next = pendingMessages.shift();
      if (next) publishNow(next.url, next.payload);
    }
  });
  installFetchObserver();
  installXhrObserver();
}

function isJobApi(url: string): boolean {
  return /zhipin\.com\/wapi\/zpgeek\/job\/(?:detail|recommend|list)|\/wapi\/zpgeek\/job\/detail\.json|liepin\.com\/.*com\.liepin\.searchfront4c\.pc-search-job/i.test(url);
}

function publish(url: string, payload: unknown): void {
  if (!contentReady) {
    pendingMessages.push({ url, payload });
    if (pendingMessages.length > 20) pendingMessages.shift();
    return;
  }
  publishNow(url, payload);
}

function publishNow(url: string, payload: unknown): void {
  window.postMessage({ source: MESSAGE_SOURCE, type: "JOB_API_RESPONSE", url, payload }, location.origin);
}

function installFetchObserver(): void {
  const current = window.fetch;
  if (typeof current !== "function") return;
  window.fetch = async function observedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const response = await current.call(this, input, init);
    const method = String(init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    const url = String(input instanceof Request ? input.url : input);
    if (method === "GET" && isJobApi(url)) {
      void response.clone().json().then((payload) => publish(url, payload)).catch(() => undefined);
    }
    return response;
  };
}

function installXhrObserver(): void {
  const proto = XMLHttpRequest.prototype;
  const open = proto.open;
  const send = proto.send;
  proto.open = function observedOpen(method: string, url: string | URL, ...rest: unknown[]): void {
    (this as XMLHttpRequest & { __bjhUrl?: string; __bjhMethod?: string }).__bjhUrl = String(url);
    (this as XMLHttpRequest & { __bjhUrl?: string; __bjhMethod?: string }).__bjhMethod = String(method || "GET").toUpperCase();
    Reflect.apply(open, this, [method, url, ...rest]);
  };
  proto.send = function observedSend(body?: Document | XMLHttpRequestBodyInit | null): void {
    this.addEventListener("load", () => {
      const state = this as XMLHttpRequest & { __bjhUrl?: string; __bjhMethod?: string };
      if (state.__bjhMethod === "GET" && state.__bjhUrl && isJobApi(state.__bjhUrl)) {
        try { publish(state.__bjhUrl, JSON.parse(state.responseText)); } catch { /* 非 JSON 响应不处理 */ }
      }
    });
    send.call(this, body);
  };
}
