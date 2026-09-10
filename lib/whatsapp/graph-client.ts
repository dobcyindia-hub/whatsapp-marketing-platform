const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export class GraphApiError extends Error {
  status: number;
  code?: number;
  constructor(message: string, status: number, code?: number) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function graphFetch(path: string, accessToken: string, init?: RequestInit) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body?.error?.message ?? `Meta API request failed with status ${res.status}`;
    throw new GraphApiError(message, res.status, body?.error?.code);
  }
  return body;
}

export type PhoneNumberInfo = {
  id: string;
  display_phone_number: string;
  verified_name: string;
  quality_rating?: string;
};

export async function fetchPhoneNumberInfo(
  phoneNumberId: string,
  accessToken: string
): Promise<PhoneNumberInfo> {
  return graphFetch(
    `/${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating`,
    accessToken
  );
}

export type MetaTemplateComponent = {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  text?: string;
  buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>;
};

export type MetaTemplate = {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  rejected_reason?: string;
  components: MetaTemplateComponent[];
};

export async function fetchTemplates(wabaId: string, accessToken: string): Promise<MetaTemplate[]> {
  const results: MetaTemplate[] = [];
  let path: string | null =
    `/${wabaId}/message_templates?fields=id,name,language,category,status,rejected_reason,components&limit=200`;

  while (path) {
    const page = await graphFetch(path, accessToken);
    results.push(...(page.data ?? []));
    const next: string | undefined = page.paging?.next;
    path = next ? next.slice(next.indexOf(GRAPH_VERSION) + GRAPH_VERSION.length) : null;
  }

  return results;
}

export async function createTemplate(params: {
  wabaId: string;
  accessToken: string;
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  components: MetaTemplateComponent[];
}): Promise<{ id: string; status: string; category: string }> {
  const { wabaId, accessToken, name, language, category, components } = params;
  return graphFetch(`/${wabaId}/message_templates`, accessToken, {
    method: "POST",
    body: JSON.stringify({ name, language, category, components }),
  });
}
