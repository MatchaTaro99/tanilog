import { Elysia, t } from 'elysia'; // Bug #7 fix: import t untuk validasi input
import { cors } from '@elysiajs/cors';
import { db } from './db';
import { users, projects, logbooks, finances } from './db/schema';
import { eq, sql } from 'drizzle-orm';

const port = process.env.PORT || 3000;

// Ensure mock user exists for local development
async function ensureMockUser() {
  try {
    const existing = await db.select().from(users).where(eq(users.id, 1)).limit(1);
    if (existing.length === 0) {
      await db.insert(users).values({
        id: 1,
        name: 'Pak Tani',
        email: 'paktani@tanilog.com',
        password: 'password_mock',
      });
      console.log('🌱 Seeded default mock user with ID 1 in MySQL database.');
    } else {
      console.log('✔ Default mock user with ID 1 already exists.');
    }
  } catch (error) {
    console.error('Failed to seed mock user:', error);
  }
}

ensureMockUser();

const app = new Elysia()
  .use(cors())
  .get('/', () => ({ status: 'ready' }))
  
  // Database status diagnostics endpoint
  .get('/api/status', async () => {
    try {
      const allUsers = await db.select().from(users);
      const allProjects = await db.select().from(projects);
      const allLogbooks = await db.select().from(logbooks);
      const allFinances = await db.select().from(finances);
      return {
        status: 'success',
        counts: {
          users: allUsers.length,
          projects: allProjects.length,
          logbooks: allLogbooks.length,
          finances: allFinances.length,
        },
        data: {
          projects: allProjects,
          logbooks: allLogbooks,
          finances: allFinances,
        }
      };
    } catch (error: any) {
      return { status: 'error', message: error.message };
    }
  })

  // Batch Offline-to-Online Synchronization endpoint
  .post('/api/sync', async ({ body }) => {
    try {
      const { projects: localProjects, logbooks: localLogbooks, finances: localFinances } = body as any;

      let syncedProjectsCount = 0;
      let syncedLogbooksCount = 0;
      let syncedFinancesCount = 0;

      // Bug #3 fix: Bungkus semua insert dalam satu transaksi atomik MySQL.
      // Jika salah satu insert gagal, SEMUA akan di-rollback oleh MySQL.
      await db.transaction(async (tx) => {
        // 1. Sync projects
        if (localProjects && localProjects.length > 0) {
          const mappedProjects = localProjects.map((proj: any) => ({
            id: proj.id,
            userId: proj.userId,
            name: proj.name,
            plantType: proj.plantType,
            plantingDate: proj.plantingDate,
            status: proj.status,
            createdAt: new Date(proj.createdAt),
            updatedAt: new Date(proj.updatedAt)
          }));
          await tx.insert(projects).values(mappedProjects).onDuplicateKeyUpdate({
            set: {
              name: sql`IF(VALUES(updated_at) > updated_at, VALUES(name), name)`,
              plantType: sql`IF(VALUES(updated_at) > updated_at, VALUES(plant_type), plant_type)`,
              plantingDate: sql`IF(VALUES(updated_at) > updated_at, VALUES(planting_date), planting_date)`,
              status: sql`IF(VALUES(updated_at) > updated_at, VALUES(status), status)`,
              updatedAt: sql`IF(VALUES(updated_at) > updated_at, VALUES(updated_at), updated_at)`
            }
          });
          syncedProjectsCount = mappedProjects.length;
        }

        // 2. Sync logbooks
        if (localLogbooks && localLogbooks.length > 0) {
          const mappedLogbooks = localLogbooks.map((log: any) => ({
            id: log.id,
            projectId: log.projectId,
            title: log.title,
            category: log.category,
            scheduledDate: log.scheduledDate,
            completedDate: log.completedDate || null,
            isCompleted: log.isCompleted,
            notes: log.notes || null,
            createdAt: new Date(log.createdAt),
            updatedAt: new Date(log.updatedAt)
          }));
          await tx.insert(logbooks).values(mappedLogbooks).onDuplicateKeyUpdate({
            set: {
              title: sql`IF(VALUES(updated_at) > updated_at, VALUES(title), title)`,
              category: sql`IF(VALUES(updated_at) > updated_at, VALUES(category), category)`,
              scheduledDate: sql`IF(VALUES(updated_at) > updated_at, VALUES(scheduled_date), scheduled_date)`,
              completedDate: sql`IF(VALUES(updated_at) > updated_at, VALUES(completed_date), completed_date)`,
              isCompleted: sql`IF(VALUES(updated_at) > updated_at, VALUES(is_completed), is_completed)`,
              notes: sql`IF(VALUES(updated_at) > updated_at, VALUES(notes), notes)`,
              updatedAt: sql`IF(VALUES(updated_at) > updated_at, VALUES(updated_at), updated_at)`
            }
          });
          syncedLogbooksCount = mappedLogbooks.length;
        }

        // 3. Sync finances
        if (localFinances && localFinances.length > 0) {
          const mappedFinances = localFinances.map((fin: any) => ({
            id: fin.id,
            projectId: fin.projectId,
            type: fin.type,
            category: fin.category,
            amount: fin.amount.toString(),
            notes: fin.notes || null,
            transactionDate: fin.transactionDate,
            createdAt: new Date(fin.createdAt),
            updatedAt: new Date(fin.updatedAt)
          }));
          await tx.insert(finances).values(mappedFinances).onDuplicateKeyUpdate({
            set: {
              type: sql`IF(VALUES(updated_at) > updated_at, VALUES(type), type)`,
              category: sql`IF(VALUES(updated_at) > updated_at, VALUES(category), category)`,
              amount: sql`IF(VALUES(updated_at) > updated_at, VALUES(amount), amount)`,
              notes: sql`IF(VALUES(updated_at) > updated_at, VALUES(notes), notes)`,
              transactionDate: sql`IF(VALUES(updated_at) > updated_at, VALUES(transaction_date), transaction_date)`,
              updatedAt: sql`IF(VALUES(updated_at) > updated_at, VALUES(updated_at), updated_at)`
            }
          });
          syncedFinancesCount = mappedFinances.length;
        }
      }); // Akhir dari db.transaction — atomik

      console.log(`🔄 Sync completed: ${syncedProjectsCount} projects, ${syncedLogbooksCount} logbooks, ${syncedFinancesCount} finances.`);

      return {
        status: 'success',
        syncedCount: {
          projects: syncedProjectsCount,
          logbooks: syncedLogbooksCount,
          finances: syncedFinancesCount
        }
      };
    } catch (error: any) {
      console.error('❌ Sync failed (transaction rolled back):', error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }, {
    // Bug #7 fix: Validasi schema body request agar API tidak menerima payload malformed
    body: t.Object({
      projects: t.Optional(t.Array(t.Object({
        id: t.Optional(t.Number()),
        userId: t.Number(),
        name: t.String({ minLength: 1, maxLength: 255 }),
        plantType: t.String({ minLength: 1, maxLength: 255 }),
        plantingDate: t.String(),
        status: t.String(),
        createdAt: t.String(),
        updatedAt: t.String(),
        syncStatus: t.String(),
      }))),
      logbooks: t.Optional(t.Array(t.Object({
        id: t.Optional(t.Number()),
        projectId: t.Number(),
        title: t.String({ minLength: 1, maxLength: 255 }),
        category: t.String({ minLength: 1 }),
        scheduledDate: t.String(),
        completedDate: t.Optional(t.Union([t.String(), t.Null()])),
        isCompleted: t.Boolean(),
        notes: t.Optional(t.Union([t.String(), t.Null()])),
        createdAt: t.String(),
        updatedAt: t.String(),
        syncStatus: t.String(),
      }))),
      finances: t.Optional(t.Array(t.Object({
        id: t.Optional(t.Number()),
        projectId: t.Number(),
        type: t.Union([t.Literal('expense'), t.Literal('income')]),
        category: t.String({ minLength: 1, maxLength: 100 }),
        amount: t.Number({ minimum: 0 }),
        notes: t.Optional(t.Union([t.String(), t.Null()])),
        transactionDate: t.String(),
        createdAt: t.String(),
        updatedAt: t.String(),
        syncStatus: t.String(),
      }))),
    })
  })
  .listen(port);

console.log(`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`);

