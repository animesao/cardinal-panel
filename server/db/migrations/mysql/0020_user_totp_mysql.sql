CREATE TABLE `user_totp` (
	`user_id` int NOT NULL,
	`secret` text NOT NULL,
	`enabled` int DEFAULT 0 NOT NULL,
	`backup_codes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE now(),
	CONSTRAINT `user_totp_user_id` PRIMARY KEY(`user_id`)
);--> statement-breakpoint
ALTER TABLE `user_totp` ADD CONSTRAINT `user_totp_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
