// @ts-nocheck
// server/db/schema.ts — схема БД панели в двух диалектах.
//
// По умолчанию (DB_DIALECT=sqlite) таблицы строятся через sqliteTable,
// при DB_DIALECT=mysql — через mysqlTable. Имена таблиц/колонок одинаковые,
// поэтому весь код роутов работает без изменений на обеих БД.
// Особенности sqlite-ветки:
//   - enum → TEXT (проверки значений на стороне кода, как и раньше);
//   - timestamp → INTEGER seconds + DEFAULT (unixepoch());
//   - updatedAt без onUpdateNow (sqlite его не умеет) — обновляется только
//     явной записью.
import { sql } from 'drizzle-orm'
import {
  mysqlTable, mysqlEnum, varchar, int, text as mtext,
  timestamp as mts, bigint,
} from 'drizzle-orm/mysql-core'
import {
  sqliteTable, text as stext, integer,
} from 'drizzle-orm/sqlite-core'
import { IS_SQLITE } from './dialect'

export const users = IS_SQLITE
  ? sqliteTable('users', {
      id: integer('id').primaryKey({ autoIncrement: true }),
      uuid: stext('uuid').notNull().unique(),
      email: stext('email').notNull().unique(),
      name: stext('name'),
      avatar: stext('avatar'),
      provider: stext('provider').notNull(),
      providerId: stext('provider_id').notNull(),
      role: stext('role', { enum: ['user', 'admin'] }).default('user').notNull(),
      sftpPassword: stext('sftp_password'),
      passwordHash: stext('password_hash'),
      locale: stext('locale').default('en').notNull(),
      createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
      lastLogin: integer('last_login', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
      updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
    })
  : mysqlTable('users', {
      id: int('id').autoincrement().primaryKey(),
      uuid: varchar('uuid', { length: 36 }).notNull().unique(),
      email: varchar('email', { length: 255 }).notNull().unique(),
      name: varchar('name', { length: 255 }),
      avatar: mtext('avatar'),
      provider: varchar('provider', { length: 50 }).notNull(),
      providerId: varchar('provider_id', { length: 255 }).notNull(),
      role: mysqlEnum('role', ['user', 'admin']).default('user').notNull(),
      sftpPassword: varchar('sftp_password', { length: 64 }),
      passwordHash: mtext('password_hash'),
      locale: varchar('locale', { length: 10 }).default('en').notNull(),
      createdAt: mts('created_at').defaultNow().notNull(),
      lastLogin: mts('last_login').defaultNow().notNull(),
      updatedAt: mts('updated_at').defaultNow().onUpdateNow().notNull(),
    })

export const locations = IS_SQLITE
  ? sqliteTable('locations', {
      id: integer('id').primaryKey({ autoIncrement: true }),
      name: stext('name').notNull(),
      description: stext('description'),
      address: stext('address'),
      city: stext('city'),
      country: stext('country'),
      createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
      updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
    })
  : mysqlTable('locations', {
      id: int('id').autoincrement().primaryKey(),
      name: varchar('name', { length: 255 }).notNull(),
      description: mtext('description'),
      address: varchar('address', { length: 500 }),
      city: varchar('city', { length: 100 }),
      country: varchar('country', { length: 100 }),
      createdAt: mts('created_at').defaultNow().notNull(),
      updatedAt: mts('updated_at').defaultNow().onUpdateNow().notNull(),
    })

export const nodes = IS_SQLITE
  ? sqliteTable('nodes', {
      id: integer('id').primaryKey({ autoIncrement: true }),
      name: stext('name').notNull(),
      url: stext('url').notNull(),
      token: stext('token').notNull(),
      locationId: integer('location_id').references(() => locations.id, { onDelete: 'set null' }),
      memory: integer('memory').default(0),
      disk: integer('disk').default(0),
      swap: integer('swap').default(0),
      databaseHostId: integer('database_host_id').references(() => databaseHosts.id, { onDelete: 'set null' }),
      createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
      updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
    })
  : mysqlTable('nodes', {
      id: int('id').autoincrement().primaryKey(),
      name: varchar('name', { length: 255 }).notNull(),
      url: varchar('url', { length: 500 }).notNull(),
      token: mtext('token').notNull(),
      locationId: int('location_id').references(() => locations.id, { onDelete: 'set null' }),
      memory: int('memory').default(0),
      disk: int('disk').default(0),
      swap: int('swap').default(0),
      databaseHostId: int('database_host_id').references(() => databaseHosts.id, { onDelete: 'set null' }),
      createdAt: mts('created_at').defaultNow().notNull(),
      updatedAt: mts('updated_at').defaultNow().onUpdateNow().notNull(),
    })

export const blueprints = IS_SQLITE
  ? sqliteTable('blueprints', {
      id: integer('id').primaryKey({ autoIncrement: true }),
      name: stext('name').notNull(),
      description: stext('description'),
      image: stext('image').notNull().default('ghcr.io/pterodactyl/yolks:java_17'),
      startupCommand: stext('startup_command').notNull().default('java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}'),
      environment: stext('environment'),
      installScript: stext('install_script'),
      images: stext('images'),
      variables: stext('variables'),
      createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
      updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
    })
  : mysqlTable('blueprints', {
      id: int('id').autoincrement().primaryKey(),
      name: varchar('name', { length: 255 }).notNull(),
      description: mtext('description'),
      image: varchar('image', { length: 500 }).notNull().default('ghcr.io/pterodactyl/yolks:java_17'),
      startupCommand: mtext('startup_command').notNull().default('java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}'),
      environment: mtext('environment'),
      installScript: mtext('install_script'),
      images: mtext('images'),
      variables: mtext('variables'),
      createdAt: mts('created_at').defaultNow().notNull(),
      updatedAt: mts('updated_at').defaultNow().onUpdateNow().notNull(),
    })

export const servers = IS_SQLITE
  ? sqliteTable('servers', {
      id: integer('id').primaryKey({ autoIncrement: true }),
      uuid: stext('uuid').notNull().unique(),
      name: stext('name').notNull(),
      description: stext('description'),
      ownerId: integer('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
      nodeId: integer('node_id').notNull().references(() => nodes.id, { onDelete: 'cascade' }),
      allocationId: integer('allocation_id'),
      portSlots: integer('port_slots').default(0),
      backupSlots: integer('backup_slots').default(0),
      databaseSlots: integer('database_slots').default(0),
      autoStart: integer('auto_start').default(0),
      memory: integer('memory').notNull(),
      cpu: integer('cpu').notNull(),
      disk: integer('disk').notNull(),
      swap: integer('swap').default(0),
      io: integer('io').default(500),
      startup: stext('startup').notNull(),
      image: stext('image').notNull(),
      eggId: integer('egg_id'),
      environment: stext('environment'),
      status: stext('status', { enum: ['installing', 'running', 'stopped', 'error'] }).default('installing').notNull(),
      suspended: integer('suspended').default(0).notNull(),
      sftpPassword: stext('sftp_password'),
      createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
      updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
      blueprintId: integer('blueprint_id').references(() => blueprints.id, { onDelete: 'set null' }),
    })
  : mysqlTable('servers', {
      id: int('id').autoincrement().primaryKey(),
      uuid: varchar('uuid', { length: 36 }).notNull().unique(),
      name: varchar('name', { length: 255 }).notNull(),
      description: mtext('description'),
      ownerId: int('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
      nodeId: int('node_id').notNull().references(() => nodes.id, { onDelete: 'cascade' }),
      allocationId: int('allocation_id'),
      portSlots: int('port_slots').default(0),
      backupSlots: int('backup_slots').default(0),
      databaseSlots: int('database_slots').default(0),
      autoStart: int('auto_start').default(0),
      memory: int('memory').notNull(),
      cpu: int('cpu').notNull(),
      disk: int('disk').notNull(),
      swap: int('swap').default(0),
      io: int('io').default(500),
      startup: mtext('startup').notNull(),
      image: varchar('image', { length: 500 }).notNull(),
      eggId: int('egg_id'),
      environment: mtext('environment'),
      status: mysqlEnum('status', ['installing', 'running', 'stopped', 'error']).default('installing').notNull(),
      suspended: int('suspended').default(0).notNull(),
      sftpPassword: varchar('sftp_password', { length: 255 }),
      createdAt: mts('created_at').defaultNow().notNull(),
      updatedAt: mts('updated_at').defaultNow().onUpdateNow().notNull(),
      blueprintId: int('blueprint_id').references(() => blueprints.id, { onDelete: 'set null' }),
    })

export const allocations = IS_SQLITE
  ? sqliteTable('allocations', {
      id: integer('id').primaryKey({ autoIncrement: true }),
      nodeId: integer('node_id').notNull().references(() => nodes.id, { onDelete: 'cascade' }),
      ip: stext('ip').notNull(),
      port: integer('port').notNull(),
      assigned: stext('assigned', { enum: ['yes', 'no'] }).default('no').notNull(),
      serverId: integer('server_id').references(() => servers.id, { onDelete: 'set null' }),
      createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
      updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
    })
  : mysqlTable('allocations', {
      id: int('id').autoincrement().primaryKey(),
      nodeId: int('node_id').notNull().references(() => nodes.id, { onDelete: 'cascade' }),
      ip: varchar('ip', { length: 45 }).notNull(),
      port: int('port').notNull(),
      assigned: mysqlEnum('assigned', ['yes', 'no']).default('no').notNull(),
      serverId: int('server_id').references(() => servers.id, { onDelete: 'set null' }),
      createdAt: mts('created_at').defaultNow().notNull(),
      updatedAt: mts('updated_at').defaultNow().onUpdateNow().notNull(),
    })

export const serverUsers = IS_SQLITE
  ? sqliteTable('server_users', {
      id: integer('id').primaryKey({ autoIncrement: true }),
      serverId: integer('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
      userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
      permissions: stext('permissions').notNull().default('[]'),
      createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
      updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
    })
  : mysqlTable('server_users', {
      id: int('id').autoincrement().primaryKey(),
      serverId: int('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
      userId: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
      permissions: mtext('permissions').notNull(),
      createdAt: mts('created_at').defaultNow().notNull(),
      updatedAt: mts('updated_at').defaultNow().onUpdateNow().notNull(),
    })

export const sftpCredentials = IS_SQLITE
  ? sqliteTable('sftp_credentials', {
      id: integer('id').primaryKey({ autoIncrement: true }),
      serverId: integer('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
      userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
      username: stext('username').notNull().unique(),
      password: stext('password').notNull(),
      createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
      updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
    })
  : mysqlTable('sftp_credentials', {
      id: int('id').autoincrement().primaryKey(),
      serverId: int('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
      userId: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
      username: varchar('username', { length: 64 }).notNull().unique(),
      password: varchar('password', { length: 128 }).notNull(),
      createdAt: mts('created_at').defaultNow().notNull(),
      updatedAt: mts('updated_at').defaultNow().onUpdateNow().notNull(),
    })

export const databaseHosts = IS_SQLITE
  ? sqliteTable('database_hosts', {
      id: integer('id').primaryKey({ autoIncrement: true }),
      name: stext('name').notNull(),
      host: stext('host').notNull().default('127.0.0.1'),
      port: integer('port').notNull().default(3306),
      type: stext('type', { enum: ['mysql', 'postgresql'] }).notNull().default('mysql'),
      username: stext('username').notNull(),
      password: stext('password').notNull(),
      nodeId: integer('node_id').references(() => nodes.id, { onDelete: 'set null' }),
      provisioning: stext('provisioning', { enum: ['container', 'external'] }).notNull().default('external'),
      containerRef: stext('container_ref'),
      createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
      updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
    })
  : mysqlTable('database_hosts', {
      id: int('id').autoincrement().primaryKey(),
      name: varchar('name', { length: 255 }).notNull(),
      host: varchar('host', { length: 255 }).notNull().default('127.0.0.1'),
      port: int('port').notNull().default(3306),
      type: mysqlEnum('type', ['mysql', 'postgresql']).notNull().default('mysql'),
      username: varchar('username', { length: 255 }).notNull(),
      password: varchar('password', { length: 255 }).notNull(),
      nodeId: int('node_id').references(() => nodes.id, { onDelete: 'set null' }),
      provisioning: mysqlEnum('provisioning', ['container', 'external']).notNull().default('external'),
      containerRef: varchar('container_ref', { length: 255 }),
      createdAt: mts('created_at').defaultNow().notNull(),
      updatedAt: mts('updated_at').defaultNow().onUpdateNow().notNull(),
    })

export const serverDatabases = IS_SQLITE
  ? sqliteTable('server_databases', {
      id: integer('id').primaryKey({ autoIncrement: true }),
      serverId: integer('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
      hostId: integer('host_id').notNull().references(() => databaseHosts.id, { onDelete: 'cascade' }),
      name: stext('name').notNull(),
      username: stext('username').notNull(),
      password: stext('password').notNull(),
      createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
    })
  : mysqlTable('server_databases', {
      id: int('id').autoincrement().primaryKey(),
      serverId: int('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
      hostId: int('host_id').notNull().references(() => databaseHosts.id, { onDelete: 'cascade' }),
      name: varchar('name', { length: 255 }).notNull(),
      username: varchar('username', { length: 255 }).notNull(),
      password: varchar('password', { length: 255 }).notNull(),
      createdAt: mts('created_at').defaultNow().notNull(),
    })

// Бэкапы: метаданные живут в панели, байты — на wings-ноде
// ($WINGS_DATA_DIR/backups/<container>/<uuid>.tar.gz, драйвер "agent").
// Завершение асинхронного снапшота wings сообщает сюда:
// POST /api/remote/backups/{uuid} (см. server/api/remote/backups/[uuid].post.ts).
export const backups = IS_SQLITE
  ? sqliteTable('backups', {
      id: integer('id').primaryKey({ autoIncrement: true }),
      uuid: stext('uuid').notNull().unique(),
      serverId: integer('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
      name: stext('name').notNull().default('backup'),
      size: integer('size', { mode: 'number' }).default(0).notNull(),
      status: stext('status', { enum: ['creating', 'completed', 'failed'] }).default('creating').notNull(),
      createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
    })
  : mysqlTable('backups', {
      id: int('id').autoincrement().primaryKey(),
      uuid: varchar('uuid', { length: 36 }).notNull().unique(),
      serverId: int('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
      name: varchar('name', { length: 255 }).notNull().default('backup'),
      size: bigint('size', { mode: 'number' }).default(0).notNull(),
      status: mysqlEnum('status', ['creating', 'completed', 'failed']).default('creating').notNull(),
      createdAt: mts('created_at').defaultNow().notNull(),
    })

// Таблица для статус-страниц
export const statusPages = IS_SQLITE
  ? sqliteTable('status_pages', {
      id: integer('id').primaryKey({ autoIncrement: true }),
      uuid: stext('uuid').notNull().unique(),
      userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
      name: stext('name').notNull(),
      slug: stext('slug').notNull().unique(),
      description: stext('description'),
      logoUrl: stext('logo_url'),
      isPublic: stext('is_public', { enum: ['yes', 'no'] }).default('yes').notNull(),
      tariff: stext('tariff', { enum: ['free', 'paid'] }).default('free').notNull(),
      createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
      updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
    })
  : mysqlTable('status_pages', {
      id: int('id').autoincrement().primaryKey(),
      uuid: varchar('uuid', { length: 36 }).notNull().unique(),
      userId: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
      name: varchar('name', { length: 255 }).notNull(),
      slug: varchar('slug', { length: 255 }).notNull().unique(),
      description: mtext('description'),
      logoUrl: varchar('logo_url', { length: 500 }),
      isPublic: mysqlEnum('is_public', ['yes', 'no']).default('yes').notNull(),
      tariff: mysqlEnum('tariff', ['free', 'paid']).default('free').notNull(),
      createdAt: mts('created_at').defaultNow().notNull(),
      updatedAt: mts('updated_at').defaultNow().onUpdateNow().notNull(),
    })

// Связующая таблица: какие мониторы Uptime Kuma привязаны к статус-страницеexport const statusPageMonitors = IS_SQLITE
  ? sqliteTable('status_page_monitors', {
      id: integer('id').primaryKey({ autoIncrement: true }),
      pageId: integer('page_id').notNull().references(() => statusPages.id, { onDelete: 'cascade' }),
      monitorId: integer('monitor_id').notNull(),
      monitorName: stext('monitor_name').notNull(),
      monitorType: stext('monitor_type').notNull(),
      createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
    })
  : mysqlTable('status_page_monitors', {
      id: int('id').autoincrement().primaryKey(),
      pageId: int('page_id').notNull().references(() => statusPages.id, { onDelete: 'cascade' }),
      monitorId: int('monitor_id').notNull(),
      monitorName: varchar('monitor_name', { length: 255 }).notNull(),
      monitorType: varchar('monitor_type', { length: 50 }).notNull(),
      createdAt: mts('created_at').defaultNow().notNull(),
    })

// Настройки панели (ключ-значение): название панели (panel_name) и т.д.
// Меняются из админки (Admin → Настройки), в .env их больше нет.
export const settings = IS_SQLITE
  ? sqliteTable('settings', {
      name: stext('name').primaryKey(),
      value: stext('value').notNull().default(''),
      updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
    })
  : mysqlTable('settings', {
      name: varchar('name', { length: 100 }).primaryKey(),
      value: mtext('value').notNull(),
      updatedAt: mts('updated_at').defaultNow().onUpdateNow().notNull(),
    })

// История входов пользователя: IP, устройство, способ входа.
// Пишется при каждом логине, читает только владелец (Аккаунт).
export const loginHistory = IS_SQLITE
  ? sqliteTable('login_history', {
      id: integer('id').primaryKey({ autoIncrement: true }),
      userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
      ip: stext('ip'),
      userAgent: stext('user_agent'),
      provider: stext('provider'),
      createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
    })
  : mysqlTable('login_history', {
      id: int('id').autoincrement().primaryKey(),
      userId: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
      ip: varchar('ip', { length: 45 }),
      userAgent: varchar('user_agent', { length: 255 }),
      provider: varchar('provider', { length: 50 }),
      createdAt: mts('created_at').defaultNow().notNull(),
    })

// API-ключи (как Account API в Pterodactyl): токен для внешних интеграций.
// Хранится только SHA256-хэш — сам секрет показывается один раз при создании.
// scopes — JSON-объект уровней {resource: 1|2} (см. API_RESOURCES).
export const apiKeys = IS_SQLITE
  ? sqliteTable('api_keys', {
      id: integer('id').primaryKey({ autoIncrement: true }),
      userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
      name: stext('name').notNull(),
      prefix: stext('prefix').notNull().unique(),
      tokenHash: stext('token_hash').notNull().unique(),
      scopes: stext('scopes').notNull().default('[]'),
      lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
      createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
    })
  : mysqlTable('api_keys', {
      id: int('id').autoincrement().primaryKey(),
      userId: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
      name: varchar('name', { length: 100 }).notNull(),
      prefix: varchar('prefix', { length: 16 }).notNull().unique(),
      tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
      scopes: mtext('scopes').notNull(),
      lastUsedAt: mts('last_used_at'),
      createdAt: mts('created_at').defaultNow().notNull(),
    })

// Журнал действий на сервере: кто что делал (power, файлы, бэкапы,
// пользователи, базы, порты, запуск). Читает владелец/админ и мемберы
// с activity.read (см. server/api/servers/[id]/activity/*).
export const serverActivity = IS_SQLITE  ? sqliteTable('server_activity', {
      id: integer('id').primaryKey({ autoIncrement: true }),
      serverId: integer('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
      userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
      action: stext('action').notNull(),
      detail: stext('detail'),
      createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
    })
  : mysqlTable('server_activity', {
      id: int('id').autoincrement().primaryKey(),
      serverId: int('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
      userId: int('user_id').references(() => users.id, { onDelete: 'set null' }),
      action: varchar('action', { length: 64 }).notNull(),
      detail: mtext('detail'),
      createdAt: mts('created_at').defaultNow().notNull(),
    })

// Расписание сервера: периодические power-действия и команды.
// Выполняет серверный планировщик (server/plugins/scheduler.ts):
// nextRunAt <= now + active → выполнить → lastRunAt/nextRunAt вперёд.
// Только владелец/админ (отдельных прав мемберов нет, как у автозапуска).
export const schedules = IS_SQLITE
  ? sqliteTable('schedules', {
      id: integer('id').primaryKey({ autoIncrement: true }),
      serverId: integer('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
      name: stext('name').notNull().default('schedule'),
      action: stext('action', { enum: ['start', 'stop', 'restart', 'command'] }).default('restart').notNull(),
      payload: stext('payload'),
      intervalMinutes: integer('interval_minutes').default(60).notNull(),
      active: integer('active').default(1).notNull(),
      lastRunAt: integer('last_run_at', { mode: 'timestamp' }),
      nextRunAt: integer('next_run_at', { mode: 'timestamp' }),
      createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
    })
  : mysqlTable('schedules', {
      id: int('id').autoincrement().primaryKey(),
      serverId: int('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
      name: varchar('name', { length: 255 }).notNull().default('schedule'),
      action: mysqlEnum('action', ['start', 'stop', 'restart', 'command']).default('restart').notNull(),
      payload: mtext('payload'),
      intervalMinutes: int('interval_minutes').default(60).notNull(),
      active: int('active').default(1).notNull(),
      lastRunAt: mts('last_run_at'),
      nextRunAt: mts('next_run_at'),
      createdAt: mts('created_at').defaultNow().notNull(),
    })

// 2FA (TOTP): секрет и резервные коды пользователя.
// secret — base32-секрет, зашифрованный sealSecret (как OAuth-секреты);
// backupCodes — JSON-массив SHA256-хэшей одноразовых кодов.
// enabled=0 — setup начат, но не подтверждён кодом.
export const userTotp = IS_SQLITE
  ? sqliteTable('user_totp', {
      userId: integer('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
      secret: stext('secret').notNull(),
      enabled: integer('enabled').default(0).notNull(),
      backupCodes: stext('backup_codes'),
      createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
      updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
    })
  : mysqlTable('user_totp', {
      userId: int('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
      secret: mtext('secret').notNull(),
      enabled: int('enabled').default(0).notNull(),
      backupCodes: mtext('backup_codes'),
      createdAt: mts('created_at').defaultNow().notNull(),
      updatedAt: mts('updated_at').defaultNow().onUpdateNow().notNull(),
    })
