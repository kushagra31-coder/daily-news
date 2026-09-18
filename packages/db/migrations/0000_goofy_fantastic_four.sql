CREATE TABLE `articles` (
	`id` text PRIMARY KEY NOT NULL,
	`url_hash` text NOT NULL,
	`title_hash` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`canonical_url` text NOT NULL,
	`source_id` text NOT NULL,
	`category` text NOT NULL,
	`image_url` text,
	`published_at` integer NOT NULL,
	`fetched_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`cluster_id` text,
	`verification_score` real NOT NULL,
	`verification_tier` text NOT NULL,
	`is_breaking` integer DEFAULT false,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `clusters` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`topic` text
);
--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`feed_url` text NOT NULL,
	`category` text NOT NULL,
	`country` text NOT NULL,
	`trust_score` real NOT NULL,
	`active` integer DEFAULT true
);
--> statement-breakpoint
CREATE UNIQUE INDEX `articles_url_hash_unique` ON `articles` (`url_hash`);