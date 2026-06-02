// this is the main app file for NotifyMe - a smart reminder application built with React. It allows users to create, manage, and receive notifications for various types of reminders such as birthdays, anniversaries, meetings, and medication schedules. The app features a clean and intuitive interface with support for custom messages, automated emails, alarm notifications, and recurring reminders. Users can also upload custom alarm tones for a personalized experience. The app is designed to help users stay organized and never miss an important date or event again.
import { useState, useEffect, useRef, useCallback } from "react";

const STORAGE_KEY = "notifyme_reminders";
const CUSTOM_ALARM_STORAGE_KEY = "notifyme_custom_alarms";
const MAX_AUDIO_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_AUDIO_FORMATS = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/webm"];
const ALLOWED_AUDIO_EXTENSIONS = [".mp3", ".wav", ".ogg", ".m4a", ".webm"];

const initialReminders = [
  {
    id: 1,
    title: "Mom's Birthday",
    type: "birthday",
    date: "2026-06-15",
    time: "09:00",
    message: "Happy Birthday Mom! Wishing you a wonderful day filled with joy!",
    email: "mom@example.com",
    sendEmail: true,
    alarm: true,
    repeat: "yearly",
    status: "active",
    icon: "🎂",
  },
  {
    id: 2,
    title: "Wedding Anniversary",
    type: "anniversary",
    date: "2026-07-20",
    time: "10:00",
    message: "Happy Anniversary! Celebrating another beautiful year together.",
    email: "partner@example.com",
    sendEmail: true,
    alarm: true,
    repeat: "yearly",
    status: "active",
    icon: "💍",
  },
];

const REMINDER_TYPES = [
  { value: "reminder", label: "General Reminder", icon: "🔔" },
  { value: "birthday", label: "Birthday", icon: "🎂" },
  { value: "anniversary", label: "Anniversary", icon: "💍" },
  { value: "meeting", label: "Meeting", icon: "📅" },
  { value: "medication", label: "Medication", icon: "💊" },
  { value: "custom", label: "Custom", icon: "✨" },
];

const REPEAT_OPTIONS = [
  { value: "never", label: "Never" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 0) return `${Math.abs(diff)}d ago`;
  return `${diff}d away`;
}

function typeIcon(type) {
  return REMINDER_TYPES.find((t) => t.value === type)?.icon || "🔔";
}

export default function NotifyMe() {
  const [reminders, setReminders] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : initialReminders;
    } catch {
      return initialReminders;
    }
  });

  const [view, setView] = useState("home"); // home | add | detail | settings
  const [activeTab, setActiveTab] = useState("upcoming");
  const [editId, setEditId] = useState(null);
  const [alarm, setAlarm] = useState(null); // { id, title, message }
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const alarmTimerRef = useRef(null);
  const alarmAudioRef = useRef(null);

  const [form, setForm] = useState({
    title: "",
    type: "reminder",
    date: "",
    time: "",
    message: "",
    email: "",
    sendEmail: false,
    alarm: true,
    repeat: "never",
    icon: "🔔",
    customAlarmTone: null, // { id, name, data }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
    } catch {}
  }, [reminders]);

  // Check for due reminders every 30s
  useEffect(() => {
    const check = () => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const yyyy = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      reminders.forEach((r) => {
        if (r.status === "active" && r.date === yyyy && r.time === hhmm) {
          if (r.alarm) {
            setAlarm({ id: r.id, title: r.title, message: r.message, customAlarmTone: r.customAlarmTone });
          }
        }
      });
    };
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [reminders]);

  // Play alarm audio when notification triggers
  useEffect(() => {
    if (alarm) {
      if (alarmAudioRef.current) {
        // Use custom alarm tone if available, otherwise use default
        const audioSource = alarm.customAlarmTone?.data || "/sounds/alarm.mp3";
        alarmAudioRef.current.src = audioSource;
        alarmAudioRef.current.currentTime = 0;
        alarmAudioRef.current.play().catch((err) => console.log("Audio play error:", err));
      }
    } else {
      if (alarmAudioRef.current) {
        alarmAudioRef.current.pause();
      }
    }
  }, [alarm]);

  const handleAudioUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_AUDIO_FORMATS.includes(file.type)) {
      alert(
        `Invalid audio format. Allowed formats: ${ALLOWED_AUDIO_EXTENSIONS.join(", ")}`
      );
      return;
    }

    // Validate file size
    if (file.size > MAX_AUDIO_SIZE) {
      alert(`File size exceeds 5MB limit. File size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
      return;
    }

    // Read file and convert to data URL
    const reader = new FileReader();
    reader.onload = (event) => {
      const alarmTone = {
        id: Date.now(),
        name: file.name,
        data: event.target.result,
      };
      setForm((prev) => ({ ...prev, customAlarmTone: alarmTone }));
    };
    reader.readAsDataURL(file);
    e.target.value = ""; // Reset input
  };

  const openAdd = useCallback((preset = null) => {
    setForm(
      preset || {
        title: "",
        type: "reminder",
        date: "",
        time: "",
        message: "",
        email: "",
        sendEmail: false,
        alarm: true,
        repeat: "never",
        icon: "🔔",
        customAlarmTone: null,
      }
    );
    setEditId(null);
    setView("add");
  }, []);

  const openEdit = useCallback((r) => {
    setForm({ ...r });
    setEditId(r.id);
    setView("add");
  }, []);

  const saveReminder = () => {
    if (!form.title || !form.date || !form.time) return;
    
    // Check for alert conflict (duplicate date and time)
    const hasConflict = reminders.some((r) => {
      // Skip if editing the same reminder
      if (editId && r.id === editId) return false;
      // Check if same date and time exists
      return r.date === form.date && r.time === form.time;
    });

    if (hasConflict) {
      alert(
        `⚠️ Alert Conflict!\n\nA reminder is already scheduled for ${form.date} at ${form.time}.\n\nPlease choose a different date or time.`
      );
      return;
    }

    const icon = REMINDER_TYPES.find((t) => t.value === form.type)?.icon || "🔔";
    if (editId) {
      setReminders((prev) =>
        prev.map((r) => (r.id === editId ? { ...form, id: editId, icon } : r))
      );
    } else {
      setReminders((prev) => [
        ...prev,
        { ...form, id: Date.now(), status: "active", icon },
      ]);
    }
    setView("home");
  };

  const deleteReminder = (id) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
    setView("home");
  };

  const toggleStatus = (id) => {
    setReminders((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: r.status === "active" ? "paused" : "active" } : r
      )
    );
  };

  const filtered = reminders.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch =
      r.title.toLowerCase().includes(q) || r.message?.toLowerCase().includes(q);
    const matchFilter = filter === "all" || r.type === filter;
    if (activeTab === "upcoming") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const d = new Date(r.date + "T00:00:00");
      return matchSearch && matchFilter && d >= today;
    }
    if (activeTab === "past") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const d = new Date(r.date + "T00:00:00");
      return matchSearch && matchFilter && d < today;
    }
    return matchSearch && matchFilter;
  }).sort((a, b) => new Date(a.date) - new Date(b.date));

  const upcoming = reminders
    .filter((r) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return new Date(r.date + "T00:00:00") >= today && r.status === "active";
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 3);

  // ── ALARM MODAL ──
  if (alarm) {
    return (
      <div style={styles.alarmOverlay}>
        <audio
          ref={alarmAudioRef}
          loop
          style={{ display: "none" }}
        />
        <div style={styles.alarmCard}>
          <div style={styles.alarmPulse}>🔔</div>
          <h2 style={styles.alarmTitle}>{alarm.title}</h2>
          <p style={styles.alarmMsg}>{alarm.message}</p>
          <button
            style={styles.alarmDismiss}
            onClick={() => setAlarm(null)}
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  // ── ADD / EDIT FORM ──
  if (view === "add") {
    return (
      <div style={styles.screen}>
        <header style={styles.header}>
          <button style={styles.backBtn} onClick={() => setView("home")}>
            ←
          </button>
          <span style={styles.headerTitle}>{editId ? "Edit Reminder" : "New Reminder"}</span>
          <span />
        </header>
        <div style={styles.formBody}>
          {/* Type Picker */}
          <label style={styles.fieldLabel}>Type</label>
          <div style={styles.typePicker}>
            {REMINDER_TYPES.map((t) => (
              <button
                key={t.value}
                style={{
                  ...styles.typeBtn,
                  ...(form.type === t.value ? styles.typeBtnActive : {}),
                }}
                onClick={() => setForm((f) => ({ ...f, type: t.value }))}
              >
                <span style={{ fontSize: 22 }}>{t.icon}</span>
                <span style={{ fontSize: 11, marginTop: 2 }}>{t.label}</span>
              </button>
            ))}
          </div>

          <label style={styles.fieldLabel}>Title *</label>
          <input
            style={styles.input}
            placeholder="e.g. Mom's Birthday"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={styles.fieldLabel}>Date *</label>
              <input
                style={styles.input}
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={styles.fieldLabel}>Time *</label>
              <input
                style={styles.input}
                type="time"
                value={form.time}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
              />
            </div>
          </div>

          <label style={styles.fieldLabel}>Message / Voice Note</label>
          <textarea
            style={{ ...styles.input, height: 80, resize: "none" }}
            placeholder="Write a custom message to be shown or sent..."
            value={form.message}
            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
          />

          <label style={styles.fieldLabel}>Repeat</label>
          <select
            style={styles.input}
            value={form.repeat}
            onChange={(e) => setForm((f) => ({ ...f, repeat: e.target.value }))}
          >
            {REPEAT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Email toggle */}
          <div style={styles.toggleRow}>
            <div>
              <div style={styles.toggleLabel}>Send Automated Email</div>
              <div style={styles.toggleSub}>Auto-send email on the date</div>
            </div>
            <div
              style={{ ...styles.toggle, ...(form.sendEmail ? styles.toggleOn : {}) }}
              onClick={() => setForm((f) => ({ ...f, sendEmail: !f.sendEmail }))}
            >
              <div style={{ ...styles.toggleThumb, ...(form.sendEmail ? styles.toggleThumbOn : {}) }} />
            </div>
          </div>

          {form.sendEmail && (
            <input
              style={styles.input}
              type="email"
              placeholder="recipient@email.com"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          )}

          {/* Alarm toggle */}
          <div style={styles.toggleRow}>
            <div>
              <div style={styles.toggleLabel}>Ring Alarm</div>
              <div style={styles.toggleSub}>Show popup alert at reminder time</div>
            </div>
            <div
              style={{ ...styles.toggle, ...(form.alarm ? styles.toggleOn : {}) }}
              onClick={() => setForm((f) => ({ ...f, alarm: !f.alarm }))}
            >
              <div style={{ ...styles.toggleThumb, ...(form.alarm ? styles.toggleThumbOn : {}) }} />
            </div>
          </div>

          {/* Custom Alarm Tone */}
          {form.alarm && (
            <div style={styles.alarmToneSection}>
              <label style={styles.fieldLabel}>Custom Alarm Tone</label>
              <div style={styles.alarmToneInfo}>
                <span style={{ fontSize: 12, color: "#666" }}>
                  📁 Supported: MP3, WAV, OGG, M4A, WebM (Max 5MB)
                </span>
              </div>
              <div style={styles.fileInputWrapper}>
                <input
                  type="file"
                  accept=".mp3,.wav,.ogg,.m4a,.webm,audio/*"
                  onChange={handleAudioUpload}
                  style={styles.fileInput}
                  id="alarmFileInput"
                />
                <label htmlFor="alarmFileInput" style={styles.fileInputLabel}>
                  📤 Choose Audio File
                </label>
              </div>
              {form.customAlarmTone && (
                <div style={styles.selectedTone}>
                  <div style={styles.selectedToneInfo}>
                    <span style={{ fontWeight: 500 }}>✓ Selected:</span>
                    <span style={{ marginLeft: 8, color: "#0066cc", fontSize: 14 }}>
                      {form.customAlarmTone.name}
                    </span>
                  </div>
                  <button
                    style={styles.removeToneBtn}
                    onClick={() => setForm((f) => ({ ...f, customAlarmTone: null }))}
                  >
                    ✕ Remove
                  </button>
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button
              style={styles.saveBtn}
              onClick={saveReminder}
            >
              {editId ? "Save Changes" : "Create Reminder"}
            </button>
            {editId && (
              <button
                style={styles.deleteBtn}
                onClick={() => deleteReminder(editId)}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── HOME ──
  return (
    <div style={styles.screen}>
      {/* Header */}
      <header style={styles.homeHeader}>
        <div>
          <div style={styles.appName}>Notify Me</div>
          <div style={styles.appSub}>Your smart reminder assistant</div>
        </div>
        <button style={styles.addBtn} onClick={() => openAdd()}>
          + New
        </button>
      </header>

      {/* Search */}
      <div style={styles.searchWrap}>
        <span style={styles.searchIcon}>🔍</span>
        <input
          style={styles.searchInput}
          placeholder="Search reminders..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Upcoming cards */}
      {upcoming.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Coming Up</div>
          <div style={styles.upcomingScroll}>
            {upcoming.map((r) => (
              <div key={r.id} style={styles.upcomingCard} onClick={() => openEdit(r)}>
                <div style={styles.upcomingIcon}>{r.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.upcomingCardTitle}>{r.title}</div>
                  <div style={styles.upcomingCardDate}>{formatDate(r.date)} · {r.time}</div>
                </div>
                <div style={styles.upcomingBadge}>{daysUntil(r.date)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick add chips */}
      <div style={styles.quickAddRow}>
        {REMINDER_TYPES.slice(1, 5).map((t) => (
          <button
            key={t.value}
            style={styles.quickChip}
            onClick={() => openAdd({ title: "", type: t.value, date: "", time: "", message: "", email: "", sendEmail: t.value !== "reminder", alarm: true, repeat: t.value === "birthday" || t.value === "anniversary" ? "yearly" : "never", icon: t.icon })}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {["upcoming", "all", "past"].map((tab) => (
          <button
            key={tab}
            style={{ ...styles.tab, ...(activeTab === tab ? styles.tabActive : {}) }}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Filter */}
      <div style={styles.filterRow}>
        {["all", ...REMINDER_TYPES.map((t) => t.value)].map((f) => (
          <button
            key={f}
            style={{ ...styles.filterChip, ...(filter === f ? styles.filterChipActive : {}) }}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : REMINDER_TYPES.find((t) => t.value === f)?.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={styles.list}>
        {filtered.length === 0 && (
          <div style={styles.empty}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔕</div>
            <div style={styles.emptyText}>No reminders here yet</div>
            <button style={styles.emptyAddBtn} onClick={() => openAdd()}>Add Reminder</button>
          </div>
        )}
        {filtered.map((r) => (
          <div key={r.id} style={{ ...styles.reminderCard, ...(r.status === "paused" ? styles.reminderPaused : {}) }}>
            <div style={styles.reminderLeft}>
              <div style={styles.reminderIcon}>{r.icon}</div>
              <div>
                <div style={styles.reminderTitle}>{r.title}</div>
                <div style={styles.reminderMeta}>
                  {formatDate(r.date)} · {r.time}
                  {r.repeat !== "never" && <span style={styles.repeatTag}>↺ {r.repeat}</span>}
                </div>
                {r.message && <div style={styles.reminderMsg} title={r.message}>{r.message.slice(0, 60)}{r.message.length > 60 ? "…" : ""}</div>}
                <div style={styles.reminderTags}>
                  {r.sendEmail && <span style={styles.tag}>📧 Email</span>}
                  {r.alarm && <span style={styles.tag}>🔔 Alarm</span>}
                  <span style={{ ...styles.tag, color: daysUntil(r.date) === "Today" ? "#e05a2b" : "inherit" }}>{daysUntil(r.date)}</span>
                </div>
              </div>
            </div>
            <div style={styles.reminderActions}>
              <button style={styles.iconBtn} onClick={() => toggleStatus(r.id)} title={r.status === "active" ? "Pause" : "Resume"}>
                {r.status === "active" ? "⏸" : "▶️"}
              </button>
              <button style={styles.iconBtn} onClick={() => openEdit(r)} title="Edit">✏️</button>
              <button style={styles.iconBtn} onClick={() => deleteReminder(r.id)} title="Delete">🗑️</button>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom nav */}
      <nav style={styles.bottomNav}>
        <button style={styles.navBtn} onClick={() => setView("home")}>🏠<span style={styles.navLabel}>Home</span></button>
        <button style={styles.navBtnAdd} onClick={() => openAdd()}>＋</button>
        <button style={styles.navBtn}>⚙️<span style={styles.navLabel}>Settings</span></button>
      </nav>
    </div>
  );
}

const C = {
  bg: "#0f0f13",
  surface: "#18181f",
  card: "#1e1e28",
  border: "rgba(255,255,255,0.07)",
  accent: "#7c6ff7",
  accentLight: "#a99ff9",
  text: "#f0effe",
  textMuted: "#8a88a8",
  success: "#3ecf8e",
  danger: "#f06560",
  warning: "#f5a623",
};

const styles = {
  screen: {
    minHeight: "100vh",
    background: C.bg,
    color: C.text,
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    maxWidth: 480,
    margin: "0 auto",
    paddingBottom: 80,
    position: "relative",
  },
  // Header
  homeHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "28px 20px 16px",
  },
  appName: { fontSize: 26, fontWeight: 700, letterSpacing: -0.5, color: C.accentLight },
  appSub: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  addBtn: {
    background: C.accent,
    color: "#fff",
    border: "none",
    borderRadius: 20,
    padding: "8px 18px",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  },
  // Search
  searchWrap: {
    display: "flex",
    alignItems: "center",
    background: C.surface,
    borderRadius: 14,
    margin: "0 20px 16px",
    padding: "10px 14px",
    border: `1px solid ${C.border}`,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: {
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    color: C.text,
    fontSize: 15,
  },
  // Section
  section: { paddingLeft: 20, paddingRight: 20, marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 },
  // Upcoming cards scroll
  upcomingScroll: { display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 },
  upcomingCard: {
    minWidth: 200,
    background: `linear-gradient(135deg, #2a265e 0%, #1e1e28 100%)`,
    borderRadius: 16,
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    cursor: "pointer",
    border: `1px solid rgba(124,111,247,0.25)`,
  },
  upcomingIcon: { fontSize: 28 },
  upcomingCardTitle: { fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 3 },
  upcomingCardDate: { fontSize: 12, color: C.textMuted },
  upcomingBadge: {
    background: "rgba(124,111,247,0.2)",
    color: C.accentLight,
    borderRadius: 10,
    padding: "3px 9px",
    fontSize: 11,
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  // Quick add
  quickAddRow: {
    display: "flex",
    gap: 8,
    padding: "12px 20px",
    overflowX: "auto",
  },
  quickChip: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    color: C.textMuted,
    borderRadius: 20,
    padding: "6px 14px",
    fontSize: 13,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  // Tabs
  tabs: { display: "flex", padding: "4px 20px 0", gap: 4 },
  tab: {
    background: "transparent",
    border: "none",
    color: C.textMuted,
    fontSize: 14,
    fontWeight: 500,
    padding: "8px 16px",
    borderRadius: 10,
    cursor: "pointer",
  },
  tabActive: {
    background: C.surface,
    color: C.text,
    border: `1px solid ${C.border}`,
  },
  // Filter
  filterRow: { display: "flex", gap: 6, padding: "10px 20px", overflowX: "auto" },
  filterChip: {
    background: "transparent",
    border: `1px solid ${C.border}`,
    color: C.textMuted,
    borderRadius: 16,
    padding: "4px 12px",
    fontSize: 12,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  filterChipActive: {
    background: C.accent,
    border: `1px solid ${C.accent}`,
    color: "#fff",
  },
  // List
  list: { padding: "8px 20px", display: "flex", flexDirection: "column", gap: 10 },
  reminderCard: {
    background: C.card,
    borderRadius: 16,
    padding: "14px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    border: `1px solid ${C.border}`,
    gap: 10,
  },
  reminderPaused: { opacity: 0.55 },
  reminderLeft: { display: "flex", gap: 12, flex: 1, minWidth: 0 },
  reminderIcon: { fontSize: 26, marginTop: 2 },
  reminderTitle: { fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 3 },
  reminderMeta: { fontSize: 12, color: C.textMuted, marginBottom: 4 },
  reminderMsg: { fontSize: 12, color: C.textMuted, marginBottom: 6, fontStyle: "italic" },
  reminderTags: { display: "flex", gap: 6, flexWrap: "wrap" },
  tag: {
    background: "rgba(255,255,255,0.05)",
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: "2px 8px",
    fontSize: 11,
    color: C.textMuted,
  },
  repeatTag: {
    background: "rgba(124,111,247,0.15)",
    color: C.accentLight,
    borderRadius: 10,
    padding: "1px 7px",
    fontSize: 11,
    marginLeft: 6,
  },
  reminderActions: { display: "flex", flexDirection: "column", gap: 4 },
  iconBtn: {
    background: "transparent",
    border: "none",
    fontSize: 16,
    cursor: "pointer",
    padding: "2px 4px",
  },
  // Empty state
  empty: { textAlign: "center", padding: "48px 0" },
  emptyText: { color: C.textMuted, fontSize: 15, marginBottom: 16 },
  emptyAddBtn: {
    background: C.accent,
    color: "#fff",
    border: "none",
    borderRadius: 20,
    padding: "10px 24px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  // Bottom nav
  bottomNav: {
    position: "fixed",
    bottom: 0,
    left: "50%",
    transform: "translateX(-50%)",
    width: "100%",
    maxWidth: 480,
    background: C.surface,
    borderTop: `1px solid ${C.border}`,
    display: "flex",
    justifyContent: "space-around",
    alignItems: "center",
    padding: "10px 0",
    zIndex: 100,
  },
  navBtn: {
    background: "transparent",
    border: "none",
    color: C.textMuted,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    fontSize: 22,
    gap: 2,
    padding: "4px 20px",
  },
  navLabel: { fontSize: 11, color: C.textMuted },
  navBtnAdd: {
    background: C.accent,
    color: "#fff",
    border: "none",
    borderRadius: "50%",
    width: 50,
    height: 50,
    fontSize: 26,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -20,
    boxShadow: `0 4px 20px rgba(124,111,247,0.5)`,
  },
  // Form screen
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 20px 16px",
    borderBottom: `1px solid ${C.border}`,
  },
  backBtn: {
    background: "transparent",
    border: "none",
    color: C.accentLight,
    fontSize: 20,
    cursor: "pointer",
  },
  headerTitle: { fontWeight: 600, fontSize: 17 },
  formBody: { padding: "20px 20px 32px", display: "flex", flexDirection: "column", gap: 12 },
  fieldLabel: { fontSize: 13, color: C.textMuted, fontWeight: 500 },
  input: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    color: C.text,
    fontSize: 15,
    padding: "11px 14px",
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
    fontFamily: "inherit",
  },
  typePicker: { display: "flex", gap: 8, flexWrap: "wrap" },
  typeBtn: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    color: C.textMuted,
    cursor: "pointer",
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    minWidth: 72,
  },
  typeBtnActive: {
    background: "rgba(124,111,247,0.2)",
    border: `1.5px solid ${C.accent}`,
    color: C.accentLight,
  },
  toggleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: "12px 16px",
  },
  toggleLabel: { fontSize: 15, fontWeight: 500 },
  toggleSub: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  toggle: {
    width: 44,
    height: 26,
    background: C.border,
    borderRadius: 13,
    position: "relative",
    cursor: "pointer",
    transition: "background 0.2s",
    flexShrink: 0,
  },
  toggleOn: { background: C.accent },
  toggleThumb: {
    position: "absolute",
    top: 3,
    left: 3,
    width: 20,
    height: 20,
    background: "#fff",
    borderRadius: "50%",
    transition: "left 0.2s",
  },
  toggleThumbOn: { left: 21 },
  saveBtn: {
    flex: 1,
    background: C.accent,
    border: "none",
    color: "#fff",
    borderRadius: 14,
    padding: "14px",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
  },
  deleteBtn: {
    background: "rgba(240,101,96,0.15)",
    border: `1px solid ${C.danger}`,
    color: C.danger,
    borderRadius: 14,
    padding: "14px 20px",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
  // Alarm overlay
  alarmOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.85)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  alarmCard: {
    background: C.card,
    borderRadius: 24,
    padding: 32,
    textAlign: "center",
    maxWidth: 320,
    border: `1px solid rgba(124,111,247,0.4)`,
  },
  alarmPulse: {
    fontSize: 56,
    marginBottom: 16,
    animation: "none",
  },
  alarmTitle: { fontSize: 22, fontWeight: 700, marginBottom: 10, color: C.text },
  alarmMsg: { fontSize: 15, color: C.textMuted, marginBottom: 24, lineHeight: 1.6 },
  alarmDismiss: {
    background: C.accent,
    color: "#fff",
    border: "none",
    borderRadius: 14,
    padding: "12px 36px",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
  },
  // Alarm Tone Styles
  alarmToneSection: {
    background: "rgba(124,111,247,0.08)",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    border: `1px solid ${C.border}`,
  },
  alarmToneInfo: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    marginTop: 8,
  },
  fileInputWrapper: {
    position: "relative",
    marginBottom: 12,
  },
  fileInput: {
    display: "none",
  },
  fileInputLabel: {
    display: "inline-block",
    background: C.accent,
    color: "#fff",
    padding: "10px 20px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    transition: "opacity 0.2s",
    width: "100%",
    textAlign: "center",
    boxSizing: "border-box",
    border: "none",
  },
  selectedTone: {
    background: "rgba(0,200,100,0.1)",
    border: `1px solid rgba(0,200,100,0.3)`,
    borderRadius: 8,
    padding: 12,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  selectedToneInfo: {
    display: "flex",
    alignItems: "center",
    fontSize: 13,
    color: C.text,
  },
  removeToneBtn: {
    background: "rgba(240,101,96,0.15)",
    border: `1px solid rgba(240,101,96,0.3)`,
    color: C.danger,
    borderRadius: 6,
    padding: "6px 12px",
    fontSize: 12,
    cursor: "pointer",
    fontWeight: 500,
    transition: "all 0.2s",
  },
};
