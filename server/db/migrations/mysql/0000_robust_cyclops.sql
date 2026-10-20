CREATE TABLE `allocations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`node_id` int NOT NULL,
	`ip` varchar(45) NOT NULL,
	`port` int NOT NULL,
	`assigned` enum('yes','no') NOT NULL DEFAULT 'no',
	`server_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `allocations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `backups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uuid` varchar(36) NOT NULL,
	`server_id` int NOT NULL,
	`name` varchar(255) NOT NULL DEFAULT 'backup',
	`size` bigint NOT NULL DEFAULT 0,
	`status` enum('creating','completed','failed') NOT NULL DEFAULT 'creating',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `backups_id` PRIMARY KEY(`id`),
	CONSTRAINT `backups_uuid_unique` UNIQUE(`uuid`)
);
--> statement-breakpoint
CREATE TABLE `blueprints` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`image` varchar(500) NOT NULL DEFAULT 'ghcr.io/pterodactyl/yolks:java_17',
	`startup_command` text NOT NULL DEFAULT ('java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}'),
	`environment` text,
	`install_script` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `blueprints_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `database_hosts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`host` varchar(255) NOT NULL DEFAULT '127.0.0.1',
	`port` int NOT NULL DEFAULT 3306,
	`type` enum('mysql','postgresql') NOT NULL DEFAULT 'mysql',
	`username` varchar(255) NOT NULL,
	`password` varchar(255) NOT NULL,
	`node_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `database_hosts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`address` varchar(500),
	`city` varchar(100),
	`country` varchar(100),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `locations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `nodes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`url` varchar(500) NOT NULL,
	`token` text NOT NULL,
	`location_id` int,
	`memory` int DEFAULT 0,
	`disk` int DEFAULT 0,
	`server_types` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `nodes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `server_databases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`server_id` int NOT NULL,
	`host_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`username` varchar(255) NOT NULL,
	`password` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `server_databases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `servers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uuid` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`owner_id` int NOT NULL,
	`node_id` int NOT NULL,
	`allocation_id` int,
	`memory` int NOT NULL,
	`cpu` int NOT NULL,
	`disk` int NOT NULL,
	`swap` int DEFAULT 0,
	`io` int DEFAULT 500,
	`startup` text NOT NULL,
	`image` varchar(500) NOT NULL,
	`egg_id` int,
	`environment` text,
	`status` enum('installing','running','stopped','error') NOT NULL DEFAULT 'installing',
	`sftp_password` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`blueprint_id` int,
	CONSTRAINT `servers_id` PRIMARY KEY(`id`),
	CONSTRAINT `servers_uuid_unique` UNIQUE(`uuid`)
);
--> statement-breakpoint
CREATE TABLE `status_page_monitors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`page_id` int NOT NULL,
	`monitor_id` int NOT NULL,
	`monitor_name` varchar(255) NOT NULL,
	`monitor_type` varchar(50) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `status_page_monitors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `status_pages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uuid` varchar(36) NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`description` text,
	`logo_url` varchar(500),
	`is_public` enum('yes','no') NOT NULL DEFAULT 'yes',
	`tariff` enum('free','paid') NOT NULL DEFAULT 'free',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `status_pages_id` PRIMARY KEY(`id`),
	CONSTRAINT `status_pages_uuid_unique` UNIQUE(`uuid`),
	CONSTRAINT `status_pages_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uuid` varchar(36) NOT NULL,
	`email` varchar(255) NOT NULL,
	`name` varchar(255),
	`avatar` text,
	`provider` varchar(50) NOT NULL,
	`provider_id` varchar(255) NOT NULL,
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`sftp_password` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`last_login` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_uuid_unique` UNIQUE(`uuid`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `allocations` ADD CONSTRAINT `allocations_node_id_nodes_id_fk` FOREIGN KEY (`node_id`) REFERENCES `nodes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `allocations` ADD CONSTRAINT `allocations_server_id_servers_id_fk` FOREIGN KEY (`server_id`) REFERENCES `servers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `backups` ADD CONSTRAINT `backups_server_id_servers_id_fk` FOREIGN KEY (`server_id`) REFERENCES `servers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `database_hosts` ADD CONSTRAINT `database_hosts_node_id_nodes_id_fk` FOREIGN KEY (`node_id`) REFERENCES `nodes`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `nodes` ADD CONSTRAINT `nodes_location_id_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `server_databases` ADD CONSTRAINT `server_databases_server_id_servers_id_fk` FOREIGN KEY (`server_id`) REFERENCES `servers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `server_databases` ADD CONSTRAINT `server_databases_host_id_database_hosts_id_fk` FOREIGN KEY (`host_id`) REFERENCES `database_hosts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `servers` ADD CONSTRAINT `servers_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `servers` ADD CONSTRAINT `servers_node_id_nodes_id_fk` FOREIGN KEY (`node_id`) REFERENCES `nodes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `servers` ADD CONSTRAINT `servers_blueprint_id_blueprints_id_fk` FOREIGN KEY (`blueprint_id`) REFERENCES `blueprints`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `status_page_monitors` ADD CONSTRAINT `status_page_monitors_page_id_status_pages_id_fk` FOREIGN KEY (`page_id`) REFERENCES `status_pages`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `status_pages` ADD CONSTRAINT `status_pages_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;