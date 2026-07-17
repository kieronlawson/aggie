const ERROR_BODY_SNIPPET_LENGTH = 500;

export type JsonInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
};

export const fetchJson = async (url: string, init: JsonInit = {}): Promise<unknown> => {
  const response = await fetch(url, {
    method: init.method ?? "GET",
    headers: { "content-type": "application/json", ...init.headers },
    body: init.body === undefined ? undefined : JSON.stringify(init.body)
  });
  const text = await response.text();
  if (!response.ok) {
    const snippet = text.slice(0, ERROR_BODY_SNIPPET_LENGTH);
    throw new Error(`HTTP ${response.status} from ${url}: ${snippet}`);
  }
  return text === "" ? {} : JSON.parse(text);
};

export const fetchText = async (url: string, headers: Record<string, string> = {}): Promise<string> => {
  const response = await fetch(url, { headers, redirect: "follow" });
  const text = await response.text();
  if (!response.ok) {
    const snippet = text.slice(0, ERROR_BODY_SNIPPET_LENGTH);
    throw new Error(`HTTP ${response.status} from ${url}: ${snippet}`);
  }
  return text;
};
