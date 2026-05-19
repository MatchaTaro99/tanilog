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

      // 1. Sync projects (Insert or Update on conflict)
      if (localProjects && localProjects.length > 0) {
        for (const proj of localProjects) {
          await db.insert(projects).values({
            id: proj.id,
            userId: proj.userId,
            name: proj.name,
            plantType: proj.plantType,
            plantingDate: proj.plantingDate,
            status: proj.status,
            createdAt: new Date(proj.createdAt),
            updatedAt: new Date(proj.updatedAt)
          }).onDuplicateKeyUpdate({
            set: {
              name: proj.name,
              plantType: proj.plantType,
              plantingDate: proj.plantingDate,
              status: proj.status,
              updatedAt: new Date(proj.updatedAt)
            }
          });
          syncedProjectsCount++;
        }
      }

      // 2. Sync logbooks (Insert or Update on conflict)
      if (localLogbooks && localLogbooks.length > 0) {
        for (const log of localLogbooks) {
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
          }).onDuplicateKeyUpdate({
            set: {
              title: log.title,
              category: log.category,
              scheduledDate: log.scheduledDate,
              completedDate: log.completedDate || null,
              isCompleted: log.isCompleted,
              notes: log.notes || null,
              updatedAt: new Date(log.updatedAt)
            }
          });
          syncedLogbooksCount++;
        }
      }

      // 3. Sync finances (Insert or Update on conflict)
      if (localFinances && localFinances.length > 0) {
        for (const fin of localFinances) {
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
          }).onDuplicateKeyUpdate({
            set: {
              type: fin.type,
              category: fin.category,
              amount: fin.amount.toString(),
              notes: fin.notes || null,
              transactionDate: fin.transactionDate,
              updatedAt: new Date(fin.updatedAt)
            }
          });
          syncedFinancesCount++;
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

