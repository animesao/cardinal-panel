CREATE TABLE `sftp_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`server_id` int NOT NULL,
	`user_id` int NOT NULL,
	`username` varchar(64) NOT NULL,
	`password` varchar(128) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sftp_credentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `sftp_credentials_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
ALTER TABLE `sftp_credentials` ADD CONSTRAINT `sftp_credentials_server_id_servers_id_fk` FOREIGN KEY (`server_id`) REFERENCES `servers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sftp_credentials` ADD CONSTRAINT `sftp_credentials_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;