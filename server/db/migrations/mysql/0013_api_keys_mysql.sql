CREATE TABLE `api_keys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`prefix` varchar(16) NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`scopes` text NOT NULL,
	`last_used_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_keys_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
ALTER TABLE `api_keys` ADD CONSTRAINT `api_keys_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `api_keys` ADD CONSTRAINT `api_keys_prefix_unique` UNIQUE(`prefix`);--> statement-breakpoint
ALTER TABLE `api_keys` ADD CONSTRAINT `api_keys_token_hash_unique` UNIQUE(`token_hash`);