import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const sources = sqliteTable('sources', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  feed_url: text('feed_url').notNull(),
  category: text('category').notNull(),
  country: text('country').notNull(),
  trust_score: real('trust_score').notNull(),
  active: integer('active', { mode: 'boolean' }).default(true)
});

export const articles = sqliteTable('articles', {
  id: text('id').primaryKey(),
  url_hash: text('url_hash').notNull().unique(),
  title_hash: text('title_hash').notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  canonical_url: text('canonical_url').notNull(),
  source_id: text('source_id').notNull().references(() => sources.id),
  category: text('category').notNull(),
  image_url: text('image_url'),
  published_at: integer('published_at', { mode: 'timestamp' }).notNull(),
  fetched_at: integer('fetched_at', { mode: 'timestamp' }).notNull(),
  expires_at: integer('expires_at', { mode: 'timestamp' }).notNull(),
  cluster_id: text('cluster_id'),
  verification_score: real('verification_score').notNull(),
  verification_tier: text('verification_tier').notNull(),
  is_breaking: integer('is_breaking', { mode: 'boolean' }).default(false),
  click_count: integer('click_count').default(0).notNull(),
  user_reports: integer('user_reports').default(0).notNull()
});

export const clusters = sqliteTable('clusters', {
  id: text('id').primaryKey(),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull(),
  topic: text('topic')
});

export type Source = typeof sources.$inferSelect;
export type InsertSource = typeof sources.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type InsertArticle = typeof articles.$inferInsert;
export type Cluster = typeof clusters.$inferSelect;
export type InsertCluster = typeof clusters.$inferInsert;
