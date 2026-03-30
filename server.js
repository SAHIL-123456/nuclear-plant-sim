const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.json());

// Basic state holder
let state = getInitialState();
let simulationRunning = false;

function getInitialState() {
  return {
    reactor: { temperature: 300, pressure: 155, controlRods: 80, fuelLevel: 100, status: 'stable' },
    generator: { powerOutput: 1000, voltage: 25000, frequency: 50, efficiency: 95, load: 70 },
    cooling: { primaryTemp: 290, secondaryTemp: 40, flowRate: 15000, pumpStatus: 'operational' },
    turbine: { speed: 1800, steamPressure: 70, vibration: 0.5, status: 'normal' },
    safety: { autoShutdown: true, emergencyCooling: false, radiationLevel: 0.1, alarms: [] },
    systemActive: { reactor: true, generator: true, cooling: true, turbine: true },
    timestamp: Date.now(),
    history: []
  };
}

function startSimulation() {
  if (simulationRunning) return;
  simulationRunning = true;
  
  setInterval(() => {
    let controlRodFactor = (100 - state.reactor.controlRods) / 100;
    
    // Reactor simulation
    if (!state.systemActive.reactor) {
      controlRodFactor = 0;
      if (state.reactor.temperature > 250) state.reactor.temperature -= 4; // Cool down if off
    } else {
      state.reactor.temperature += (controlRodFactor * 5 - 2) + (Math.random() - 0.5) * 2;
      state.reactor.fuelLevel = Math.max(0, state.reactor.fuelLevel - 0.001);
    }
    state.reactor.temperature = Math.max(250, Math.min(600, state.reactor.temperature));
    state.reactor.pressure = 150 + (state.reactor.temperature - 300) * 0.5;
    
    // Turbine
    let steamFactor = state.reactor.pressure / 155;
    if (!state.systemActive.turbine) {
      steamFactor = 0;
      state.turbine.speed = Math.floor(state.turbine.speed * 0.90); // Spool down
    } else {
      state.turbine.speed = Math.floor(1500 + steamFactor * 300);
    }
    state.turbine.steamPressure = 60 + (state.reactor.temperature - 300) * 0.2;
    state.turbine.vibration = state.systemActive.turbine ? (0.3 + Math.random() * 0.4 + (state.turbine.speed > 1900 ? 0.5 : 0)) : 0;
    
    // Generator simulation
    const tempFactor = Math.min(1, Math.max(0, (state.reactor.temperature - 250) / 200));
    let loadFactor = state.generator.load / 100;
    if (!state.systemActive.generator) {
      loadFactor = 0;
      state.generator.frequency = Math.max(0, state.generator.frequency * 0.9);
      state.generator.powerOutput = 0;
      state.generator.voltage = 0;
      state.generator.efficiency = 0;
    } else {
      state.generator.powerOutput = Math.round(tempFactor * state.turbine.speed * 0.6 * loadFactor);
      state.generator.voltage = 24000 + state.generator.powerOutput * 2;
      state.generator.frequency = 50 - (loadFactor * 0.5) + Math.random() * 0.5;
      state.generator.efficiency = Math.min(98, 85 + tempFactor * 10 - (Math.abs(loadFactor - 0.8) * 5));
    }
    
    // Cooling system
    let coolingEfficiency = state.cooling.flowRate / 15000;
    if (!state.systemActive.cooling) {
      coolingEfficiency = 0.01; // Avoid divide by zero, essentially no cooling
      state.cooling.pumpStatus = 'OFF';
      // Without cooling, primary temp shoots up
      state.reactor.temperature += 15; // Rapidly heat up if cooling is off
    } else {
      state.cooling.pumpStatus = 'OPERATIONAL';
    }
    state.cooling.primaryTemp = state.reactor.temperature - 10;
    state.cooling.secondaryTemp = 30 + (state.cooling.primaryTemp - 280) * 0.1 / coolingEfficiency;
    
    // Safety checks
    state.safety.radiationLevel = 0.05 + Math.max(0, state.reactor.temperature - 300) * 0.001;
    state.safety.alarms = [];
    
    if (state.reactor.temperature > 500) {
      state.safety.alarms.push('HIGH_TEMPERATURE');
      state.reactor.status = 'warning';
    } else if (state.reactor.temperature > 550) {
      state.safety.alarms.push('CRITICAL_TEMPERATURE');
      state.reactor.status = 'critical';
    } else {
      state.reactor.status = 'stable';
    }
    
    if (state.turbine.vibration > 1.0) {
      state.safety.alarms.push('HIGH_VIBRATION');
      state.turbine.status = 'warning';
    } else {
      state.turbine.status = 'normal';
    }
    
    if (state.safety.radiationLevel > 0.5) {
      state.safety.alarms.push('RADIATION_LEAK');
    }
    
    // Auto safety shutdown
    if (state.safety.autoShutdown && state.reactor.temperature > 550) {
      state.reactor.controlRods = 100;
      state.safety.emergencyCooling = true;
      state.cooling.flowRate = 20000;
      state.safety.alarms.push('AUTO_SHUTDOWN_ACTIVATED');
    }
    
    if (state.safety.emergencyCooling) {
      state.reactor.temperature -= 5;
    }
    
    state.timestamp = Date.now();
    
    // Store history (last 100 points)
    state.history.push({
      time: state.timestamp,
      temp: Math.round(state.reactor.temperature),
      power: state.generator.powerOutput,
      turbineSpeed: state.turbine.speed,
      pressure: Math.round(state.reactor.pressure),
      voltage: state.generator.voltage,
      frequency: state.generator.frequency,
      efficiency: state.generator.efficiency,
      coolingPrimary: state.cooling.primaryTemp,
      coolingSecondary: state.cooling.secondaryTemp,
      flowRate: state.cooling.flowRate,
      vibration: state.turbine.vibration,
      radiation: state.safety.radiationLevel,
      load: state.generator.load
    });
    if (state.history.length > 100) state.history.shift();
    
    broadcast(state);
  }, 1000);
}

function handleControl(data) {
  if (data.controlRods !== undefined) {
    state.reactor.controlRods = Math.max(0, Math.min(100, data.controlRods));
  }
  if (data.flowRate !== undefined) {
    state.cooling.flowRate = Math.max(5000, Math.min(25000, data.flowRate));
  }
  if (data.generatorLoad !== undefined) {
    state.generator.load = Math.max(0, Math.min(100, data.generatorLoad));
  }
  if (data.autoShutdown !== undefined) {
    state.safety.autoShutdown = data.autoShutdown;
  }
  if (data.emergencyCooling !== undefined) {
    state.safety.emergencyCooling = data.emergencyCooling;
  }
  if (data.reactorActive !== undefined) state.systemActive.reactor = data.reactorActive;
  if (data.generatorActive !== undefined) state.systemActive.generator = data.generatorActive;
  if (data.coolingActive !== undefined) state.systemActive.cooling = data.coolingActive;
  if (data.turbineActive !== undefined) state.systemActive.turbine = data.turbineActive;
  
  if (data.reset) {
    state = getInitialState();
  }
  broadcast(state);
}

function broadcast(st) {
  const message = JSON.stringify(st);
  for (const client of wss.clients) {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  }
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify(state));
  
  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      handleControl(data);
    } catch (e) {}
  });
});

app.get('/api/state', (req, res) => {
  res.json(state);
});

app.post('/api/control', (req, res) => {
  handleControl(req.body);
  res.json({ success: true });
});

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

startSimulation();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Simulation server running locally at http://localhost:${PORT}`);
});
