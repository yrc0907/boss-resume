/** Chrome 扩展 API 的最小类型声明，避免业务层依赖外部类型包。 */
declare namespace chrome {
  namespace storage {
    const local: {
      get(keys?: string[] | Record<string, unknown>): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
    };
  }
  namespace runtime {
    const onMessage: {
      addListener(
        callback: (
          message: unknown,
          sender: unknown,
          sendResponse: (response: unknown) => void,
        ) => boolean | void,
      ): void;
    };
    function sendMessage<T = unknown>(message: unknown): Promise<T>;
    function getURL(path: string): string;
  }
  namespace tabs {
    function query(queryInfo: { active?: boolean; currentWindow?: boolean }): Promise<Array<{ id?: number; url?: string }>>;
    function sendMessage<T = unknown>(tabId: number, message: unknown): Promise<T>;
  }
  namespace action {
    function setBadgeText(details: { text: string }): Promise<void>;
    function setBadgeBackgroundColor(details: { color: string }): Promise<void>;
  }
}
