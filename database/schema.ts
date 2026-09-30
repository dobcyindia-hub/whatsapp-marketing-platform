import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ---------- Enums ----------

export const templateStatusEnum = pgEnum("template_status", [
  "draft",
  "pending",
  "approved",
  "rejected",
  "paused",
  "disabled",
]);

export const templateCategoryEnum = pgEnum("template_category", [
  "marketing",
  "utility",
  "authentication",
]);

export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "scheduled",
  "sending",
  "paused",
  "completed",
  "failed",
  "cancelled",
]);

export const recipientStatusEnum = pgEnum("recipient_status", [
  "pending",
  "queued",
  "sent",
  "delivered",
  "read",
  "replied",
  "failed",
  "skipped_opted_out",
]);

export const wabaStatusEnum = pgEnum("waba_status", [
  "connected",
  "disconnected",
  "error",
]);

export const automationTriggerEnum = pgEnum("automation_trigger", [
  "contact_created",
  "keyword_reply",
  "opt_in",
]);

// ---------- Core tenancy ----------

export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id")
    .references(() => teams.id, { onDelete: "cascade" })
    .notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 255 }),
  role: varchar("role", { length: 32 }).default("owner").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  emailIdx: uniqueIndex("users_email_idx").on(t.email),
}));

// ---------- WhatsApp Business Account ----------

export const wabaAccounts = pgTable("waba_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id")
    .references(() => teams.id, { onDelete: "cascade" })
    .notNull(),
  wabaId: varchar("waba_id", { length: 128 }).notNull(),
  phoneNumberId: varchar("phone_number_id", { length: 128 }).notNull(),
  displayPhoneNumber: varchar("display_phone_number", { length: 32 }),
  displayName: varchar("display_name", { length: 255 }),
  accessTokenEncrypted: text("access_token_encrypted").notNull(),
  appId: varchar("app_id", { length: 128 }),
  webhookVerifyToken: varchar("webhook_verify_token", { length: 128 }).notNull(),
  status: wabaStatusEnum("status").default("disconnected").notNull(),
  messagingTier: varchar("messaging_tier", { length: 32 }).default("tier_1k"),
  // Per-conversation-category cost, entered manually in Settings (Meta doesn't
  // expose a live pricing API) — used only to estimate campaign spend.
  conversationRates: jsonb("conversation_rates")
    .$type<{ currency: string; marketing?: number; utility?: number; authentication?: number; service?: number }>()
    .default({ currency: "USD" }),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  teamIdx: index("waba_team_idx").on(t.teamId),
}));

// ---------- Contacts ----------

export const contactLists = pgTable("contact_lists", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id")
    .references(() => teams.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contacts = pgTable("contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id")
    .references(() => teams.id, { onDelete: "cascade" })
    .notNull(),
  phone: varchar("phone", { length: 32 }).notNull(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  attributes: jsonb("attributes").$type<Record<string, string>>().default({}),
  tags: jsonb("tags").$type<string[]>().default([]),
  optedOut: boolean("opted_out").default(false).notNull(),
  optedOutAt: timestamp("opted_out_at"),
  lastMessagedAt: timestamp("last_messaged_at"),
  lastInboundAt: timestamp("last_inbound_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  teamPhoneIdx: uniqueIndex("contacts_team_phone_idx").on(t.teamId, t.phone),
}));

export const contactListMembers = pgTable("contact_list_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  listId: uuid("list_id")
    .references(() => contactLists.id, { onDelete: "cascade" })
    .notNull(),
  contactId: uuid("contact_id")
    .references(() => contacts.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  listContactIdx: uniqueIndex("list_contact_idx").on(t.listId, t.contactId),
}));

// ---------- Templates (synced from Meta) ----------

export const templates = pgTable("templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id")
    .references(() => teams.id, { onDelete: "cascade" })
    .notNull(),
  wabaAccountId: uuid("waba_account_id")
    .references(() => wabaAccounts.id, { onDelete: "cascade" })
    .notNull(),
  metaTemplateId: varchar("meta_template_id", { length: 128 }),
  name: varchar("name", { length: 512 }).notNull(),
  language: varchar("language", { length: 16 }).notNull(),
  category: templateCategoryEnum("category").notNull(),
  status: templateStatusEnum("status").default("draft").notNull(),
  bodyText: text("body_text").notNull(),
  headerType: varchar("header_type", { length: 16 }),
  headerText: text("header_text"),
  footerText: text("footer_text"),
  buttons: jsonb("buttons").$type<Array<{ type: string; text: string; value?: string }>>().default([]),
  variableCount: integer("variable_count").default(0).notNull(),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  teamIdx: index("templates_team_idx").on(t.teamId),
  nameLangIdx: uniqueIndex("templates_name_lang_idx").on(t.wabaAccountId, t.name, t.language),
}));

// ---------- Campaigns ----------

export const campaigns = pgTable("campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id")
    .references(() => teams.id, { onDelete: "cascade" })
    .notNull(),
  wabaAccountId: uuid("waba_account_id")
    .references(() => wabaAccounts.id, { onDelete: "cascade" })
    .notNull(),
  templateId: uuid("template_id")
    .references(() => templates.id)
    .notNull(),
  listId: uuid("list_id").references(() => contactLists.id),
  name: varchar("name", { length: 255 }).notNull(),
  status: campaignStatusEnum("status").default("draft").notNull(),
  variableMapping: jsonb("variable_mapping").$type<Record<string, string>>().default({}),
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  totalRecipients: integer("total_recipients").default(0).notNull(),
  sentCount: integer("sent_count").default(0).notNull(),
  deliveredCount: integer("delivered_count").default(0).notNull(),
  readCount: integer("read_count").default(0).notNull(),
  failedCount: integer("failed_count").default(0).notNull(),
  repliedCount: integer("replied_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  teamIdx: index("campaigns_team_idx").on(t.teamId),
}));

export const campaignRecipients = pgTable("campaign_recipients", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id")
    .references(() => campaigns.id, { onDelete: "cascade" })
    .notNull(),
  contactId: uuid("contact_id")
    .references(() => contacts.id, { onDelete: "cascade" })
    .notNull(),
  status: recipientStatusEnum("status").default("pending").notNull(),
  variableValues: jsonb("variable_values").$type<Record<string, string>>().default({}),
  metaMessageId: varchar("meta_message_id", { length: 128 }),
  errorMessage: text("error_message"),
  errorCode: varchar("error_code", { length: 32 }),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  readAt: timestamp("read_at"),
  repliedAt: timestamp("replied_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  campaignIdx: index("campaign_recipients_campaign_idx").on(t.campaignId),
  metaMsgIdx: index("campaign_recipients_meta_msg_idx").on(t.metaMessageId),
}));

// ---------- Automations ----------

export const automations = pgTable("automations", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id")
    .references(() => teams.id, { onDelete: "cascade" })
    .notNull(),
  wabaAccountId: uuid("waba_account_id")
    .references(() => wabaAccounts.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  trigger: automationTriggerEnum("trigger").notNull(),
  triggerConfig: jsonb("trigger_config").$type<Record<string, unknown>>().default({}),
  templateId: uuid("template_id").references(() => templates.id),
  variableMapping: jsonb("variable_mapping").$type<Record<string, string>>().default({}),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const automationRuns = pgTable("automation_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  automationId: uuid("automation_id")
    .references(() => automations.id, { onDelete: "cascade" })
    .notNull(),
  contactId: uuid("contact_id").references(() => contacts.id),
  status: varchar("status", { length: 32 }).default("pending").notNull(),
  errorMessage: text("error_message"),
  triggeredAt: timestamp("triggered_at").defaultNow().notNull(),
});

// ---------- Webhook / message event log ----------

export const messageEvents = pgTable("message_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id")
    .references(() => teams.id, { onDelete: "cascade" })
    .notNull(),
  wabaAccountId: uuid("waba_account_id")
    .references(() => wabaAccounts.id, { onDelete: "cascade" })
    .notNull(),
  contactId: uuid("contact_id").references(() => contacts.id),
  eventType: varchar("event_type", { length: 32 }).notNull(), // sent, delivered, read, failed, inbound
  metaMessageId: varchar("meta_message_id", { length: 128 }),
  rawPayload: jsonb("raw_payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  teamIdx: index("message_events_team_idx").on(t.teamId),
  metaMsgIdx: index("message_events_meta_msg_idx").on(t.metaMessageId),
}));
