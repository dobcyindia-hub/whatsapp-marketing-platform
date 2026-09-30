// Human-readable explanations for the WhatsApp Cloud API error codes that
// actually show up in practice. Meta's own messages are often generic
// ("message undeliverable") — this fills in what to actually do about it.
// Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes

export type ErrorCodeInfo = {
  title: string;
  explanation: string;
  action: string;
};

export const META_ERROR_CODES: Record<string, ErrorCodeInfo> = {
  "131042": {
    title: "Business eligibility / payment issue",
    explanation: "Meta rejected this message because your WhatsApp Business Account doesn't have a valid payment method on file, or has an unresolved billing issue.",
    action: "Add/update a payment method in Meta Business Settings → Billing, then retry.",
  },
  "131026": {
    title: "Message undeliverable",
    explanation: "The recipient's device could not be reached — often the number is invalid, unregistered on WhatsApp, or has blocked your business number.",
    action: "Confirm the number is correct and has WhatsApp installed. If they've blocked you, no retry will work.",
  },
  "131047": {
    title: "Re-engagement message outside the 24-hour window",
    explanation: "You tried to send a free-form message more than 24 hours after the customer's last message — only approved templates are allowed at that point.",
    action: "Use an approved template to re-engage instead of a plain message.",
  },
  "131053": {
    title: "Media upload error",
    explanation: "The media file (image/video/document) attached to this message could not be processed by Meta — often an unsupported format or size.",
    action: "Re-check the file type/size against Meta's limits and re-upload.",
  },
  "131048": {
    title: "Spam rate limit hit",
    explanation: "Meta detected an unusually high rate of messages being blocked/reported and is throttling your number.",
    action: "Slow down sending, review recipient consent, and check your number's quality rating in WhatsApp Manager.",
  },
  "132000": {
    title: "Template parameter mismatch",
    explanation: "The number of variables sent doesn't match what the approved template expects.",
    action: "Check the template's {{n}} count against the variable mapping used for this campaign.",
  },
  "133010": {
    title: "Phone number not registered",
    explanation: "The sending phone number isn't properly registered on the Cloud API.",
    action: "Re-verify the number's registration status in WhatsApp Manager.",
  },
  "368": {
    title: "Account restricted",
    explanation: "Meta has temporarily restricted this WhatsApp Business Account, usually for policy violations or a high block/report rate.",
    action: "Check Meta Business Suite for a restriction notice and appeal if needed.",
  },
};

export function explainErrorCode(code: string | null | undefined): ErrorCodeInfo | null {
  if (!code) return null;
  return META_ERROR_CODES[code] ?? null;
}
