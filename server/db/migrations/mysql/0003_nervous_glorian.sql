ALTER TABLE `database_hosts` ADD `provisioning` enum('container','external') DEFAULT 'external' NOT NULL;--> statement-breakpoint
ALTER TABLE `database_hosts` ADD `container_ref` varchar(255);