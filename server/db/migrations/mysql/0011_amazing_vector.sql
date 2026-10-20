CREATE TABLE `server_activity` (
	`id` int AUTO_INCREMENT NOT NULL,
	`server_id` int NOT NULL,
	`user_id` int,
	`action` varchar(64) NOT NULL,
	`detail` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `server_activity_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `server_activity` ADD CONSTRAINT `server_activity_server_id_servers_id_fk` FOREIGN KEY (`server_id`) REFERENCES `servers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `server_activity` ADD CONSTRAINT `server_activity_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;