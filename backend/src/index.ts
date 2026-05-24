import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { db } from './db';
import { users, projects, logbooks, finances } from './db/schema';
import { eq } from 'drizzle-orm';

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

      // 1. Sync projects
      if (localProjects && localProjects.length > 0) {
        for (const proj of localProjects) {
          const existing = await db.select().from(projects).where(eq(projects.id, proj.id)).limit(1);
          if (existing.length > 0) {
            if (new Date(proj.updatedAt) > existing[0].updatedAt) {
              await db.update(projects).set({
                name: proj.name,
                plantType: proj.plantType,
                plantingDate: proj.plantingDate,
                status: proj.status,
                updatedAt: new Date(proj.updatedAt)
              }).where(eq(projects.id, proj.id));
              syncedProjectsCount++;
            }
          } else {
            await db.insert(projects).values({
              id: proj.id,
              userId: proj.userId,
              name: proj.name,
              plantType: proj.plantType,
              plantingDate: proj.plantingDate,
              status: proj.status,
              createdAt: new Date(proj.createdAt),
              updatedAt: new Date(proj.updatedAt)
            });
            syncedProjectsCount++;
          }
        }
      }

      // 2. Sync logbooks
      if (localLogbooks && localLogbooks.length > 0) {
        for (const log of localLogbooks) {
          const existing = await db.select().from(logbooks).where(eq(logbooks.id, log.id)).limit(1);
          if (existing.length > 0) {
            if (new Date(log.updatedAt) > existing[0].updatedAt) {
              await db.update(logbooks).set({
                title: log.title,
                category: log.category,
                scheduledDate: log.scheduledDate,
                completedDate: log.completedDate || null,
                isCompleted: log.isCompleted,
                notes: log.notes || null,
                updatedAt: new Date(log.updatedAt)
              }).where(eq(logbooks.id, log.id));
              syncedLogbooksCount++;
            }
          } else {
            await db.insert(logbooks).values({
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
            });
            syncedLogbooksCount++;
          }
        }
      }

      // 3. Sync finances
      if (localFinances && localFinances.length > 0) {
        for (const fin of localFinances) {
          const existing = await db.select().from(finances).where(eq(finances.id, fin.id)).limit(1);
          if (existing.length > 0) {
            if (new Date(fin.updatedAt) > existing[0].updatedAt) {
              await db.update(finances).set({
                type: fin.type,
                category: fin.category,
                amount: fin.amount.toString(),
                notes: fin.notes || null,
                transactionDate: fin.transactionDate,
                updatedAt: new Date(fin.updatedAt)
              }).where(eq(finances.id, fin.id));
              syncedFinancesCount++;
            }
          } else {
            await db.insert(finances).values({
              id: fin.id,
              projectId: fin.projectId,
              type: fin.type,
              category: fin.category,
              amount: fin.amount.toString(),
              notes: fin.notes || null,
              transactionDate: fin.transactionDate,
              createdAt: new Date(fin.createdAt),
              updatedAt: new Date(fin.updatedAt)
            });
            syncedFinancesCount++;
          }
        }
      }

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
      console.error('❌ Sync failed:', error);
      return {
        status: 'error',
        message: error.message
      };
    }
  })
  .listen(port);

console.log(`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`);

