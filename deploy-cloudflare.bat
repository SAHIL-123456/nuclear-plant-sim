@echo off
echo ========================================
echo Nuclear Plant - Full Cloudflare Deploy
echo ========================================
echo.

echo [1/5] Installing Wrangler...
call npm install -g wrangler
echo.

echo [2/5] Login to Cloudflare...
call wrangler login
echo.

echo [3/5] Creating D1 Database...
echo Running: wrangler d1 create nuclear_plant_db
call wrangler d1 create nuclear_plant_db > db_output.txt
echo.
echo IMPORTANT: Copy the database_id from above and update wrangler.toml
echo Press any key after updating wrangler.toml...
pause
echo.

echo [4/5] Creating Database Tables...
call wrangler d1 execute nuclear_plant_db --file=schema.sql
echo.

echo [5/5] Deploying to Cloudflare Workers...
call wrangler deploy
echo.

echo ========================================
echo Deployment Complete!
echo ========================================
echo.
echo Your Nuclear Plant Simulation is LIVE!
echo Access it at the URL shown above.
echo.
echo The app runs 100%% on Cloudflare:
echo - Workers: Edge compute
echo - Durable Objects: Real-time state
echo - D1 Database: Historical data
echo.
pause
