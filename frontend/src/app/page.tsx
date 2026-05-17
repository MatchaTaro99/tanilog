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

  // Selected project filter for logging and finances
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  // User Profile state (backed by localStorage)
  const [farmerName, setFarmerName] = useState("Pak Tani");
  const [farmName, setFarmName] = useState("Sawah Makmur");

  // Form State for new transaction
  const [newDesc, setNewDesc] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newType, setNewType] = useState<"expense" | "income">("expense");
  const [newCat, setNewCat] = useState("Lainnya");
  const [newTxProjectId, setNewTxProjectId] = useState<string>("");

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

    // 2. Generate custom scheduled tasks based on planting date
    const d1 = new Date(newProjDate);
    const d2 = new Date(newProjDate);
    const d3 = new Date(newProjDate);

    d1.setDate(d1.getDate() + 1); // Water tomorrow
    d2.setDate(d2.getDate() + 14); // Fertiziler in 2 weeks
    d3.setDate(d3.getDate() + 90); // Harvest in 3 months

    await db.logbooks.bulkAdd([
      {
        projectId: projId,
        title: "Penyiraman Awal Sektor Baru",
        category: "Penyiraman",
        scheduledDate: d1.toISOString().split("T")[0],
        isCompleted: false,
        notes: `Penyiraman pertama untuk benih ${newProjType}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        syncStatus: "pending",
      },
      {
        projectId: projId,
        title: "Pemupukan Dasar Awal",
        category: "Pemupukan",
        scheduledDate: d2.toISOString().split("T")[0],
        isCompleted: false,
        notes: "Gunakan pupuk NPK berimbang",
        createdAt: new Date(),
        updatedAt: new Date(),
        syncStatus: "pending",
      },
      {
        projectId: projId,
        title: `Panen Raya ${newProjName}`,
        category: "Panen",
        scheduledDate: d3.toISOString().split("T")[0],
        isCompleted: false,
        notes: "Target panen kualitas premium",
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
  };

  // Financial calculations (Global metrics across all projects)
  const globalExpenses = allFinances.filter(t => t.type === "expense").reduce((acc, t) => acc + t.amount, 0);
  const globalIncomes = allFinances.filter(t => t.type === "income").reduce((acc, t) => acc + t.amount, 0);
  const globalNetProfit = globalIncomes - globalExpenses;

  // Selected project metrics
  const projectExpenses = finances.filter(t => t.type === "expense").reduce((acc, t) => acc + t.amount, 0);
  const projectIncomes = finances.filter(t => t.type === "income").reduce((acc, t) => acc + t.amount, 0);
  const projectNetProfit = projectIncomes - projectExpenses;

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
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between px-1">
              <div>
                <h3 className="text-lg font-bold text-stone-800">Catatan Harian Lapangan</h3>
                <p className="text-xs text-stone-500">Centang kegiatan setelah selesai dilakukan di sawah</p>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
                {completedTasksCount}/{tasks.length} Selesai
              </span>
            </div>

            {/* Checklist Container */}
            <div className="flex flex-col gap-3">
              {tasks.length > 0 ? (
                tasks.map(task => (
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
                <div className="bg-white rounded-2xl p-8 border border-stone-200/60 text-center text-stone-400 text-xs">
                  Belum ada logbook/jadwal tugas untuk proyek lahan ini. Silakan buat Proyek baru untuk meng-generate jadwal otomatis.
                </div>
              )}
            </div>

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
            
            {/* Interactive Calculator BEP */}
            <section className="bg-gradient-to-br from-emerald-800 to-teal-900 text-white rounded-3xl p-5 shadow-lg flex flex-col gap-4">
              <h3 className="font-bold text-emerald-100 text-sm tracking-wider uppercase">BEP Lahan Aktif</h3>
              
              <div className="grid grid-cols-2 gap-4 border-b border-emerald-700/60 pb-4">
                <div>
                  <span className="text-xs text-emerald-300">Modal Terpakai</span>
                  <p className="text-lg font-extrabold mt-0.5">Rp {projectExpenses.toLocaleString("id-ID")}</p>
                </div>
                <div>
                  <span className="text-xs text-emerald-300">Hasil Penjualan</span>
                  <p className="text-lg font-extrabold mt-0.5">Rp {projectIncomes.toLocaleString("id-ID")}</p>
                </div>
              </div>

              <div className="flex justify-between items-center pt-1">
                <div>
                  <span className="text-xs text-emerald-300">Saldo Net Profit (Lahan)</span>
                  <p className="text-xl font-black mt-0.5">Rp {projectNetProfit.toLocaleString("id-ID")}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-inner ${
                  projectNetProfit >= 0 ? "bg-emerald-500/30 text-emerald-200" : "bg-rose-500/30 text-rose-200"
                }`}>
                  {projectNetProfit >= 0 ? "BEP Aman" : "Proses BEP"}
                </span>
              </div>
            </section>

            {/* Quick Add Transaction Form */}
            <section className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200/60">
              <h4 className="font-bold text-stone-800 text-base mb-4">Catat Keuangan Cepat</h4>
              <form onSubmit={addTransaction} className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    type="button"
                    onClick={() => setNewType("expense")}
                    className={`py-2 px-4 rounded-xl text-xs font-bold border transition-all ${
                      newType === "expense" 
                        ? "bg-rose-50 border-rose-300 text-rose-700" 
                        : "bg-white border-stone-200 text-stone-500 hover:bg-stone-50"
                    }`}
                  >
                    💸 Pengeluaran
                  </button>
                  <button 
                    type="button"
                    onClick={() => setNewType("income")}
                    className={`py-2 px-4 rounded-xl text-xs font-bold border transition-all ${
                      newType === "income" 
                        ? "bg-emerald-50 border-emerald-300 text-emerald-700" 
                        : "bg-white border-stone-200 text-stone-500 hover:bg-stone-50"
                    }`}
                  >
                    💰 Pemasukan
                  </button>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-stone-400 font-bold">Pilih Sektor Lahan</label>
                  <select
                    value={newTxProjectId}
                    onChange={(e) => setNewTxProjectId(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-emerald-600 focus:bg-white"
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <input 
                  type="text"
                  placeholder="Keterangan (misal: Beli Urea)"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-emerald-600 focus:bg-white"
                  required
                />

                <div className="grid grid-cols-2 gap-3">
                  <input 
                    type="number"
                    placeholder="Jumlah Rp"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-emerald-600 focus:bg-white"
                    required
                  />
                  <select
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                    className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-3 text-sm focus:outline-emerald-600 focus:bg-white"
                  >
                    <option value="Pupuk">Pupuk</option>
                    <option value="Bibit">Benih/Bibit</option>
                    <option value="Tenaga Kerja">Tenaga Kerja</option>
                    <option value="Panen">Penjualan Panen</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all active:scale-98"
                >
                  Tambah Catatan
                </button>
              </form>
            </section>

            {/* Transaction History Ledger */}
            <section className="flex flex-col gap-3">
              <h4 className="font-bold text-stone-800 text-base px-1">Riwayat Transaksi Lahan Ini</h4>
              <div className="flex flex-col gap-2">
                {finances.length > 0 ? (
                  finances.map(tx => (
                    <div key={tx.id} className="bg-white rounded-xl p-4 shadow-sm border border-stone-100 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-stone-800">{tx.notes || tx.category}</p>
                        <span className="text-[10px] bg-stone-100 text-stone-500 font-bold px-2 py-0.5 rounded-md mt-1 inline-block">
                          {tx.category} • {tx.transactionDate}
                        </span>
                      </div>
                      <span className={`text-sm font-black ${tx.type === "expense" ? "text-rose-600" : "text-emerald-700"}`}>
                        {tx.type === "expense" ? "-" : "+"}Rp {tx.amount.toLocaleString("id-ID")}
                      </span>
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

            {/* Bulk manual sync simulation */}
            <button 
              onClick={() => alert(`Simulasi sinkronisasi data luring: Berhasil meng-upload ke MySQL server!`)}
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
