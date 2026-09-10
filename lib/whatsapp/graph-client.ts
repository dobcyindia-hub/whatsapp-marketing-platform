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
