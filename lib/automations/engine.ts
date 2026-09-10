import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { automations, automationRuns } from "@/database/schema";
import { decryptSecret } from "@/lib/crypto";
import { sendTemplateMessage, GraphApiError } from "@/lib/whatsapp/graph-client";
import { resolveVariablesForContact } from "@/lib/whatsapp/template-utils";

type MappableContact = {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  optedOut: boolean;
};

async function sendAutomationMessage(
  automation: NonNullable<Awaited<ReturnType<typeof loadAutomationWithRelations>>>,
  contact: MappableContact
) {
  if (contact.optedOut) return;

  const { template, wabaAccount } = automation;
  if (!template || template.status !== "approved") {
    await db.insert(automationRuns).values({
      automationId: automation.id,
      contactId: contact.id,
      status: "failed",
      errorMessage: "Automation's template is not approved",
    });
    return;
  }

  const bodyParams = resolveVariablesForContact(template.variableCount, automation.variableMapping ?? {}, {
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
  });

  try {
    const accessToken = decryptSecret(wabaAccount.accessTokenEncrypted);
    await sendTemplateMessage({
      phoneNumberId: wabaAccount.phoneNumberId,
      accessToken,
      to: contact.phone,
      templateName: template.name,
      languageCode: template.language,
      bodyParams,
    });
    await db.insert(automationRuns).values({ automationId: automation.id, contactId: contact.id, status: "sent" });
  } catch (err) {
    const message = err instanceof GraphApiError ? err.message : "Failed to reach the Meta Graph API";
    await db.insert(automationRuns).values({
      automationId: automation.id,
      contactId: contact.id,
      status: "failed",
      errorMessage: message,
    });
  }
}

function loadAutomationWithRelations(id: string) {
  return db.query.automations.findFirst({
    where: eq(automations.id, id),
    with: { template: true, wabaAccount: true },
  });
}

async function loadActiveAutomations(
  teamId: string,
  trigger: "contact_created" | "keyword_reply" | "opt_in",
  wabaAccountId?: string
) {
  return db.query.automations.findMany({
    where: and(
      eq(automations.teamId, teamId),
      eq(automations.trigger, trigger),
      eq(automations.isActive, true),
      ...(wabaAccountId ? [eq(automations.wabaAccountId, wabaAccountId)] : [])
    ),
    with: { template: true, wabaAccount: true },
  });
}

export async function fireContactCreatedAutomations(teamId: string, contact: MappableContact) {
  const matches = await loadActiveAutomations(teamId, "contact_created");
  for (const automation of matches) {
    await sendAutomationMessage(automation, contact);
  }
}

export async function fireOptInAutomations(teamId: string, contact: MappableContact) {
  const matches = await loadActiveAutomations(teamId, "opt_in");
  for (const automation of matches) {
    await sendAutomationMessage(automation, contact);
  }
}

export async function fireKeywordReplyAutomations(params: {
  teamId: string;
  wabaAccountId: string;
  contact: MappableContact;
  messageText: string;
}) {
  const { teamId, wabaAccountId, contact, messageText } = params;
  const matches = await loadActiveAutomations(teamId, "keyword_reply", wabaAccountId);
  const normalized = messageText.trim().toLowerCase();

  for (const automation of matches) {
    const keyword = (automation.triggerConfig as { keyword?: string })?.keyword?.trim().toLowerCase();
    if (!keyword || !normalized.includes(keyword)) continue;
    await sendAutomationMessage(automation, contact);
  }
}
