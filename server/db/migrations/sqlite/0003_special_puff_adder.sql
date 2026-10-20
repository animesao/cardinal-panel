ALTER TABLE `database_hosts` ADD `provisioning` text DEFAULT 'external' NOT NULL;--> statement-breakpoint
ALTER TABLE `database_hosts` ADD `container_ref` text;