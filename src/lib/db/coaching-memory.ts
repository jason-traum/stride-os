import { sql } from 'drizzle-orm';
import { integer, text, real, sqliteTable } from 'drizzle-orm/sqlite-core';

// Schema definitions
export const coachingInsights = sqliteTable('coaching_insights', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  profileId: integer('profile_id').notNull(),
  category: text('category', {
    enum: ['preference', 'injury', 'goal', 'constraint', 'pattern', 'feedback']
  }).notNull(),
  subcategory: text('subcategory'),
  insight: text('insight').notNull(),
  confidence: real('confidence').notNull().default(0.5),
  source: text('source', { enum: ['explicit', 'inferred'] }).notNull(),
  extractedFrom: text('extracted_from').notNull(),
  metadata: text('metadata'), // JSON
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  lastValidated: text('last_validated').notNull().default(sql`CURRENT_TIMESTAMP`),
  expiresAt: text('expires_at'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
});

export const conversationSummaries = sqliteTable('conversation_summaries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  profileId: integer('profile_id').notNull(),
  conversationDate: text('conversation_date').notNull(),
  messageCount: integer('message_count').notNull(),
  summary: text('summary').notNull(),
  keyDecisions: text('key_decisions'), // JSON array
  keyPreferences: text('key_preferences'), // JSON array
  keyFeedback: text('key_feedback'), // JSON array
  tags: text('tags'), // JSON array
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insightConnections = sqliteTable('insight_connections', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  fromInsightId: integer('from_insight_id').notNull(),
  toInsightId: integer('to_insight_id').notNull(),
  connectionType: text('connection_type', {
    enum: ['contradicts', 'supports', 'related_to', 'supersedes']
  }).notNull(),
  strength: real('strength').notNull().default(0.5),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Type exports
export type CoachingInsight = typeof coachingInsights.$inferSelect;
export type NewCoachingInsight = typeof coachingInsights.$inferInsert;
export type ConversationSummary = typeof conversationSummaries.$inferSelect;
export type NewConversationSummary = typeof conversationSummaries.$inferInsert;
export type InsightConnection = typeof insightConnections.$inferSelect;
export type NewInsightConnection = typeof insightConnections.$inferInsert;