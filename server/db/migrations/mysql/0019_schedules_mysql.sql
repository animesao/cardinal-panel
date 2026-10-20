CREATE TABLE `schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`server_id` int NOT NULL,
	`name` varchar(255) DEFAULT 'schedule' NOT NULL,
	`action` enum('start','stop','restart','command') DEFAULT 'restart' NOT NULL,
	`payload` text,
	`interval_minutes` int DEFAULT 60 NOT NULL,
	`active` int DEFAULT 1 NOT NULL,
	`last_run_at` timestamp,
	`next_run_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `schedules_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_server_id_servers_id_fk` FOREIGN KEY (`server_id`) REFERENCES `servers`(`id`) ON DELETE cascade ON UPDATE no action;