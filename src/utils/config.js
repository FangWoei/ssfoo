// src/utils/config.js
// App-wide tunable settings.

// Low-stock alert threshold (#2). Products with stock at or below this
// number show up in the dashboard low-stock alert. Change freely.
export const LOW_STOCK_THRESHOLD = 12;

// Auto-refresh interval options (#1), in seconds. 0 = off.
export const REFRESH_INTERVALS = [
  { label: "Off", value: 0 },
  { label: "15s", value: 15 },
  { label: "30s", value: 30 },
  { label: "1m", value: 60 },
  { label: "5m", value: 300 },
  { label: "15m", value: 900 },
  { label: "30m", value: 1800 },
];
