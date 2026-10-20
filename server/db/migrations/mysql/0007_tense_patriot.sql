CREATE TABLE `server_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`server_id` int NOT NULL,
	`user_id` int NOT NULL,
	`permissions` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `server_users_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `server_users` ADD CONSTRAINT `server_users_server_id_servers_id_fk` FOREIGN KEY (`server_id`) REFERENCES `servers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `server_users` ADD CONSTRAINT `server_users_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;