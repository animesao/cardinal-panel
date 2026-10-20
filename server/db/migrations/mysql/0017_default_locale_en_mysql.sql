ALTER TABLE `users` MODIFY `locale` varchar(10) DEFAULT 'en' NOT NULL;
--> statement-breakpoint
UPDATE `users` SET `locale` = 'en' WHERE `locale` = 'ru';