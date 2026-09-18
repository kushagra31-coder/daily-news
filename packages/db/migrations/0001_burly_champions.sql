ALTER TABLE `articles` ADD `click_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `articles` ADD `user_reports` integer DEFAULT 0 NOT NULL;