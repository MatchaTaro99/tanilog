"use client";

import { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, seedDatabase } from "@/lib/db";

export default function Home() {
  const [isOnline, setIsOnline] = useState(true);
  const [activeTab, setActiveTab] = useState<"dashboard" | "logbook" | "finance" | "settings">("dashboard");

  // Project Creation Modal state
  const [showAddProject, setShowAddProject] = useState(false);
  const [newProjName, setNewProjName] = useState("");
  const [newProjType, setNewProjType] = useState("Padi");
  const [newProjDate, setNewProjDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Manual Logbook Creation Modal state
  const [showAddManualLog, setShowAddManualLog] = useState(false);
  const [manualLogTitle, setManualLogTitle] = useState("");
  const [manualLogCategory, setManualLogCategory] = useState("Lainnya");
  const [manualLogDate, setManualLogDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [manualLogNotes, setManualLogNotes] = useState("");
  const [manualLogIsCompleted, setManualLogIsCompleted] = useState(true);

  // Selected project filter for logging and finances
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  // Delete confirmation state
  const [confirmDeleteProjectId, setConfirmDeleteProjectId] = useState<number | null>(null);
  const [confirmDeleteTxId, setConfirmDeleteTxId] = useState<number | null>(null);
  const [confirmDeleteLogId, setConfirmDeleteLogId] = useState<number | null>(null);

  // User Profile state (backed by localStorage)
  const [farmerName, setFarmerName] = useState("Pak Tani");
  const [farmName, setFarmName] = useState("Sawah Makmur");

  // Form State for new transaction (Pengeluaran)
  const [newDesc, setNewDesc] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newType, setNewType] = useState<"expense" | "income">("expense");
  const [newCat, setNewCat] = useState("Benih");
  const [newTxProjectId, setNewTxProjectId] = useState<string>("");

  // Form State for Panen income (Berat Panen × Harga Jual)
  const [showPanenForm, setShowPanenForm] = useState(false);
  const [panenBerat, setPanenBerat] = useState("");
  const [panenHarga, setPanenHarga] = useState("");
  const [panenKet, setPanenKet] = useState("Penjualan Hasil Panen");
  const [panenProjectId, setPanenProjectId] = useState<string>("");

  // Network Status Monitor
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Initialize DB Seeding and Load Profiles
  useEffect(() => {
    seedDatabase();

    // LocalStorage loading
    const cachedFarmer = localStorage.getItem("farmerName");
    const cachedFarm = localStorage.getItem("farmName");
    if (cachedFarmer) setFarmerName(cachedFarmer);
    if (cachedFarm) setFarmName(cachedFarm);
  }, []);

  // Save profile helpers
  const saveFarmerName = (name: string) => {
    setFarmerName(name);
    localStorage.setItem("farmerName", name);
  };

  const saveFarmName = (name: string) => {
    setFarmName(name);
    localStorage.setItem("farmName", name);
  };

  // Dexie React Queries (fully reactive luring queries!)
  const projects = useLiveQuery(() => db.projects.toArray()) || [];
  const allTasks = useLiveQuery(() => db.logbooks.toArray()) || [];
  const allFinances = useLiveQuery(() => db.finances.toArray()) || [];

  // Filter dynamic states
  useEffect(() => {
    if (projects.length > 0 && selectedProjectId === null) {
      // Default to first active project
      setSelectedProjectId(projects[0].id || null);
    }
  }, [projects, selectedProjectId]);

  // Set default project ID in transaction form once loaded
  useEffect(() => {
    if (selectedProjectId) {
      setNewTxProjectId(selectedProjectId.toString());
    }
  }, [selectedProjectId]);

  // Filter tasks & finances based on current selected project
  const tasks = allTasks.filter(t => t.projectId === selectedProjectId);
  const finances = allFinances.filter(f => f.projectId === selectedProjectId);

  // Task toggler mutation on Dexie
  const toggleTask = async (id: number, currentDone: boolean) => {
    await db.logbooks.update(id, {
      isCompleted: !currentDone,
      completedDate: !currentDone ? new Date().toISOString().split("T")[0] : undefined,
      updatedAt: new Date(),
      syncStatus: "pending",
    });
  };

  // Delete project (cascade: removes all logbooks & finances too)
  const deleteProject = async (projId: number) => {
    await db.transaction("rw", [db.projects, db.logbooks, db.finances], async () => {
      await db.logbooks.where("projectId").equals(projId).delete();
      await db.finances.where("projectId").equals(projId).delete();
      await db.projects.delete(projId);
    });
    // If the deleted project was selected, reset to null or first remaining
    if (selectedProjectId === projId) {
      const remaining = await db.projects.toArray();
      setSelectedProjectId(remaining.length > 0 ? (remaining[0].id ?? null) : null);
    }
    setConfirmDeleteProjectId(null);
  };

  // Delete individual finance transaction
  const deleteTransaction = async (txId: number) => {
    await db.finances.delete(txId);
    setConfirmDeleteTxId(null);
  };

  // Delete individual logbook entry
  const deleteLogEntry = async (logId: number) => {
    await db.logbooks.delete(logId);
    setConfirmDeleteLogId(null);
  };

  // Add Project + Auto Scheduled Tasks
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName.trim()) return;

    // 1. Add project
    const projId = await db.projects.add({
      userId: 1,
      name: newProjName,
      plantType: newProjType,
      plantingDate: newProjDate,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
      syncStatus: "pending",
    });

    // 2. Generate exactly 4 custom scheduled tasks based on planting date
    const d1 = new Date(newProjDate);
    const d2 = new Date(newProjDate);
    const d3 = new Date(newProjDate);
    const d4 = new Date(newProjDate);

    d1.setDate(d1.getDate() + 1);  // Day +1: Water
    d2.setDate(d2.getDate() + 14); // Day +14: Fertilize
    d3.setDate(d3.getDate() + 30); // Day +30: Prevent pests
    d4.setDate(d4.getDate() + 90); // Day +90: Harvest

    await db.logbooks.bulkAdd([
      {
        projectId: projId,
        title: "Penyiraman Awal Lahan",
        category: "Penyiraman",
        scheduledDate: d1.toISOString().split("T")[0],
        isCompleted: false,
        notes: `Lakukan pengairan menyeluruh untuk merangsang pertumbuhan awal bibit ${newProjType}.`,
        createdAt: new Date(),
        updatedAt: new Date(),
        syncStatus: "pending",
      },
      {
        projectId: projId,
        title: "Pemberian Pupuk Dasar NPK",
        category: "Pemupukan",
        scheduledDate: d2.toISOString().split("T")[0],
        isCompleted: false,
        notes: "Gunakan pupuk NPK dengan nitrogen tinggi untuk memacu vegetatif daun.",
        createdAt: new Date(),
        updatedAt: new Date(),
        syncStatus: "pending",
      },
      {
        projectId: projId,
        title: "Proteksi Hama & Penyakit (Pencegahan)",
        category: "Proteksi",
        scheduledDate: d3.toISOString().split("T")[0],
        isCompleted: false,
        notes: "Penyemprotan fungisida/pestisida nabati secara tipis di bagian bawah daun.",
        createdAt: new Date(),
        updatedAt: new Date(),
        syncStatus: "pending",
      },
      {
        projectId: projId,
        title: "Panen Raya Hasil Tanam",
        category: "Panen",
        scheduledDate: d4.toISOString().split("T")[0],
        isCompleted: false,
        notes: `Pemanenan serentak buah/biji ${newProjType} yang telah memasuki fase matang optimal.`,
        createdAt: new Date(),
        updatedAt: new Date(),
        syncStatus: "pending",
      },
    ]);

    // Cleanup & Set active
    setSelectedProjectId(projId);
    setNewProjName("");
    setShowAddProject(false);
    setActiveTab("dashboard");
  };

  // Add Manual Field Observation / Custom Log
  const handleCreateManualLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualLogTitle.trim() || !selectedProjectId) return;

    await db.logbooks.add({
      projectId: selectedProjectId,
      title: manualLogTitle,
      category: manualLogCategory,
      scheduledDate: manualLogDate,
      isCompleted: manualLogIsCompleted,
      completedDate: manualLogIsCompleted ? manualLogDate : undefined,
      notes: manualLogNotes || undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
      syncStatus: "pending",
    });

    // Reset Form & Close Modal
    setManualLogTitle("");
    setManualLogCategory("Lainnya");
    setManualLogDate(new Date().toISOString().split("T")[0]);
    setManualLogNotes("");
    setManualLogIsCompleted(true);
    setShowAddManualLog(false);
  };

  // Add transaction mutation on Dexie
  const addTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const projIdNum = parseInt(newTxProjectId);
    if (!newDesc.trim() || !newAmount || isNaN(projIdNum)) return;

    await db.finances.add({
      projectId: projIdNum,
      type: newType,
      category: newCat,
      amount: parseFloat(newAmount),
      notes: newDesc,
      transactionDate: new Date().toISOString().split("T")[0],
      createdAt: new Date(),
      updatedAt: new Date(),
      syncStatus: "pending",
    });

    setNewDesc("");
    setNewAmount("");
    setNewCat("Benih");
  };

  // Add Panen income: Berat Panen × Harga Jual
  const addPanenIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    const projIdNum = parseInt(panenProjectId);
    const berat = parseFloat(panenBerat);
    const harga = parseFloat(panenHarga);
    if (isNaN(projIdNum) || isNaN(berat) || isNaN(harga) || berat <= 0 || harga <= 0) return;

    const totalPanen = berat * harga;
    await db.finances.add({
      projectId: projIdNum,
      type: "income",
      category: "Panen",
      amount: totalPanen,
      notes: `${panenKet} (${berat} kg × Rp ${harga.toLocaleString("id-ID")}/kg)`,
      transactionDate: new Date().toISOString().split("T")[0],
      createdAt: new Date(),
      updatedAt: new Date(),
      syncStatus: "pending",
    });

    setPanenBerat("");
    setPanenHarga("");
    setPanenKet("Penjualan Hasil Panen");
    setShowPanenForm(false);
  };

  // Synchronize database to the remote backend
  const handleSyncDatabase = async () => {
    try {
      // 1. Fetch all local projects, logbooks, and finances that are "pending" sync
      const pendingProjects = await db.projects.filter(p => p.syncStatus === "pending").toArray();
      const pendingLogbooks = await db.logbooks.filter(l => l.syncStatus === "pending").toArray();
      const pendingFinances = await db.finances.filter(f => f.syncStatus === "pending").toArray();

      const totalPending = pendingProjects.length + pendingLogbooks.length + pendingFinances.length;

      if (totalPending === 0) {
        alert("Semua data Anda sudah tersinkronisasi sepenuhnya dengan server MySQL!");
        return;
      }

      // 2. Send the pending data in a batch to the backend
      const response = await fetch("http://localhost:3000/api/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projects: pendingProjects,
          logbooks: pendingLogbooks,
          finances: pendingFinances,
        }),
      });

      const result = await response.json();

      if (result.status === "success") {
        // 3. Mark all successfully synchronized records as "synced" in a single transaction
        await db.transaction("rw", [db.projects, db.logbooks, db.finances], async () => {
          for (const proj of pendingProjects) {
            if (proj.id) {
              await db.projects.update(proj.id, { syncStatus: "synced", updatedAt: new Date() });
            }
          }
          for (const log of pendingLogbooks) {
            if (log.id) {
              await db.logbooks.update(log.id, { syncStatus: "synced", updatedAt: new Date() });
            }
          }
          for (const fin of pendingFinances) {
            if (fin.id) {
              await db.finances.update(fin.id, { syncStatus: "synced", updatedAt: new Date() });
            }
          }
        });

        alert(
          `Sinkronisasi Berhasil!\n\n` +
          `• Proyek Lahan: ${result.syncedCount.projects} baris\n` +
          `• Catatan/Logbook: ${result.syncedCount.logbooks} baris\n` +
          `• Keuangan/Ledger: ${result.syncedCount.finances} baris\n\n` +
          `Semua data luring berhasil diunggah ke server MySQL.`
        );
      } else {
        alert(`Gagal Sinkronisasi: ${result.message || "Kesalahan tidak diketahui pada server"}`);
      }
    } catch (error: any) {
      console.error("Sync error:", error);
      alert(`Gagal Sinkronisasi: Tidak dapat menghubungi server. Pastikan koneksi server backend aktif.`);
    }
  };

  // Financial calculations (Global metrics across all projects)
  const globalExpenses = allFinances.filter(t => t.type === "expense").reduce((acc, t) => acc + t.amount, 0);
  const globalIncomes = allFinances.filter(t => t.type === "income").reduce((acc, t) => acc + t.amount, 0);
  const globalNetProfit = globalIncomes - globalExpenses;

  // Selected project metrics
  const projectExpenses = finances.filter(t => t.type === "expense").reduce((acc, t) => acc + t.amount, 0);
  const projectIncomes = finances.filter(t => t.type === "income").reduce((acc, t) => acc + t.amount, 0);
  const projectNetProfit = projectIncomes - projectExpenses;

  // === Real-time BEP Calculations (per proyek aktif) ===
  // Total modal = semua pengeluaran
  const totalModal = projectExpenses;
  // Total berat panen: ekstrak dari notes pola "X kg × ..."
  const totalBeratPanen = finances
    .filter(t => t.type === "income" && t.category === "Panen")
    .reduce((acc, t) => {
      const match = t.notes?.match(/(\d+(?:\.\d+)?)\s*kg/);
      return acc + (match ? parseFloat(match[1]) : 0);
    }, 0);
  // HPP/kg = Total Modal ÷ Total Berat Panen
  const hppPerKg = totalBeratPanen > 0 ? totalModal / totalBeratPanen : 0;
  // Harga jual rata-rata: estimasi dari income ÷ berat
  const hargaJualRata = totalBeratPanen > 0 ? projectIncomes / totalBeratPanen : 0;
  // Titik BEP (kg) = Total Modal ÷ Harga Jual Rata-rata
  const titikBEP = hargaJualRata > 0 ? totalModal / hargaJualRata : 0;
  // Keuntungan Bersih = Total Pendapatan - Total Modal
  const keuntunganBersih = projectIncomes - totalModal;
  // Status BEP
  const isBEPAman = keuntunganBersih >= 0;

  // Task calculation metrics
  const completedTasksCount = tasks.filter(t => t.isCompleted).length;
  const progressPercent = tasks.length > 0 ? Math.round((completedTasksCount / tasks.length) * 100) : 0;

  return (
    <div className="flex min-h-screen w-full flex-col bg-stone-100 font-sans pb-24 md:pb-6 relative">
      {/* Top Banner / Navigation */}
      <header className="sticky top-0 z-50 w-full bg-emerald-900 text-white shadow-md">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700 font-bold text-emerald-100 shadow-inner">
              TL
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">TaniLog</h1>
              <p className="text-xs text-emerald-300">{farmName}</p>
            </div>
          </div>

          {/* Network Indicator */}
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold shadow-sm transition-colors duration-300 ${
                isOnline
                  ? "bg-emerald-800 text-emerald-200"
                  : "bg-amber-600 text-amber-50 animate-pulse"
              }`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isOnline ? "bg-emerald-400" : "bg-amber-200"
                }`}
              />
              {isOnline ? "Online" : "Offline-Ready"}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-lg px-4 pt-6 flex-1 flex flex-col gap-6">
        
        {/* ==================== SELECT PROJECT BAR ==================== */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200/60 flex items-center justify-between">
          <div className="flex flex-col gap-1 w-2/3">
            <label className="text-[10px] text-stone-400 uppercase font-black tracking-wider">Lahan Aktif Dipilih</label>
            {projects.length > 0 ? (
              <select
                value={selectedProjectId || ""}
                onChange={(e) => setSelectedProjectId(parseInt(e.target.value))}
                className="font-bold text-stone-800 text-sm focus:outline-none bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-stone-400">Belum ada proyek</span>
            )}
          </div>
          <button
            onClick={() => setShowAddProject(true)}
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold py-2 px-4 rounded-xl text-xs transition-colors border border-emerald-100 flex items-center gap-1.5"
          >
            <span>➕ Proyek Baru</span>
          </button>
        </section>

        {/* ==================== TAB 1: DASHBOARD ==================== */}
        {activeTab === "dashboard" && (
          <div className="flex flex-col gap-6">
            <section className="bg-gradient-to-br from-emerald-800 to-teal-900 text-white rounded-3xl p-6 shadow-lg flex flex-col gap-4 relative overflow-hidden">
              <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none translate-x-4 translate-y-4">
                <svg width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold">Halo, {farmerName}! 👋</h2>
                <p className="text-sm text-emerald-100 mt-1">
                  TaniLog IndexedDB aktif. Semua logs tersimpan aman di browser Anda tanpa internet.
                </p>
              </div>
              
              <button 
                onClick={() => setActiveTab("logbook")}
                className="w-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 transition-all text-white font-bold py-3.5 px-6 rounded-2xl shadow-md flex items-center justify-center gap-2 text-base select-none"
              >
                Cek Logbook Hari Ini
              </button>
            </section>

            {/* Global Financial Brief */}
            <section className="grid grid-cols-2 gap-4">
              <div 
                onClick={() => setActiveTab("finance")}
                className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200/60 hover:border-emerald-300 cursor-pointer transition-all flex flex-col gap-1"
              >
                <span className="text-xs text-stone-500 font-medium">Total Modal (Semua)</span>
                <span className="text-lg font-bold text-stone-800">Rp {globalExpenses.toLocaleString("id-ID")}</span>
                <span className="text-[10px] text-stone-400 font-medium mt-1">Klik untuk detail ledger</span>
              </div>
              <div 
                onClick={() => setActiveTab("finance")}
                className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200/60 hover:border-emerald-300 cursor-pointer transition-all flex flex-col gap-1"
              >
                <span className="text-xs text-stone-500 font-medium">Laba / Rugi Bersih</span>
                <span className={`text-lg font-bold ${globalNetProfit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                  {globalNetProfit >= 0 ? "+" : ""}Rp {globalNetProfit.toLocaleString("id-ID")}
                </span>
                <span className="text-[10px] text-stone-400 font-medium mt-1">Status BEP Mandiri</span>
              </div>
            </section>

            {/* Kisi Kartu Proyek Lahan Tani Anda */}
            <section className="flex flex-col gap-3">
              <h4 className="font-bold text-stone-800 text-base px-1">Daftar Proyek Lahan Tani</h4>
              <div className="grid grid-cols-1 gap-3.5">
                {projects.map((p) => {
                  const pTasks = allTasks.filter(t => t.projectId === p.id);
                  const pCompleted = pTasks.filter(t => t.isCompleted).length;
                  const pProgress = pTasks.length > 0 ? Math.round((pCompleted / pTasks.length) * 100) : 0;
                  const isActive = selectedProjectId === p.id;
                  
                  // Plant type icon mapper
                  let plantIcon = "🌾";
                  if (p.plantType === "Cabai") plantIcon = "🌶️";
                  if (p.plantType === "Jagung") plantIcon = "🌽";
                  if (p.plantType === "Tomat") plantIcon = "🍅";

                  return (
                    <div
                      key={p.id}
                      className={`bg-white rounded-2xl p-4 shadow-sm border transition-all flex flex-col gap-3 ${
                        isActive 
                          ? "border-emerald-600 ring-2 ring-emerald-500/20 shadow-md" 
                          : "border-stone-200/60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div
                          className="flex items-center gap-3 flex-1 cursor-pointer"
                          onClick={() => setSelectedProjectId(p.id || null)}
                        >
                          <div className="h-10 w-10 bg-emerald-50 rounded-xl flex items-center justify-center text-lg shadow-inner shrink-0">
                            {plantIcon}
                          </div>
                          <div>
                            <h5 className="font-bold text-stone-800 text-sm">{p.name}</h5>
                            <p className="text-[10px] text-stone-400 font-semibold uppercase mt-0.5">
                              {p.plantType} • Ditanam {p.plantingDate}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isActive 
                              ? "bg-emerald-100 text-emerald-800" 
                              : "bg-stone-100 text-stone-500"
                          }`}>
                            {isActive ? "Aktif" : "Pilih"}
                          </span>
                          {/* Delete project button */}
                          {confirmDeleteProjectId === p.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteProject(p.id!); }}
                                className="text-[10px] bg-rose-600 text-white font-bold px-2 py-1 rounded-lg hover:bg-rose-700 transition-colors"
                              >
                                Hapus!
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setConfirmDeleteProjectId(null); }}
                                className="text-[10px] bg-stone-200 text-stone-600 font-bold px-2 py-1 rounded-lg hover:bg-stone-300 transition-colors"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteProjectId(p.id!); }}
                              className="h-7 w-7 flex items-center justify-center rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-500 transition-colors"
                              title="Hapus proyek ini"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
                          <span>Progres Perawatan</span>
                          <span className="font-bold text-emerald-700">{pProgress}%</span>
                        </div>
                        <div className="w-full bg-stone-100 h-2.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-emerald-600 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${pProgress}%` }} 
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Tasks Summary */}
            {selectedProjectId ? (
              <section className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200/60 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-stone-800 text-base">Progres Lahan Terpilih</h4>
                    <p className="text-xs text-stone-500 mt-0.5">Catatan sawah aktif</p>
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full">
                    {progressPercent}% Selesai
                  </span>
                </div>

                <div>
                  <div className="w-full bg-stone-100 h-3 rounded-full overflow-hidden mb-3">
                    <div className="bg-emerald-600 h-full rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                  </div>
                  <p className="text-xs text-stone-500">
                    Terdapat {tasks.length - completedTasksCount} tugas lagi yang perlu Anda selesaikan di kebun ini.
                  </p>
                </div>
              </section>
            ) : null}
          </div>
        )}

        {/* ==================== TAB 2: LOGBOOK ==================== */}
        {activeTab === "logbook" && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between px-1">
              <div>
                <h3 className="text-lg font-bold text-stone-800">Catatan Harian Lapangan</h3>
                <p className="text-xs text-stone-500">Pantau dan catat perkembangan tanaman Anda</p>
              </div>
              <button 
                onClick={() => setShowAddManualLog(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-sm transition-all flex items-center gap-1.5 active:scale-95 shrink-0"
              >
                <span>➕ Catatan Lapangan</span>
              </button>
            </div>

            {/* Section 1: Jadwal Perawatan Terencana */}
            {(() => {
              const scheduledTasks = tasks.filter(t => ["Penyiraman", "Pemupukan", "Panen", "Proteksi"].includes(t.category));
              return (
                <section className="flex flex-col gap-3">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="font-bold text-stone-700 text-sm">Jadwal Perawatan Terencana</h4>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100/60">
                      {scheduledTasks.filter(t => t.isCompleted).length}/{scheduledTasks.length} Selesai
                    </span>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {scheduledTasks.length > 0 ? (
                      scheduledTasks.map(task => (
                        <div 
                          key={task.id}
                          onClick={() => toggleTask(task.id!, task.isCompleted)}
                          className={`bg-white rounded-2xl p-4 shadow-sm border transition-all duration-200 cursor-pointer flex items-center justify-between select-none ${
                            task.isCompleted ? "border-emerald-200 bg-emerald-50/20" : "border-stone-200/60 hover:border-stone-300"
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            {/* Circle Checkbox */}
                            <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${
                              task.isCompleted ? "border-emerald-600 bg-emerald-600 text-white" : "border-stone-300 bg-white"
                            }`}>
                              {task.isCompleted && (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <div>
                              <p className={`text-sm font-bold text-stone-800 ${task.isCompleted ? "line-through text-stone-400" : ""}`}>
                                {task.title}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] bg-stone-100 text-stone-500 font-semibold px-2 py-0.5 rounded-md">
                                  {task.category}
                                </span>
                                <span className="text-[10px] text-stone-400 font-medium">
                                  🕒 {task.scheduledDate}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="bg-white rounded-2xl p-6 border border-stone-200/60 text-center text-stone-400 text-xs">
                        Belum ada jadwal tugas perawatan terencana.
                      </div>
                    )}
                  </div>
                </section>
              );
            })()}

            {/* Section 2: Buku Catatan Lapangan & Temuan Kejadian */}
            {(() => {
              const observationTasks = tasks.filter(t => ["Hama", "Penyakit", "Pengairan", "Lainnya"].includes(t.category));
              return (
                <section className="flex flex-col gap-3">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="font-bold text-stone-700 text-sm">Catatan Temuan Lapangan & Kejadian</h4>
                    <span className="text-[10px] font-bold text-stone-500 bg-stone-100 px-2.5 py-1 rounded-md">
                      {observationTasks.length} Laporan
                    </span>
                  </div>

                  <div className="flex flex-col gap-3">
                    {observationTasks.length > 0 ? (
                      observationTasks.map(task => {
                        const isCompleted = task.isCompleted;
                        
                        // Styling and alarms based on category
                        let cardStyles = "border-stone-200 bg-white";
                        let badgeStyles = "bg-stone-100 text-stone-700";
                        let emoji = "📝";

                        if (task.category === "Hama") {
                          cardStyles = isCompleted ? "border-emerald-200 bg-emerald-50/10" : "border-rose-300 bg-rose-50/10";
                          badgeStyles = "bg-rose-100 text-rose-700 font-bold border border-rose-200";
                          emoji = "🐛";
                        } else if (task.category === "Penyakit") {
                          cardStyles = isCompleted ? "border-emerald-200 bg-emerald-50/10" : "border-amber-300 bg-amber-50/10";
                          badgeStyles = "bg-amber-100 text-amber-800 font-bold border border-amber-200";
                          emoji = "🦠";
                        } else if (task.category === "Pengairan") {
                          cardStyles = isCompleted ? "border-emerald-200 bg-emerald-50/10" : "border-sky-300 bg-sky-50/10";
                          badgeStyles = "bg-sky-100 text-sky-700 font-bold border border-sky-200";
                          emoji = "💧";
                        } else {
                          cardStyles = isCompleted ? "border-emerald-200 bg-emerald-50/10" : "border-stone-200 bg-white";
                          badgeStyles = "bg-stone-100 text-stone-600 border border-stone-200";
                          emoji = "📝";
                        }

                        return (
                          <div 
                            key={task.id}
                            className={`bg-white rounded-2xl p-4 shadow-sm border transition-all duration-200 flex flex-col gap-2.5 ${cardStyles}`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex gap-3">
                                <div 
                                  onClick={() => toggleTask(task.id!, task.isCompleted)}
                                  className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer shrink-0 mt-0.5 ${
                                    isCompleted ? "border-emerald-600 bg-emerald-600 text-white" : "border-stone-300 bg-white hover:border-stone-400"
                                  }`}
                                >
                                  {isCompleted && (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                                <div>
                                  <p className={`text-sm font-bold text-stone-800 ${isCompleted ? "line-through text-stone-400" : ""}`}>
                                    {task.title}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1.5">
                                    <span className={`text-[9px] uppercase px-2 py-0.5 rounded-md font-extrabold tracking-wider ${badgeStyles}`}>
                                      {emoji} {task.category}
                                    </span>
                                    <span className="text-[10px] text-stone-400 font-medium">
                                      🕒 {task.scheduledDate}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Sync indicator + Delete button */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                {task.syncStatus === "pending" && (
                                  <span className="bg-amber-50 text-amber-700 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md border border-amber-100/50">
                                    Offline
                                  </span>
                                )}
                                {confirmDeleteLogId === task.id ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => deleteLogEntry(task.id!)}
                                      className="text-[10px] bg-rose-600 text-white font-bold px-2 py-0.5 rounded-lg hover:bg-rose-700"
                                    >
                                      Hapus
                                    </button>
                                    <button
                                      onClick={() => setConfirmDeleteLogId(null)}
                                      className="text-[10px] bg-stone-200 text-stone-600 font-bold px-2 py-0.5 rounded-lg hover:bg-stone-300"
                                    >
                                      Batal
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setConfirmDeleteLogId(task.id!)}
                                    className="h-6 w-6 flex items-center justify-center rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-400 transition-colors"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </div>

                            {task.notes && (
                              <div className="bg-stone-50/50 rounded-xl p-3 border border-stone-100 text-xs text-stone-600 leading-relaxed font-medium">
                                {task.notes}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="bg-white rounded-2xl p-6 border border-stone-200/60 text-center text-stone-400 text-xs">
                        Belum ada catatan insiden lapangan atau observasi manual. Klik "+ Catatan Lapangan" untuk mencatat temuan hari ini.
                      </div>
                    )}
                  </div>
                </section>
              );
            })()}

            {/* Info Offline */}
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-xs text-emerald-800 flex gap-2.5 items-start">
              <span className="text-base">💡</span>
              <p>
                Semua perubahan ceklis dicatat instan di browser Anda. Saat internet kembali terhubung, data akan sinkron otomatis ke server database.
              </p>
            </div>
          </div>
        )}

        {/* ==================== TAB 3: FINANCE (KEUANGAN) ==================== */}
        {activeTab === "finance" && (
          <div className="flex flex-col gap-6">

            {/* === RINGKASAN BEP REAL-TIME === */}
            <section className="bg-gradient-to-br from-emerald-900 to-teal-900 text-white rounded-3xl p-5 shadow-lg flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-emerald-100 text-sm tracking-wider uppercase">Kalkulator BEP Lahan</h3>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black shadow-inner ${
                  isBEPAman ? "bg-emerald-400/30 text-emerald-200" : "bg-rose-400/30 text-rose-200"
                }`}>
                  {isBEPAman ? "✅ BEP Tercapai" : "⏳ Belum BEP"}
                </span>
              </div>

              {/* 4-Metric Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/10 rounded-2xl p-3 flex flex-col gap-1">
                  <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wide">💰 Total Modal</span>
                  <p className="text-base font-extrabold">Rp {totalModal.toLocaleString("id-ID")}</p>
                  <span className="text-[9px] text-emerald-400">Semua pengeluaran lahan</span>
                </div>
                <div className="bg-white/10 rounded-2xl p-3 flex flex-col gap-1">
                  <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wide">⚖️ HPP / kg</span>
                  <p className="text-base font-extrabold">
                    {hppPerKg > 0 ? `Rp ${Math.round(hppPerKg).toLocaleString("id-ID")}` : "—"}
                  </p>
                  <span className="text-[9px] text-emerald-400">Harga Pokok Produksi</span>
                </div>
                <div className="bg-white/10 rounded-2xl p-3 flex flex-col gap-1">
                  <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wide">📦 Titik BEP</span>
                  <p className="text-base font-extrabold">
                    {titikBEP > 0 ? `${Math.ceil(titikBEP).toLocaleString("id-ID")} kg` : "—"}
                  </p>
                  <span className="text-[9px] text-emerald-400">Min. panen untuk balik modal</span>
                </div>
                <div className={`rounded-2xl p-3 flex flex-col gap-1 ${
                  isBEPAman ? "bg-emerald-500/30" : "bg-rose-500/20"
                }`}>
                  <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wide">📈 Keuntungan</span>
                  <p className={`text-base font-extrabold ${isBEPAman ? "text-emerald-200" : "text-rose-300"}`}>
                    {keuntunganBersih >= 0 ? "+" : ""}Rp {keuntunganBersih.toLocaleString("id-ID")}
                  </p>
                  <span className="text-[9px] text-emerald-400">Pendapatan - Modal</span>
                </div>
              </div>

              {/* Panen progress bar */}
              {titikBEP > 0 && (
                <div>
                  <div className="flex justify-between text-[10px] text-emerald-300 mb-1.5">
                    <span>Progres Panen vs BEP</span>
                    <span>{Math.min(100, Math.round((totalBeratPanen / titikBEP) * 100))}%</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(100, (totalBeratPanen / titikBEP) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-emerald-400 mt-1">
                    Sudah panen {totalBeratPanen.toLocaleString("id-ID")} kg dari target BEP {Math.ceil(titikBEP).toLocaleString("id-ID")} kg
                  </p>
                </div>
              )}
            </section>

            {/* === FORM CATAT PANEN (Berat × Harga Jual) === */}
            <section className="bg-white rounded-2xl shadow-sm border border-stone-200/60 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowPanenForm(v => !v)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">🌾</span>
                  <span className="font-bold text-stone-800 text-sm">Catat Hasil Panen</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full">Berat × Harga</span>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-stone-400 transition-transform ${showPanenForm ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showPanenForm && (
                <form onSubmit={addPanenIncome} className="px-5 pb-5 flex flex-col gap-3 border-t border-stone-100">
                  <p className="text-xs text-stone-400 pt-3">Masukkan total berat hasil panen dan harga jual per kg. Sistem menghitung otomatis total pendapatan.</p>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-stone-400 font-bold">Pilih Lahan Proyek</label>
                    <select
                      value={panenProjectId}
                      onChange={(e) => setPanenProjectId(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-emerald-600"
                      required
                    >
                      <option value="">-- Pilih Proyek --</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-stone-400 font-bold">Total Berat Panen (kg)</label>
                      <input
                        type="number"
                        placeholder="Contoh: 150"
                        value={panenBerat}
                        onChange={(e) => setPanenBerat(e.target.value)}
                        min="0.1" step="0.1"
                        className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-emerald-600"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-stone-400 font-bold">Harga Jual (Rp/kg)</label>
                      <input
                        type="number"
                        placeholder="Contoh: 8000"
                        value={panenHarga}
                        onChange={(e) => setPanenHarga(e.target.value)}
                        min="1"
                        className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-emerald-600"
                        required
                      />
                    </div>
                  </div>

                  {/* Live Preview Total */}
                  {panenBerat && panenHarga && parseFloat(panenBerat) > 0 && parseFloat(panenHarga) > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between">
                      <span className="text-xs text-emerald-700 font-medium">
                        {parseFloat(panenBerat).toLocaleString("id-ID")} kg × Rp {parseFloat(panenHarga).toLocaleString("id-ID")}
                      </span>
                      <span className="text-sm font-black text-emerald-800">
                        = Rp {(parseFloat(panenBerat) * parseFloat(panenHarga)).toLocaleString("id-ID")}
                      </span>
                    </div>
                  )}

                  <input
                    type="text"
                    placeholder="Keterangan (opsional)"
                    value={panenKet}
                    onChange={(e) => setPanenKet(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-emerald-600"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setShowPanenForm(false)}
                      className="py-3 rounded-xl text-sm font-bold border border-stone-200 text-stone-600 hover:bg-stone-50">
                      Batal
                    </button>
                    <button type="submit"
                      className="py-3 rounded-xl text-sm font-bold bg-emerald-700 hover:bg-emerald-800 text-white transition-all">
                      Simpan Panen
                    </button>
                  </div>
                </form>
              )}
            </section>

            {/* === FORM CATAT PENGELUARAN === */}
            <section className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200/60">
              <h4 className="font-bold text-stone-800 text-sm mb-4 flex items-center gap-2">
                <span>💸</span> Catat Pengeluaran
              </h4>
              <form onSubmit={addTransaction} className="flex flex-col gap-3">

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-stone-400 font-bold">Pilih Sektor Lahan</label>
                  <select
                    value={newTxProjectId}
                    onChange={(e) => setNewTxProjectId(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-emerald-600 focus:bg-white"
                  >
                    <option value="">-- Pilih Proyek --</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-stone-400 font-bold">Kategori</label>
                    <select
                      value={newCat}
                      onChange={(e) => setNewCat(e.target.value)}
                      className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-3 text-sm focus:outline-emerald-600 focus:bg-white"
                    >
                      <option value="Benih">🌱 Benih/Bibit</option>
                      <option value="Pupuk">🧪 Pupuk</option>
                      <option value="Obat">💊 Obat/Pestisida</option>
                      <option value="Tenaga Kerja">👷 Tenaga Kerja</option>
                      <option value="Alat">🔧 Alat & Mesin</option>
                      <option value="Irigasi">💧 Irigasi/Air</option>
                      <option value="Lainnya">📦 Lainnya</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-stone-400 font-bold">Jumlah (Rp)</label>
                    <input
                      type="number"
                      placeholder="Nominal"
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-emerald-600 focus:bg-white"
                      required
                      min="1"
                    />
                  </div>
                </div>

                <input
                  type="text"
                  placeholder="Keterangan (misal: Beli Urea 50kg)"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-emerald-600 focus:bg-white"
                  required
                />

                <button
                  type="submit"
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all active:scale-98"
                >
                  Tambah Pengeluaran
                </button>
              </form>
            </section>

            {/* Transaction History Ledger */}
            <section className="flex flex-col gap-3">
              <h4 className="font-bold text-stone-800 text-base px-1">Riwayat Transaksi Lahan Ini</h4>
              <div className="flex flex-col gap-2">
                {finances.length > 0 ? (
                  finances.map(tx => (
                    <div key={tx.id} className="bg-white rounded-xl p-4 shadow-sm border border-stone-100 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-stone-800 truncate">{tx.notes || tx.category}</p>
                        <span className="text-[10px] bg-stone-100 text-stone-500 font-bold px-2 py-0.5 rounded-md mt-1 inline-block">
                          {tx.category} • {tx.transactionDate}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-sm font-black ${tx.type === "expense" ? "text-rose-600" : "text-emerald-700"}`}>
                          {tx.type === "expense" ? "-" : "+"}Rp {tx.amount.toLocaleString("id-ID")}
                        </span>
                        {/* Delete transaction */}
                        {confirmDeleteTxId === tx.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => deleteTransaction(tx.id!)}
                              className="text-[10px] bg-rose-600 text-white font-bold px-2 py-1 rounded-lg hover:bg-rose-700"
                            >
                              Hapus
                            </button>
                            <button
                              onClick={() => setConfirmDeleteTxId(null)}
                              className="text-[10px] bg-stone-200 text-stone-600 font-bold px-2 py-1 rounded-lg hover:bg-stone-300"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteTxId(tx.id!)}
                            className="h-7 w-7 flex items-center justify-center rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-400 transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-white rounded-xl p-8 border border-stone-200/60 text-center text-stone-400 text-xs">
                    Belum ada data pemasukan atau pengeluaran di lahan ini.
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* ==================== TAB 4: SETTINGS (PENGATURAN) ==================== */}
        {activeTab === "settings" && (
          <div className="flex flex-col gap-6">
            
            {/* Profile settings */}
            <section className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200/60 flex flex-col gap-4">
              <h4 className="font-bold text-stone-800 text-base border-b border-stone-100 pb-2">Identitas Petani</h4>
              
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-stone-500 font-bold">Nama Petani</label>
                  <input 
                    type="text"
                    value={farmerName}
                    onChange={(e) => saveFarmerName(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-emerald-600 focus:bg-white"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-stone-500 font-bold">Nama Kebun / Sawah</label>
                  <input 
                    type="text"
                    value={farmName}
                    onChange={(e) => saveFarmName(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-emerald-600 focus:bg-white"
                  />
                </div>
              </div>
            </section>

            {/* Offline & PWA Info */}
            <section className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200/60 flex flex-col gap-4">
              <h4 className="font-bold text-stone-800 text-base border-b border-stone-100 pb-2">PWA & Database Lokal</h4>
              
              <div className="flex flex-col gap-3 text-xs text-stone-600">
                <div className="flex justify-between items-center py-1">
                  <span>Penyimpanan Lokal (IndexedDB)</span>
                  <span className="text-emerald-700 font-bold">Aktif (Dexie.js)</span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-stone-50">
                  <span>Total Proyek Tersimpan</span>
                  <span className="font-semibold text-stone-800">{projects.length} Lahan</span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-stone-50">
                  <span>Pending Sinkronisasi</span>
                  <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded text-[10px]">
                    {allTasks.filter(t => t.syncStatus === "pending").length + allFinances.filter(f => f.syncStatus === "pending").length} Baris
                  </span>
                </div>
              </div>
            </section>

            {/* Bulk manual sync trigger */}
            <button 
              onClick={handleSyncDatabase}
              className="w-full bg-emerald-800 hover:bg-emerald-950 text-white font-bold py-4 px-6 rounded-2xl shadow-md transition-all active:scale-98 text-sm"
            >
              🔄 Sinkronkan Data ke Server Sekarang
            </button>
          </div>
        )}

      </main>

      {/* ==================== PROJECT CREATION MODAL OVERLAY ==================== */}
      {showAddProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm flex flex-col gap-4 shadow-xl border border-stone-100">
            <div>
              <h3 className="text-lg font-bold text-stone-800">Mulai Tanam Baru 🌾</h3>
              <p className="text-xs text-stone-500 mt-0.5">Membuat jadwal perawatan sawah luring secara otomatis</p>
            </div>

            <form onSubmit={handleCreateProject} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-stone-500 font-bold">Nama Sektor / Lahan</label>
                <input 
                  type="text"
                  placeholder="Contoh: Sawah Bedengan 3"
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                  className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-emerald-600 focus:bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-stone-500 font-bold">Jenis Tanaman</label>
                  <select
                    value={newProjType}
                    onChange={(e) => setNewProjType(e.target.value)}
                    className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-3 text-sm focus:outline-emerald-600 focus:bg-white"
                  >
                    <option value="Padi">🌾 Padi</option>
                    <option value="Cabai">🌶️ Cabai</option>
                    <option value="Jagung">🌽 Jagung</option>
                    <option value="Tomat">🍅 Tomat</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-stone-500 font-bold">Tanggal Tanam</label>
                  <input 
                    type="date"
                    value={newProjDate}
                    onChange={(e) => setNewProjDate(e.target.value)}
                    className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-emerald-600 focus:bg-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowAddProject(false)}
                  className="bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold py-3 rounded-xl text-xs transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3 rounded-xl text-xs transition-colors shadow-md"
                >
                  Simpan Proyek
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MANUAL LOG CREATION MODAL OVERLAY ==================== */}
      {showAddManualLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm flex flex-col gap-4 shadow-xl border border-stone-100">
            <div>
              <h3 className="text-lg font-bold text-stone-800">Tambah Catatan Lapangan 📝</h3>
              <p className="text-xs text-stone-500 mt-0.5">Dokumentasikan temuan atau buat tugas perawatan manual</p>
            </div>

            <form onSubmit={handleCreateManualLog} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-stone-500 font-bold">Catatan / Kegiatan</label>
                <input 
                  type="text"
                  placeholder="Contoh: Ditemukan Kutu Kebul"
                  value={manualLogTitle}
                  onChange={(e) => setManualLogTitle(e.target.value)}
                  className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-emerald-600 focus:bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-stone-500 font-bold">Kategori</label>
                  <select
                    value={manualLogCategory}
                    onChange={(e) => setManualLogCategory(e.target.value)}
                    className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-3 text-sm focus:outline-emerald-600 focus:bg-white"
                  >
                    <option value="Hama">🐛 Hama</option>
                    <option value="Penyakit">🦠 Penyakit</option>
                    <option value="Pengairan">💧 Pengairan</option>
                    <option value="Lainnya">📝 Lainnya</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-stone-500 font-bold">Tanggal Catatan</label>
                  <input 
                    type="date"
                    value={manualLogDate}
                    onChange={(e) => setManualLogDate(e.target.value)}
                    className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-emerald-600 focus:bg-white"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-stone-500 font-bold">Keterangan Tambahan (Opsional)</label>
                <textarea 
                  placeholder="Tulis deskripsi detail temuan di sini..."
                  value={manualLogNotes}
                  onChange={(e) => setManualLogNotes(e.target.value)}
                  rows={3}
                  className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-emerald-600 focus:bg-white resize-none"
                />
              </div>

              <div className="flex items-center gap-3 bg-stone-50 p-3 rounded-xl border border-stone-200/50">
                <input
                  type="checkbox"
                  id="manualLogIsCompleted"
                  checked={manualLogIsCompleted}
                  onChange={(e) => setManualLogIsCompleted(e.target.checked)}
                  className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="manualLogIsCompleted" className="text-xs text-stone-600 font-semibold select-none cursor-pointer">
                  Tandai selesai dicatat / diselesaikan
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowAddManualLog(false)}
                  className="bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold py-3 rounded-xl text-xs transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3 rounded-xl text-xs transition-colors shadow-md"
                >
                  Simpan Catatan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Thumb-friendly bottom sticky navigation (Mobile-Only) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-stone-200/80 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] pb-safe">
        <div className="mx-auto max-w-lg flex h-16 items-center justify-around px-2">
          
          {/* Dashboard Tab Trigger */}
          <button 
            onClick={() => setActiveTab("dashboard")}
            className={`flex flex-col items-center justify-center gap-1 flex-1 h-full py-1 transition-colors ${
              activeTab === "dashboard" ? "text-emerald-700" : "text-stone-400 hover:text-stone-600"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5.5 w-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <span className={`text-[10px] ${activeTab === "dashboard" ? "font-bold" : "font-semibold"}`}>Dashboard</span>
          </button>

          {/* Logbook Tab Trigger */}
          <button 
            onClick={() => setActiveTab("logbook")}
            className={`flex flex-col items-center justify-center gap-1 flex-1 h-full py-1 transition-colors ${
              activeTab === "logbook" ? "text-emerald-700" : "text-stone-400 hover:text-stone-600"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5.5 w-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <span className={`text-[10px] ${activeTab === "logbook" ? "font-bold" : "font-semibold"}`}>Logbook</span>
          </button>

          {/* Keuangan Tab Trigger */}
          <button 
            onClick={() => setActiveTab("finance")}
            className={`flex flex-col items-center justify-center gap-1 flex-1 h-full py-1 transition-colors ${
              activeTab === "finance" ? "text-emerald-700" : "text-stone-400 hover:text-stone-600"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5.5 w-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className={`text-[10px] ${activeTab === "finance" ? "font-bold" : "font-semibold"}`}>Keuangan</span>
          </button>

          {/* Pengaturan Tab Trigger */}
          <button 
            onClick={() => setActiveTab("settings")}
            className={`flex flex-col items-center justify-center gap-1 flex-1 h-full py-1 transition-colors ${
              activeTab === "settings" ? "text-emerald-700" : "text-stone-400 hover:text-stone-600"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5.5 w-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className={`text-[10px] ${activeTab === "settings" ? "font-bold" : "font-semibold"}`}>Pengaturan</span>
          </button>
          
        </div>
      </nav>
    </div>
  );
}
