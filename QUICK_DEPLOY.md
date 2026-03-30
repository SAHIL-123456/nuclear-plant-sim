# 🚀 Quick Deploy Guide

## Deploy Now (No Database Setup Required)

```bash
wrangler deploy
```

That's it! Your nuclear plant simulation is live.

## What You Get

✅ Real-time simulation with Durable Objects
✅ WebSocket live updates
✅ Interactive control panel
✅ Live graphs (last 100 data points in memory)
✅ Ultra-realistic UI with animations

## Access Your App

After deployment, you'll get a URL like:
```
https://nuclear-plant-sim.YOUR-SUBDOMAIN.workers.dev
```

## Optional: Add D1 Database for Long-Term History

If you want to store historical data permanently:

1. Create database:
```bash
wrangler d1 create nuclear_plant_db
```

2. Copy the database_id and add to wrangler.toml:
```toml
[[d1_databases]]
binding = "DB"
database_name = "nuclear_plant_db"
database_id = "your-actual-database-id"
```

3. Initialize schema:
```bash
wrangler d1 execute nuclear_plant_db --file=schema.sql
```

4. Redeploy:
```bash
wrangler deploy
```

## Current Storage

- Durable Objects: Stores last 100 data points
- Real-time state: Persists across requests
- No database needed for basic operation

## Free Tier

✅ 100% FREE on Cloudflare
- 100K requests/day
- Unlimited Durable Objects storage (up to 1GB)
- Global edge deployment
