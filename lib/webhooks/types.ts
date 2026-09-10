export type MetaStatusUpdate = {
  id: string; // WhatsApp message id (wamid)
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ code: number; title: string; message?: string }>;
};

export type MetaInboundMessage = {
  from: string; // sender's phone number, no "+"
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
};

export type MetaWebhookValue = {
  messaging_product: "whatsapp";
  metadata: { display_phone_number: string; phone_number_id: string };
  contacts?: Array<{ profile: { name?: string }; wa_id: string }>;
  statuses?: MetaStatusUpdate[];
  messages?: MetaInboundMessage[];
};

export type MetaWebhookPayload = {
  object: string;
  entry: Array<{
    id: string; // WABA id
    changes: Array<{ field: string; value: MetaWebhookValue }>;
  }>;
};
