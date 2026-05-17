import { mysqlTable, int, varchar, text, timestamp, boolean, date, decimal } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';

export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
}));

export const projects = mysqlTable('projects', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  plantType: varchar('plant_type', { length: 255 }).notNull(),
  plantingDate: date('planting_date', { mode: 'string' }).notNull(),
  status: varchar('status', { length: 50 }).default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  logbooks: many(logbooks),
  finances: many(finances),
}));

export const logbooks = mysqlTable('logbooks', {
  id: int('id').autoincrement().primaryKey(),
  projectId: int('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(), // Hama, Penyakit, Pengairan, Lainnya
  scheduledDate: date('scheduled_date', { mode: 'string' }).notNull(),
  completedDate: date('completed_date', { mode: 'string' }),
  isCompleted: boolean('is_completed').default(false).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const logbooksRelations = relations(logbooks, ({ one }) => ({
  project: one(projects, {
    fields: [logbooks.projectId],
    references: [projects.id],
  }),
}));

export const finances = mysqlTable('finances', {
  id: int('id').autoincrement().primaryKey(),
  projectId: int('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(), // expense, income
  category: varchar('category', { length: 100 }).notNull(), // Benih, Pupuk, Obat, Tenaga Kerja, Alat, Panen, dll
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  notes: text('notes'),
  transactionDate: date('transaction_date', { mode: 'string' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const financesRelations = relations(finances, ({ one }) => ({
  project: one(projects, {
    fields: [finances.projectId],
    references: [projects.id],
  }),
}));
