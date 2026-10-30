-- سفرية ديزرت — قاعدة البيانات (Cloudflare D1 / SQLite)
-- التشغيل: npx wrangler d1 execute safarya --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,              -- JSON بنفس شكل shared/catalog.js
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- استثناءات التواريخ: قفل يوم أو تغيير عدد المقاعد
CREATE TABLE IF NOT EXISTS departures (
  trip_id TEXT NOT NULL,
  date TEXT NOT NULL,
  seats INTEGER,                   -- NULL = العدد الافتراضي للرحلة
  closed INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  PRIMARY KEY (trip_id, date)
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref TEXT NOT NULL UNIQUE,
  trip_id TEXT NOT NULL,
  trip_title TEXT NOT NULL,
  date TEXT NOT NULL,
  adults INTEGER NOT NULL,
  kids_small INTEGER NOT NULL DEFAULT 0,
  kids INTEGER NOT NULL DEFAULT 0,
  infants INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL,
  stay TEXT NOT NULL,
  currency TEXT NOT NULL,
  total INTEGER,                   -- NULL لطلبات عرض السعر
  deposit INTEGER,
  seats INTEGER NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL,            -- pending | confirmed | cancelled | completed | quote
  source TEXT NOT NULL,            -- web | chat | whatsapp | admin
  idem_key TEXT UNIQUE,
  expires_at TEXT,                 -- نهاية حجز المكان المبدئي (ISO)
  refund_due INTEGER,
  admin_note TEXT,
  notify_status TEXT,
  conv_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bookings_trip_date ON bookings(trip_id, date, status);
CREATE INDEX IF NOT EXISTS idx_bookings_phone ON bookings(phone);
CREATE INDEX IF NOT EXISTS idx_bookings_created ON bookings(created_at);

CREATE TABLE IF NOT EXISTS booking_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,             -- customer | agent | admin | system
  action TEXT NOT NULL,
  detail TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_booking ON booking_events(booking_id);

CREATE TABLE IF NOT EXISTS faq (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  q TEXT NOT NULL,
  a TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,           -- web | whatsapp
  external_id TEXT,                -- رقم الواتساب للعميل
  status TEXT NOT NULL DEFAULT 'bot', -- bot | human | closed
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_user_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_conv_external ON conversations(channel, external_id);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conv_id TEXT NOT NULL,
  role TEXT NOT NULL,              -- user | model | tool | staff
  text TEXT,                       -- النص المقروء (للوحة الإدارة)
  content TEXT,                    -- محتوى Gemini الكامل (JSON) لاستكمال المحادثة
  at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conv_id, id);

CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  conv_id TEXT NOT NULL,
  trip_id TEXT NOT NULL,
  date TEXT NOT NULL,
  party TEXT NOT NULL,
  quote TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS handoffs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conv_id TEXT,
  kind TEXT NOT NULL,              -- agent | contact
  name TEXT,
  phone TEXT,
  reason TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS wa_seen (
  msg_id TEXT PRIMARY KEY,
  at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate (
  k TEXT PRIMARY KEY,
  n INTEGER NOT NULL,
  reset INTEGER NOT NULL
);
