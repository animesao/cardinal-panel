CREATE TABLE `settings` (
	`name` varchar(100) NOT NULL,
	`value` text NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE now(),
	CONSTRAINT `settings_name` PRIMARY KEY(`name`)
);