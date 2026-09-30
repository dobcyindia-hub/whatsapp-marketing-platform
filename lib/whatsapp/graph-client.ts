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
  quality_score?: { score: string; date?: string };
  components: MetaTemplateComponent[];
};

export async function fetchTemplates(wabaId: string, accessToken: string): Promise<MetaTemplate[]> {
  const results: MetaTemplate[] = [];
  let path: string | null =
    `/${wabaId}/message_templates?fields=id,name,language,category,status,rejected_reason,quality_score,components&limit=200`;

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

// Regular (non-resumable) media upload used for session messages — distinct
// from uploadTemplateMedia's resumable-upload flow used at template
// creation time. Returns a media id valid for ~30 days, single WABA use.
export async function uploadMessageMedia(params: {
  phoneNumberId: string;
  accessToken: string;
  fileBytes: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<string> {
  const { phoneNumberId, accessToken, fileBytes, mimeType, fileName } = params;
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("file", new Blob([new Uint8Array(fileBytes)], { type: mimeType }), fileName);

  const res = await fetch(`${GRAPH_BASE}/${phoneNumberId}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.id) {
    throw new GraphApiError(body?.error?.message ?? "Could not upload media", res.status, body?.error?.code);
  }
  return body.id as string;
}

export type MessageMediaType = "image" | "video" | "document" | "audio";

// Free-form session message — only deliverable within 24h of the customer's
// last inbound message (Meta's customer-service-window policy). Outside
// that window Meta rejects it with error 131047; use a template instead.
export async function sendSessionMessage(params: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  text?: string;
  media?: { type: MessageMediaType; id: string; caption?: string; filename?: string };
}): Promise<{ messages: Array<{ id: string }> }> {
  const { phoneNumberId, accessToken, to, text, media } = params;

  const payload: Record<string, unknown> = { messaging_product: "whatsapp", to };
  if (media) {
    payload.type = media.type;
    payload[media.type] = {
      id: media.id,
      ...(media.caption ? { caption: media.caption } : {}),
      ...(media.type === "document" && media.filename ? { filename: media.filename } : {}),
    };
  } else {
    payload.type = "text";
    payload.text = { body: text ?? "" };
  }

  return graphFetch(`/${phoneNumberId}/messages`, accessToken, {
    method: "POST",
    body: JSON.stringify(payload),
  });
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
