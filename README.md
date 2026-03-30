# ⚛️ Nuclear Power Plant IoT Simulation - Cloudflare

100% cloud-based nuclear plant simulation with real-time monitoring and control.

## 🚀 Deploy (3 Steps)

### 1. Create D1 Database
```bash
wrangler d1 create nuclear_plant_db
```
Copy the `database_id` and update `wrangler.toml`

### 2. Initialize Database
```bash
wrangler d1 execute nuclear_plant_db --file=schema.sql
```

### 3. Deploy
```bash
wrangler deploy
```

Live at: `https://nuclear-plant-sim.YOUR-SUBDOMAIN.workers.dev`

## 📦 Stack

- **Cloudflare Workers** - Edge compute
- **Durable Objects** - Real-time state + WebSocket
- **D1 Database** - Historical data storage

## 🎯 Features

- Real-time reactor simulation
- Live WebSocket updates
- Interactive control panel
- Historical data storage
- Live graphs and charts
- Auto safety systems

## 💰 Cost

FREE (Cloudflare free tier)

## 📡 API

- `GET /` - Dashboard
- `GET /api/state` - Current state
- `POST /api/control` - Control plant
- `GET /api/history` - Historical data
- `WS /ws` - Real-time updates
