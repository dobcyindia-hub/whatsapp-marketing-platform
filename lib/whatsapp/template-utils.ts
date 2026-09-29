import type { MetaTemplate, MetaTemplateComponent } from "./graph-client";

export function countVariables(text: string): number {
  const matches = [...text.matchAll(/\{\{\s*(\d+)\s*\}\}/g)];
  if (matches.length === 0) return 0;
  return Math.max(...matches.map((m) => parseInt(m[1], 10)));
}

export type TemplateButtonInput = {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
  text: string;
  value?: string; // URL for type URL, phone number for type PHONE_NUMBER
};

export function buildTemplateComponents(params: {
  headerType?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  headerText?: string;
  headerMediaHandle?: string;
  bodyText: string;
  footerText?: string;
  buttons?: TemplateButtonInput[];
}): MetaTemplateComponent[] {
  const components: MetaTemplateComponent[] = [];

  if (params.headerType === "TEXT" && params.headerText) {
    components.push({ type: "HEADER", format: "TEXT", text: params.headerText });
  } else if (
    (params.headerType === "IMAGE" || params.headerType === "VIDEO" || params.headerType === "DOCUMENT") &&
    params.headerMediaHandle
  ) {
    components.push({
      type: "HEADER",
      format: params.headerType,
      example: { header_handle: [params.headerMediaHandle] },
    });
  }

  components.push({ type: "BODY", text: params.bodyText });

  if (params.footerText) {
    components.push({ type: "FOOTER", text: params.footerText });
  }

  if (params.buttons && params.buttons.length > 0) {
    components.push({
      type: "BUTTONS",
      buttons: params.buttons.map((b) => ({
        type: b.type,
        text: b.text,
        ...(b.type === "URL" ? { url: b.value } : {}),
        ...(b.type === "PHONE_NUMBER" ? { phone_number: b.value } : {}),
      })),
    });
  }

  return components;
}

export function parseMetaTemplate(template: MetaTemplate) {
  const body = template.components.find((c) => c.type === "BODY");
  const header = template.components.find((c) => c.type === "HEADER");
  const footer = template.components.find((c) => c.type === "FOOTER");
  const buttonsComponent = template.components.find((c) => c.type === "BUTTONS");

  const bodyText = body?.text ?? "";

  return {
    bodyText,
    headerType: header?.format ?? null,
    headerText: header?.text ?? null,
    footerText: footer?.text ?? null,
    buttons: buttonsComponent?.buttons?.map((b) => ({ type: b.type, text: b.text, value: b.url ?? b.phone_number })) ?? [],
    variableCount: countVariables(bodyText),
  };
}

export function renderPreview(bodyText: string, sampleValues?: Record<string, string>): string {
  return bodyText.replace(/\{\{\s*(\d+)\s*\}\}/g, (_match, n) => {
    const key = String(n);
    return sampleValues?.[key] ?? `[Var ${n}]`;
  });
}

export type VariableMapping = Record<string, string>; // "1" -> "field:name" | "field:phone" | "field:email" | "static:<text>"

export type MappableContact = {
  name: string | null;
  phone: string;
  email: string | null;
};

// Resolves a campaign's variable mapping into an ordered array of body
// params (index 0 = {{1}}, etc.) for one specific contact.
export function resolveVariablesForContact(
  variableCount: number,
  mapping: VariableMapping,
  contact: MappableContact
): string[] {
  const params: string[] = [];
  for (let i = 1; i <= variableCount; i++) {
    const raw = mapping[String(i)] ?? "";
    if (raw.startsWith("field:")) {
      const field = raw.slice("field:".length);
      if (field === "name") params.push(contact.name || contact.phone);
      else if (field === "email") params.push(contact.email || "");
      else params.push(contact.phone);
    } else if (raw.startsWith("static:")) {
      params.push(raw.slice("static:".length));
    } else {
      params.push("");
    }
  }
  return params;
}
