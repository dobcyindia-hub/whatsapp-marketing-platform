import { relations } from "drizzle-orm";
import {
  teams,
  users,
  wabaAccounts,
  contacts,
  contactLists,
  contactListMembers,
  templates,
  campaigns,
  campaignRecipients,
  automations,
  automationRuns,
  messageEvents,
} from "./schema";

export const teamsRelations = relations(teams, ({ many }) => ({
  users: many(users),
  wabaAccounts: many(wabaAccounts),
  contacts: many(contacts),
  contactLists: many(contactLists),
  templates: many(templates),
  campaigns: many(campaigns),
  automations: many(automations),
}));

export const usersRelations = relations(users, ({ one }) => ({
  team: one(teams, { fields: [users.teamId], references: [teams.id] }),
}));

export const wabaAccountsRelations = relations(wabaAccounts, ({ one, many }) => ({
  team: one(teams, { fields: [wabaAccounts.teamId], references: [teams.id] }),
  templates: many(templates),
  campaigns: many(campaigns),
  automations: many(automations),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  team: one(teams, { fields: [contacts.teamId], references: [teams.id] }),
  listMemberships: many(contactListMembers),
}));

export const contactListsRelations = relations(contactLists, ({ one, many }) => ({
  team: one(teams, { fields: [contactLists.teamId], references: [teams.id] }),
  members: many(contactListMembers),
}));

export const contactListMembersRelations = relations(contactListMembers, ({ one }) => ({
  list: one(contactLists, { fields: [contactListMembers.listId], references: [contactLists.id] }),
  contact: one(contacts, { fields: [contactListMembers.contactId], references: [contacts.id] }),
}));

export const templatesRelations = relations(templates, ({ one, many }) => ({
  team: one(teams, { fields: [templates.teamId], references: [teams.id] }),
  wabaAccount: one(wabaAccounts, { fields: [templates.wabaAccountId], references: [wabaAccounts.id] }),
  campaigns: many(campaigns),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  team: one(teams, { fields: [campaigns.teamId], references: [teams.id] }),
  wabaAccount: one(wabaAccounts, { fields: [campaigns.wabaAccountId], references: [wabaAccounts.id] }),
  template: one(templates, { fields: [campaigns.templateId], references: [templates.id] }),
  list: one(contactLists, { fields: [campaigns.listId], references: [contactLists.id] }),
  recipients: many(campaignRecipients),
}));

export const campaignRecipientsRelations = relations(campaignRecipients, ({ one }) => ({
  campaign: one(campaigns, { fields: [campaignRecipients.campaignId], references: [campaigns.id] }),
  contact: one(contacts, { fields: [campaignRecipients.contactId], references: [contacts.id] }),
}));

export const automationsRelations = relations(automations, ({ one, many }) => ({
  team: one(teams, { fields: [automations.teamId], references: [teams.id] }),
  wabaAccount: one(wabaAccounts, { fields: [automations.wabaAccountId], references: [wabaAccounts.id] }),
  template: one(templates, { fields: [automations.templateId], references: [templates.id] }),
  runs: many(automationRuns),
}));

export const automationRunsRelations = relations(automationRuns, ({ one }) => ({
  automation: one(automations, { fields: [automationRuns.automationId], references: [automations.id] }),
  contact: one(contacts, { fields: [automationRuns.contactId], references: [contacts.id] }),
}));

export const messageEventsRelations = relations(messageEvents, ({ one }) => ({
  team: one(teams, { fields: [messageEvents.teamId], references: [teams.id] }),
  wabaAccount: one(wabaAccounts, { fields: [messageEvents.wabaAccountId], references: [wabaAccounts.id] }),
  contact: one(contacts, { fields: [messageEvents.contactId], references: [contacts.id] }),
}));
