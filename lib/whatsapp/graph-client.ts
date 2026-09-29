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
  example?: { header_handle?: string[] };
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

// Meta's resumable upload API: start a session against the app, then upload
// the bytes to get back a reusable "handle" for a template's media header.
export async function uploadTemplateMedia(params: {
  appId: string;
  accessToken: string;
  fileBytes: Buffer;
  fileType: string;
  fileName: string;
}): Promise<string> {
  const { appId, accessToken, fileBytes, fileType, fileName } = params;

  const startRes = await fetch(
    `${GRAPH_BASE}/${appId}/uploads?file_length=${fileBytes.length}&file_type=${encodeURIComponent(
      fileType
    )}&file_name=${encodeURIComponent(fileName)}`,
    { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const startBody = await startRes.json().catch(() => ({}));
  if (!startRes.ok) {
    throw new GraphApiError(
      startBody?.error?.message ?? "Could not start media upload",
      startRes.status,
      startBody?.error?.code
    );
  }
  const uploadSessionId: string = startBody.id;

  const uploadRes = await fetch(`${GRAPH_BASE}/${uploadSessionId}`, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${accessToken}`,
      file_offset: "0",
    },
    body: new Uint8Array(fileBytes),
  });
  const uploadBody = await uploadRes.json().catch(() => ({}));
  if (!uploadRes.ok || !uploadBody.h) {
    throw new GraphApiError(
      uploadBody?.error?.message ?? "Could not upload media bytes",
      uploadRes.status,
      uploadBody?.error?.code
    );
  }
  return uploadBody.h as string;
}

export async function sendTemplateMessage(params: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  templateName: string;
  languageCode: string;
  bodyParams?: string[];
}): Promise<{ messages: Array<{ id: string }> }> {
  const { phoneNumberId, accessToken, to, templateName, languageCode, bodyParams } = params;
  return graphFetch(`/${phoneNumberId}/messages`, accessToken, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(bodyParams && bodyParams.length > 0
          ? { components: [{ type: "body", parameters: bodyParams.map((text) => ({ type: "text", text })) }] }
          : {}),
      },
    }),
  });
}
