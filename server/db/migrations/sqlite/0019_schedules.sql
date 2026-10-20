CREATE TABLE `schedules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`server_id` integer NOT NULL,
	`name` text DEFAULT 'schedule' NOT NULL,
	`action` text DEFAULT 'restart' NOT NULL,
	`payload` text,
	`interval_minutes` integer DEFAULT 60 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`last_run_at` integer,
	`next_run_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`server_id`) REFERENCES `servers`(`id`) ON UPDATE no action ON DELETE cascade
);