/* ============================================================
   VELARIS — ROS2 Dashboard Controller
   ============================================================ */

'use strict';

/* ── State ─────────────────────────────────────────────── */
let ros           = null;
let isConnected   = false;
let cmdVelTopic   = null;
let alertsTopic   = null;
let currentMode   = 'manual';

let targetLinear  = 0.0;
let targetAngular = 0.0;
let currentLinear = 0.0;
let currentAngular= 0.0;
let isMoving      = false;

const MAX_LIN    = 0.5;
const MAX_ANG    = 0.5;
const ACCEL_LIN  = 0.4;
const ACCEL_ANG  = 1.0;
const DT         = 0.05;

/* ── DOM refs ───────────────────────────────────────────── */
const el = {
  websocketUrl:     document.getElementById('websocketUrl'),
  connectBtn:       document.getElementById('connectBtn'),
  disconnectBtn:    document.getElementById('disconnectBtn'),
  statusDot:        document.getElementById('statusDot'),
  statusText:       document.getElementById('statusText'),
  connectionStatus: document.getElementById('connectionStatus'),
  lastEvent:        document.getElementById('lastEvent'),
  currentTime:      document.getElementById('currentTime'),
  btnForward:       document.getElementById('btnForward'),
  btnBackward:      document.getElementById('btnBackward'),
  btnLeft:          document.getElementById('btnLeft'),
  btnRight:         document.getElementById('btnRight'),
  btnStop:          document.getElementById('btnStop'),
  lastCommand:      document.getElementById('lastCommand'),
  serviceStatus:    document.getElementById('serviceStatus'),
  svcStatusText:    document.getElementById('svcStatusText'),
  alertsList:       document.getElementById('alertsList'),
  alertsCount:      document.getElementById('alertsCount'),
  clearAlertsBtn:   document.getElementById('clearAlertsBtn'),
  modeToggle:       document.getElementById('modeToggle'),
  modeNameText:     document.getElementById('modeNameText'),
  modeDescText:     document.getElementById('modeDescText'),
  currentModeText:  document.getElementById('currentModeText'),
};

/* ── Clock ──────────────────────────────────────────────── */
function updateTime() {
  el.currentTime.textContent = new Date().toLocaleTimeString('es-ES', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}
setInterval(updateTime, 1000);
updateTime();

/* ── Connection status ──────────────────────────────────── */
function setConnectionStatus(label, eventLabel) {
  el.connectionStatus.textContent = label;
  el.statusText.textContent       = label;

  if (eventLabel) {
    el.lastEvent.textContent = `${eventLabel} — ${new Date().toLocaleTimeString('es-ES')}`;
  }

  el.statusDot.className = 'status-dot';
  if (label === 'Conectado')         el.statusDot.classList.add('connected');
  else if (label.includes('Error'))  el.statusDot.classList.add('error');
}

/* ── Control buttons enable/disable ────────────────────── */
function setControlsEnabled(enabled) {
  [el.btnForward, el.btnBackward, el.btnLeft, el.btnRight, el.btnStop]
    .forEach(b => { b.disabled = !enabled; });
}

/* ── Alerts ─────────────────────────────────────────────── */
let alertItemCount = 0;

function addAlert(message, severity) {
  severity = severity || 'info';

  const emptyEl = document.getElementById('alertsEmpty');
  if (emptyEl) emptyEl.style.display = 'none';

  const item = document.createElement('div');
  item.className = 'alert-item';
  if (severity === 'critical' || /error|fallo/i.test(message)) {
    item.classList.add('critical');
  }

  const timeStr = new Date().toLocaleTimeString('es-ES');
  item.innerHTML = '<div class="alert-time">' + timeStr + '</div>' +
                   '<div class="alert-message">' + message + '</div>';

  el.alertsList.insertBefore(item, el.alertsList.firstChild);
  alertItemCount++;
  el.alertsCount.textContent = alertItemCount;
}

function clearAlerts() {
  el.alertsList.innerHTML =
    '<div class="alerts-empty" id="alertsEmpty">' +
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
    '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>' +
    '</svg><p>Sin alertas activas</p></div>';
  alertItemCount = 0;
  el.alertsCount.textContent = 0;
}

/* ── ROS Connection ─────────────────────────────────────── */
function connectToROS() {
  var url = (el.websocketUrl.value || '').trim() || 'ws://127.0.0.1:9090/';
  ros = new ROSLIB.Ros({ url: url });

  ros.on('connection', function () {
    isConnected = true;
    setConnectionStatus('Conectado', 'Conexión establecida');
    el.connectBtn.disabled    = true;
    el.disconnectBtn.disabled = false;
    el.svcStatusText.textContent = 'ROS2 conectado. Inicializando tópicos...';

    cmdVelTopic = new ROSLIB.Topic({
      ros: ros, name: '/cmd_vel', messageType: 'geometry_msgs/msg/Twist'
    });

    alertsTopic = new ROSLIB.Topic({
      ros: ros, name: '/robot_alerts', messageType: 'std_msgs/msg/String'
    });
    alertsTopic.subscribe(function (msg) {
      var text = msg.data || JSON.stringify(msg);
      var sev  = /critical/i.test(text) ? 'critical' : 'info';
      addAlert(text, sev);
    });

    var initialPoseTopic = new ROSLIB.Topic({
      ros: ros, name: '/initialpose',
      messageType: 'geometry_msgs/msg/PoseWithCovarianceStamped'
    });

    setTimeout(function () {
      var poseMsg = new ROSLIB.Message({
        header: { frame_id: 'map', stamp: { sec: 0, nanosec: 0 } },
        pose: {
          pose: {
            position:    { x: 0.0, y: 0.0, z: 0.0 },
            orientation: { w: 1.0, x: 0.0, y: 0.0, z: 0.0 }
          },
          covariance: [
            0.25,0,0,0,0,0,
            0,0.25,0,0,0,0,
            0,0,0,0,0,0,
            0,0,0,0,0,0,
            0,0,0,0,0,0,
            0,0,0,0,0,0.068
          ]
        }
      });
      initialPoseTopic.publish(poseMsg);
      addAlert('Pose inicial enviada. Nav2 activado.', 'info');
      el.svcStatusText.textContent = 'Nav2 activado. Sistema listo.';
      if (currentMode === 'manual') setControlsEnabled(true);
    }, 1500);
  });

  ros.on('error', function (err) {
    console.error('ROS WebSocket error:', err);
    setConnectionStatus('Error de conexión', 'Fallo de WebSocket');
    el.svcStatusText.textContent = 'Error de conexión con rosbridge.';
    el.connectBtn.disabled    = false;
    el.disconnectBtn.disabled = true;
  });

  ros.on('close', function () {
    isConnected    = false;
    cmdVelTopic    = null;
    alertsTopic    = null;
    setConnectionStatus('Desconectado', 'Conexión cerrada');
    el.connectBtn.disabled    = false;
    el.disconnectBtn.disabled = true;
    setControlsEnabled(false);
    el.svcStatusText.textContent = 'Desconectado de ROS2.';
  });
}

function disconnectFromROS() {
  if (ros) {
    targetLinear = targetAngular = currentLinear = currentAngular = 0;
    ros.close();
    ros = null;
    setConnectionStatus('Desconectado', 'Desconexión manual');
  }
}

/* ── Physics / smoothing loop ───────────────────────────── */
function smoothStep(current, target, step) {
  if (current < target) return Math.min(current + step, target);
  if (current > target) return Math.max(current - step, target);
  return current;
}

setInterval(function () {
  if (!isConnected || !cmdVelTopic || currentMode !== 'manual') return;

  currentLinear  = smoothStep(currentLinear,  targetLinear,  ACCEL_LIN * DT);
  currentAngular = smoothStep(currentAngular, targetAngular, ACCEL_ANG * DT);

  var stillMoving = Math.abs(currentLinear) > 0.001 || Math.abs(currentAngular) > 0.001;

  if (stillMoving) {
    cmdVelTopic.publish(new ROSLIB.Message({
      linear:  { x: currentLinear,  y: 0, z: 0 },
      angular: { x: 0, y: 0, z: currentAngular }
    }));
    isMoving = true;
  } else if (isMoving) {
    currentLinear = currentAngular = 0;
    cmdVelTopic.publish(new ROSLIB.Message({
      linear: { x: 0, y: 0, z: 0 }, angular: { x: 0, y: 0, z: 0 }
    }));
    isMoving = false;
    el.serviceStatus.textContent = 'Detenido';
    el.svcStatusText.textContent = 'Robot detenido.';
  }
}, DT * 1000);

/* ── Hold-to-move buttons ───────────────────────────────── */
var dirMap = {
  forward:  { lin:  MAX_LIN, ang: 0 },
  backward: { lin: -MAX_LIN, ang: 0 },
  left:     { lin: 0, ang:  MAX_ANG },
  right:    { lin: 0, ang: -MAX_ANG }
};
var dirLabels = {
  forward: 'Adelante', backward: 'Atrás', left: 'Izquierda', right: 'Derecha'
};

function setupHoldButton(btnId, direction) {
  var btn = document.getElementById(btnId);
  var d   = dirMap[direction];
  var lbl = dirLabels[direction];

  function onStart(e) {
    e.preventDefault();
    if (!isConnected || currentMode !== 'manual') return;
    targetLinear  = d.lin;
    targetAngular = d.ang;
    el.lastCommand.textContent   = lbl;
    el.serviceStatus.textContent = 'Acelerando...';
    el.svcStatusText.textContent = 'Movimiento: ' + lbl;
  }

  function onStop(e) {
    e.preventDefault();
    if (currentMode !== 'manual') return;
    targetLinear = targetAngular = 0;
    if (isConnected) {
      el.serviceStatus.textContent = 'Frenando...';
      el.svcStatusText.textContent = 'Desacelerando...';
    }
  }

  btn.addEventListener('mousedown',  onStart);
  btn.addEventListener('mouseup',    onStop);
  btn.addEventListener('mouseleave', onStop);
  btn.addEventListener('touchstart', onStart, { passive: false });
  btn.addEventListener('touchend',   onStop,  { passive: false });
}

setupHoldButton('btnForward',  'forward');
setupHoldButton('btnBackward', 'backward');
setupHoldButton('btnLeft',     'left');
setupHoldButton('btnRight',    'right');

el.btnStop.addEventListener('click', function () {
  if (!isConnected || currentMode !== 'manual') return;
  targetLinear = targetAngular = currentLinear = currentAngular = 0;
  el.lastCommand.textContent   = 'STOP';
  el.serviceStatus.textContent = 'Freno de emergencia';
  el.svcStatusText.textContent = 'Freno de emergencia aplicado.';
});

/* ── Keyboard shortcuts ─────────────────────────────────── */
document.addEventListener('keydown', function (e) {
  if (e.repeat) return;

  if (e.code === 'KeyM') {
    el.modeToggle.checked = !el.modeToggle.checked;
    setOperationMode(el.modeToggle.checked ? 'auto' : 'manual');
    return;
  }

  if (!isConnected || currentMode !== 'manual') return;

  switch (e.code) {
    case 'ArrowUp':
    case 'KeyW':
      targetLinear = MAX_LIN; targetAngular = 0;
      el.lastCommand.textContent = 'Adelante (teclado)'; break;
    case 'ArrowDown':
    case 'KeyS':
      targetLinear = -MAX_LIN; targetAngular = 0;
      el.lastCommand.textContent = 'Atrás (teclado)'; break;
    case 'ArrowLeft':
    case 'KeyA':
      targetLinear = 0; targetAngular = MAX_ANG;
      el.lastCommand.textContent = 'Izquierda (teclado)'; break;
    case 'ArrowRight':
    case 'KeyD':
      targetLinear = 0; targetAngular = -MAX_ANG;
      el.lastCommand.textContent = 'Derecha (teclado)'; break;
    case 'Space':
      e.preventDefault();
      targetLinear = targetAngular = currentLinear = currentAngular = 0;
      el.lastCommand.textContent   = 'STOP (teclado)';
      el.serviceStatus.textContent = 'Freno de emergencia'; break;
  }
});

document.addEventListener('keyup', function (e) {
  var movKeys = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyS','KeyA','KeyD'];
  if (movKeys.indexOf(e.code) !== -1 && currentMode === 'manual') {
    targetLinear = targetAngular = 0;
  }
});

/* ── Mode switching ─────────────────────────────────────── */
function setOperationMode(mode) {
  currentMode = mode;

  if (mode === 'manual') {
    el.modeToggle.checked          = false;
    el.modeNameText.textContent    = 'Manual';
    el.modeDescText.textContent    = 'Control directo del operador';
    el.currentModeText.textContent = 'Manual';
    el.currentModeText.className   = 'mode-pill manual';
    setControlsEnabled(isConnected);
    targetLinear = targetAngular = 0;

  } else if (mode === 'auto') {
    el.modeToggle.checked          = true;
    el.modeNameText.textContent    = 'Automático';
    el.modeDescText.textContent    = 'Patrulla autónoma Nav2 activa';
    el.currentModeText.textContent = 'Automático';
    el.currentModeText.className   = 'mode-pill auto';
    setControlsEnabled(false);
    iniciarPatrulla();
  }
}

function iniciarPatrulla() {
  if (!isConnected) {
    addAlert('Conecta con ROS2 antes de activar el modo automático.', 'critical');
    el.modeToggle.checked = false;
    setOperationMode('manual');
    return;
  }

  addAlert('Iniciando patrulla autónoma...', 'info');
  el.svcStatusText.textContent = 'Enviando ruta a Nav2...';

  var patrolSrv = new ROSLIB.Service({
    ros: ros, name: '/start_patrol', serviceType: 'std_srvs/srv/Trigger'
  });

  patrolSrv.callService(new ROSLIB.ServiceRequest({}), function (result) {
    if (result && result.success) {
      el.serviceStatus.textContent = 'Patrullando';
      el.svcStatusText.textContent = 'Patrulla autónoma activa.';
      addAlert('Patrulla iniciada correctamente.', 'info');
    } else {
      var msg = (result && result.message) ? result.message : 'Sin respuesta';
      el.serviceStatus.textContent = 'Error Nav2';
      el.svcStatusText.textContent = 'Fallo al iniciar patrulla: ' + msg;
      addAlert('Error al iniciar patrulla: ' + msg, 'critical');
    }
  });
}

/* ── Event listeners ────────────────────────────────────── */
el.connectBtn.addEventListener('click', connectToROS);
el.disconnectBtn.addEventListener('click', disconnectFromROS);
el.clearAlertsBtn.addEventListener('click', clearAlerts);
el.modeToggle.addEventListener('change', function (e) {
  setOperationMode(e.target.checked ? 'auto' : 'manual');
});

/* ── Init ───────────────────────────────────────────────── */
setOperationMode('manual');
setControlsEnabled(false);
