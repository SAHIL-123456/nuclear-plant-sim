CREATE TABLE IF NOT EXISTS plant_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  reactor_temp REAL NOT NULL,
  reactor_pressure REAL NOT NULL,
  power_output INTEGER NOT NULL,
  turbine_speed INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_timestamp ON plant_history(timestamp DESC);

CREATE TABLE IF NOT EXISTS plant_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  event_data TEXT NOT NULL
);
