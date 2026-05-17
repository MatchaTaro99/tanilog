import Dexie, { type Table } from "dexie";

// Interfaces mirroring MySQL Drizzle Schema
export interface LocalProject {
  id?: number;
  userId: number;
  name: string;
  plantType: string;
  plantingDate: string;
  status: "active" | "archived";
  createdAt: Date;
  updatedAt: Date;
  syncStatus: "synced" | "pending";
}

export interface LocalLogbook {
  id?: number;
  projectId: number;
  title: string;
  category: string;
  scheduledDate: string;
  completedDate?: string;
  isCompleted: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  syncStatus: "synced" | "pending";
}

export interface LocalFinance {
  id?: number;
  projectId: number;
  type: "expense" | "income";
  category: string;
  amount: number;
  notes?: string;
  transactionDate: string;
  createdAt: Date;
  updatedAt: Date;
  syncStatus: "synced" | "pending";
}

class TaniLogDexie extends Dexie {
  projects!: Table<LocalProject>;
  logbooks!: Table<LocalLogbook>;
  finances!: Table<LocalFinance>;

  constructor() {
    super("TaniLogDatabase");
    this.version(1).stores({
      projects: "++id, userId, name, plantType, plantingDate, status, syncStatus",
      logbooks: "++id, projectId, title, category, scheduledDate, isCompleted, syncStatus",
      finances: "++id, projectId, type, category, amount, transactionDate, syncStatus",
    });
  }
}

export const db = new TaniLogDexie();

// Database Seeder
export async function seedDatabase() {
  const projectCount = await db.projects.count();
  if (projectCount > 0) return; // DB is already seeded

  console.log("🌱 Database TaniLog kosong. Menjalankan auto-seed data luring...");

  // 1. Seed Projects (Mock User ID = 1)
  const p1Id = await db.projects.add({
    userId: 1,
    name: "Padi Ciherang - Lahan A",
    plantType: "Padi",
    plantingDate: "2026-04-12",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    syncStatus: "pending",
  });

  const p2Id = await db.projects.add({
    userId: 1,
    name: "Cabai Keriting - Lahan B",
    plantType: "Cabai",
    plantingDate: "2026-05-02",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    syncStatus: "pending",
  });

  // 2. Seed Logbooks
  await db.logbooks.bulkAdd([
    // Project 1 (Padi) - 4 standard recommendations
    {
      projectId: p1Id,
      title: "Penyiraman Rutin Lahan Padi",
      category: "Penyiraman",
      scheduledDate: "2026-04-13",
      isCompleted: true,
      completedDate: "2026-04-13",
      notes: "Sawah diairi penuh setelah penanaman",
      createdAt: new Date(),
      updatedAt: new Date(),
      syncStatus: "pending",
    },
    {
      projectId: p1Id,
      title: "Pemberian Pupuk Dasar NPK",
      category: "Pemupukan",
      scheduledDate: "2026-04-26",
      isCompleted: true,
      completedDate: "2026-04-26",
      notes: "Aplikasi NPK dosis dasar 150kg/ha",
      createdAt: new Date(),
      updatedAt: new Date(),
      syncStatus: "pending",
    },
    {
      projectId: p1Id,
      title: "Proteksi Hama & Penyakit Padi",
      category: "Proteksi",
      scheduledDate: "2026-05-12",
      isCompleted: true,
      completedDate: "2026-05-12",
      notes: "Penyemprotan insektisida organik preventif",
      createdAt: new Date(),
      updatedAt: new Date(),
      syncStatus: "pending",
    },
    {
      projectId: p1Id,
      title: "Pemberian Pupuk Urea Susulan",
      category: "Pemupukan",
      scheduledDate: "2026-05-19",
      isCompleted: false,
      notes: "Dosis urea 100kg/hektar untuk fase generatif",
      createdAt: new Date(),
      updatedAt: new Date(),
      syncStatus: "pending",
    },

    // Project 2 (Cabai) - 4 standard recommendations
    {
      projectId: p2Id,
      title: "Penyiraman Rutin Lahan Cabai",
      category: "Penyiraman",
      scheduledDate: "2026-05-03",
      isCompleted: true,
      completedDate: "2026-05-03",
      notes: "Penyiraman bedengan cabai merata pagi hari",
      createdAt: new Date(),
      updatedAt: new Date(),
      syncStatus: "pending",
    },
    {
      projectId: p2Id,
      title: "Pemberian Pupuk Dasar NPK Cabai",
      category: "Pemupukan",
      scheduledDate: "2026-05-16",
      isCompleted: true,
      completedDate: "2026-05-16",
      notes: "Pupuk kocor NPK untuk tunas baru",
      createdAt: new Date(),
      updatedAt: new Date(),
      syncStatus: "pending",
    },
    {
      projectId: p2Id,
      title: "Penyemprotan Hama Ulat Cabai",
      category: "Proteksi",
      scheduledDate: "2026-05-18",
      isCompleted: false,
      notes: "Gunakan pestisida organik neem oil jika ulat terlihat",
      createdAt: new Date(),
      updatedAt: new Date(),
      syncStatus: "pending",
    },
    {
      projectId: p2Id,
      title: "Penyiangan Gulma Bedengan Cabai",
      category: "Pembersihan",
      scheduledDate: "2026-05-25",
      isCompleted: false,
      notes: "Pembersihan rumput liar di sekitar pangkal batang",
      createdAt: new Date(),
      updatedAt: new Date(),
      syncStatus: "pending",
    },
  ]);

  // 3. Seed Finances
  await db.finances.bulkAdd([
    {
      projectId: p1Id,
      type: "expense",
      category: "Bibit",
      amount: 250000,
      notes: "Benih padi premium ciherang",
      transactionDate: "2026-04-12",
      createdAt: new Date(),
      updatedAt: new Date(),
      syncStatus: "pending",
    },
    {
      projectId: p1Id,
      type: "expense",
      category: "Pupuk",
      amount: 300000,
      notes: "2 karung pupuk urea bersubsidi",
      transactionDate: "2026-04-20",
      createdAt: new Date(),
      updatedAt: new Date(),
      syncStatus: "pending",
    },
    {
      projectId: p2Id,
      type: "expense",
      category: "Tenaga Kerja",
      amount: 500000,
      notes: "Upah buruh tanam bedengan cabai",
      transactionDate: "2026-05-02",
      createdAt: new Date(),
      updatedAt: new Date(),
      syncStatus: "pending",
    },
    {
      projectId: p2Id,
      type: "income",
      category: "Panen",
      amount: 2450000,
      notes: "Penjualan hasil panen perdana cabai rawit hijau",
      transactionDate: "2026-05-17",
      createdAt: new Date(),
      updatedAt: new Date(),
      syncStatus: "pending",
    },
  ]);

  console.log("🌱 Auto-seed berhasil dimasukkan ke IndexedDB!");
}
