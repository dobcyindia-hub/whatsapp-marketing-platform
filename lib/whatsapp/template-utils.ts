import type { MetaTemplate, MetaTemplateComponent } from "./graph-client";

export function countVariables(text: string): number {
  const matches = [...text.matchAll(/\{\{\s*(\d+)\s*\}\}/g)];
  if (matches.length === 0) return 0;
  return Math.max(...matches.map((m) => parseInt(m[1], 10)));
}

export function buildTemplateComponents(params: {
  headerText?: string;
  bodyText: string;
  footerText?: string;
}): MetaTemplateComponent[] {
  const components: MetaTemplateComponent[] = [];
  if (params.headerText) {
    components.push({ type: "HEADER", format: "TEXT", text: params.headerText });
  }
  components.push({ type: "BODY", text: params.bodyText });
  if (params.footerText) {
    components.push({ type: "FOOTER", text: params.footerText });
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
