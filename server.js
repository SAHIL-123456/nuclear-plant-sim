const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const net = require('net');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.json());

// Basic state holder
let state = getInitialState();
let simulationRunning = false;
let matlabClient = null;

function getInitialState() {
  return {
    reactor: { temperature: 300, pressure: 155, controlRods: 80, fuelLevel: 100, status: 'stable' },
    generator: { powerOutput: 1000, voltage: 25000, frequency: 50, efficiency: 95, load: 70 },
    cooling: { primaryTemp: 290, secondaryTemp: 40, flowRate: 15000, pumpStatus: 'operational' },
    turbine: { speed: 1800, steamPressure: 70, vibration: 0.5, status: 'normal' },
    safety: { autoShutdown: true, emergencyCooling: false, radiationLevel: 0.1, alarms: [] },
    systemActive: { reactor: true, generator: true, cooling: true, turbine: true },
    offsets: {
      tempTarget: 300,
      pressureTarget: 155,
      frequencyTarget: 50,
      vibrationBase: 0.3
    },
    timestamp: Date.now(),
    history: []
  };
}

function startSimulation() {
  if (simulationRunning) return;
  simulationRunning = true;
  
  setInterval(() => {
    if (matlabClient) {
      // MATLAB is connected, skip internal physics. 
      // MATLAB will send state updates via TCP, which we broadcast directly.
      // But we still track history here to keep the graphs flowing.
      state.timestamp = Date.now();
      state.history.push({
        time: state.timestamp,
        temp: Math.round(state.reactor.temperature),
        power: Math.round(state.generator.powerOutput || 0),
        turbineSpeed: Math.round(state.turbine.speed || 0),
        pressure: Math.round(state.reactor.pressure),
        voltage: Math.round(state.generator.voltage || 0),
        frequency: Math.round(state.generator.frequency || 50),
        efficiency: Math.round(state.generator.efficiency || 0),
        coolingPrimary: Math.round(state.cooling.primaryTemp || 0),
        coolingSecondary: Math.round(state.cooling.secondaryTemp || 0),
        flowRate: Math.round(state.cooling.flowRate || 15000),
        vibration: Number(state.turbine.vibration || 0),
        radiation: Number(state.safety.radiationLevel || 0),
        load: Math.round(state.generator.load || 0)
      });
      if (state.history.length > 100) state.history.shift();
      broadcast(state);
      return;
    }

    let controlRodFactor = (100 - state.reactor.controlRods) / 100;
    
    // Reactor simulation
    if (!state.systemActive.reactor) {
      controlRodFactor = 0;
      if (state.reactor.temperature > 40) state.reactor.temperature -= 4; // Cool down if off
    } else {
      // Aim for tempTarget using control rods and offsets
      const targetDiff = state.offsets.tempTarget - state.reactor.temperature;
      state.reactor.temperature += (controlRodFactor * 5 - 2) + (targetDiff * 0.05) + (Math.random() - 0.5) * 2;
      state.reactor.fuelLevel = Math.max(0, state.reactor.fuelLevel - 0.001);
    }
    state.reactor.temperature = Math.max(25, Math.min(600, state.reactor.temperature));
    state.reactor.pressure = state.offsets.pressureTarget + (state.reactor.temperature - 300) * 0.5 + (Math.random() - 0.5);
    
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
      state.generator.frequency = state.offsets.frequencyTarget - (loadFactor * 0.5) + Math.random() * 0.5;
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
  if (data.offsets !== undefined) {
    state.offsets = { ...state.offsets, ...data.offsets };
  }
  if (data.reactorActive !== undefined) state.systemActive.reactor = data.reactorActive;
  if (data.generatorActive !== undefined) state.systemActive.generator = data.generatorActive;
  if (data.coolingActive !== undefined) state.systemActive.cooling = data.coolingActive;
  if (data.turbineActive !== undefined) state.systemActive.turbine = data.turbineActive;
  
  if (data.reset) {
    state = getInitialState();
    state.history = []; // Explicitly clear history
  }

  // Forward controls to MATLAB if connected
  if (matlabClient) {
    try {
      // ensure we only send a single line of JSON
      matlabClient.write(JSON.stringify(data) + '\n');
    } catch(e) {
      console.error('Error sending control to MATLAB:', e);
    }
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

// --- MATLAB TCP BRIDGE ---
const TCP_PORT = 3001;
const tcpServer = net.createServer((socket) => {
  console.log('MATLAB connected via TCP');
  matlabClient = socket;

  let buffer = '';
  socket.on('data', (data) => {
    buffer += data.toString();
    let parts = buffer.split('\n');
    buffer = parts.pop(); // Keep incomplete part in buffer
    
    for (let part of parts) {
      if (part.trim() === '') continue;
      try {
        const matlabData = JSON.parse(part);
        // Map MATLAB data to server state deep merge
        mergeState(state, matlabData);
      } catch (e) {
        console.error('Error parsing MATLAB data:', e.message);
      }
    }
  });

  socket.on('end', () => {
    console.log('MATLAB disconnected');
    matlabClient = null;
  });

  socket.on('error', (err) => {
    console.error('MATLAB socket error:', err);
    matlabClient = null;
  });
});

tcpServer.listen(TCP_PORT, () => {
  console.log(`MATLAB TCP Bridge listening on port ${TCP_PORT}`);
});

// Helper function to deep merge MATLAB state into JS state
function mergeState(target, source) {
  for (const key in source) {
    if (source[key] instanceof Object && !Array.isArray(source[key])) {
      if (!target[key]) Object.assign(target, { [key]: {} });
      mergeState(target[key], source[key]);
    } else {
      Object.assign(target, { [key]: source[key] });
    }
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Simulation server running locally at http://localhost:${PORT}`);
});
