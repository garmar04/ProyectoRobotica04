/* ============================================================
   VELARIS — ROS2 Dashboard Controller
   ============================================================ */

'use strict';

/* ── State ─────────────────────────────────────────────── */
let ros = null;
let isConnected = false;
let cmdVelTopic = null;
let alertsTopic = null;
let mapTopic = null;
let odomTopic = null;
let currentMode = 'manual';

let targetLinear = 0.0;
let targetAngular = 0.0;
let currentLinear = 0.0;
let currentAngular = 0.0;
let isMoving = false;
let currentMapData = null;
let currentRobotPos = { x: 0, y: 0 };

const MAX_LIN = 0.5;
const MAX_ANG = 0.5;
const ACCEL_LIN = 0.4;
const ACCEL_ANG = 1.0;
const DT = 0.05;

/* ── DOM refs (con protección) ───────────────────────────────── */
const el = {
  websocketUrl: document.getElementById('websocketUrl'),
  connectBtn: document.getElementById('connectBtn'),
  disconnectBtn: document.getElementById('disconnectBtn'),
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  connectionStatus: document.getElementById('connectionStatus'),
  lastEvent: document.getElementById('lastEvent'),
  currentTime: document.getElementById('currentTime'),
  btnForward: document.getElementById('btnForward'),
  btnBackward: document.getElementById('btnBackward'),
  btnLeft: document.getElementById('btnLeft'),
  btnRight: document.getElementById('btnRight'),
  btnStop: document.getElementById('btnStop'),
  lastCommand: document.getElementById('lastCommand'),
  serviceStatus: document.getElementById('serviceStatus'),
  svcStatusText: document.getElementById('svcStatusText'),
  alertsList: document.getElementById('alertsList'),
  alertsCount: document.getElementById('alertsCount'),
  clearAlertsBtn: document.getElementById('clearAlertsBtn'),
  modeToggle: document.getElementById('modeToggle'),
  modeNameText: document.getElementById('modeNameText'),
  modeDescText: document.getElementById('modeDescText'),
  currentModeText: document.getElementById('currentModeText'),
};

function safeSetText(el, text) {
  if (el && el.textContent !== undefined) el.textContent = text;
}

/* ── Clock ──────────────────────────────────────────────── */
function updateTime() {
  safeSetText(el.currentTime, new Date().toLocaleTimeString('es-ES', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }));
}
setInterval(updateTime, 1000);
updateTime();

/* ── Connection status ──────────────────────────────────── */
function setConnectionStatus(label, eventLabel) {
  safeSetText(el.connectionStatus, label);
  safeSetText(el.statusText, label);

  if (eventLabel) {
    safeSetText(el.lastEvent, `${eventLabel} — ${new Date().toLocaleTimeString('es-ES')}`);
  }

  el.statusDot.className = 'status-dot';
  if (label === 'Conectado') el.statusDot.classList.add('connected');
  else if (label.includes('Error')) el.statusDot.classList.add('error');
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
  safeSetText(el.alertsCount, alertItemCount);
}

function clearAlerts() {
  el.alertsList.innerHTML =
    '<div class="alerts-empty" id="alertsEmpty">' +
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
    '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>' +
    '</svg><p>Sin alertas activas</p></div>';
  alertItemCount = 0;
  safeSetText(el.alertsCount, 0);
}

/* ── ROS Connection ─────────────────────────────────────── */
function connectToROS() {
  var url = (el.websocketUrl.value || '').trim() || 'ws://127.0.0.1:9090/';
  ros = new ROSLIB.Ros({ url: url });

  ros.on('connection', function () {
    isConnected = true;
    setConnectionStatus('Conectado', 'Conexión establecida');
    el.connectBtn.disabled = true;
    el.disconnectBtn.disabled = false;
    safeSetText(el.svcStatusText, 'ROS2 conectado. Inicializando tópicos...');

    cmdVelTopic = new ROSLIB.Topic({
      ros: ros, name: '/cmd_vel', messageType: 'geometry_msgs/msg/Twist'
    });

    alertsTopic = new ROSLIB.Topic({
      ros: ros, name: '/robot_alerts', messageType: 'std_msgs/msg/String'
    });
    alertsTopic.subscribe(function (msg) {
      var text = msg.data || JSON.stringify(msg);
      var sev = /critical/i.test(text) ? 'critical' : 'info';
      addAlert(text, sev);
    });

    var canvasMap = document.getElementById("map");

    // 1. Crear el Viewer primero para que el stage exista antes de añadir el marcador
    if (!window.mapViewer) {
      window.mapViewer = new ROS2D.Viewer({
        divID: 'mapViewer',
        width: 600,
        height: 400,
        background: '#f0f0f0'
      });
    }

    // Resolver el EaselJS Stage sea cual sea la propiedad que use esta versión de ros2d.
    // ros2d@0.10.0 puede exponerlo como .scene, .stage, o no exponerlo directamente;
    // en ese último caso lo recuperamos del canvas que ros2d inserta en el div.
    if (!window.mapScene) {
      var resolvedScene = window.mapViewer.scene || window.mapViewer.stage || null;
      if (!resolvedScene) {
        var ros2dCanvas = document.querySelector('#mapViewer canvas:not(#map)');
        if (ros2dCanvas) {
          resolvedScene = new createjs.Stage(ros2dCanvas);
        }
      }
      window.mapScene = resolvedScene;
    }

    if (!window.mapScene) {
      console.error('No se pudo resolver el EaselJS Stage de ros2d. El marcador no se mostrara.');
    }

    // 2. Crear el marcador gráfico (una flecha verde) y añadirlo al stage
    window.robotMarker = new ROS2D.NavigationArrow({
      size: 0.35,
      strokeSize: 0.1,
      fillColor: createjs.Graphics.getRGB(0, 255, 0, 0.8),
      pulse: false
    });
    window.robotMarker.visible = false;

    if (window.mapScene) {
      window.mapScene.addChild(window.robotMarker);
    }

    // 3. Suscribirse a la Odometría (/odom)
    odomTopic = new ROSLIB.Topic({
      ros: ros,
      name: '/odom',
      messageType: 'nav_msgs/msg/Odometry'
    });

    odomTopic.subscribe(function (msg) {
      var pose = msg.pose.pose.position;
      var orientation = msg.pose.pose.orientation;

      // Calcular yaw desde el quaternion
      var siny_cosp = 2 * (orientation.w * orientation.z + orientation.x * orientation.y);
      var cosy_cosp = 1 - 2 * (orientation.y * orientation.y + orientation.z * orientation.z);
      var theta = Math.atan2(siny_cosp, cosy_cosp);

      currentRobotPos.x = pose.x;
      currentRobotPos.y = pose.y;
      currentRobotPos.theta = theta;

      // Actualizar el marcador en el canvas del mapa usando el ImageData cacheado.
      // El mapa ya fue volteado verticalmente al cachearlo, asi que la formula
      // de coordenadas es la estandar ROS->canvas (Y invertido respecto al mundo ROS).
      var fallbackCanvas = document.getElementById('map');
      if (fallbackCanvas && window.mapImageData && window.lastMapMsg) {
        try {
          var info   = window.lastMapMsg.info;
          var ctx    = fallbackCanvas.getContext('2d');
          var origin = info.origin.position;
          var res    = info.resolution;
          var mapH   = info.height;

          // 1. Restaurar la imagen del mapa sin marcador
          ctx.putImageData(window.mapImageData, 0, 0);

          // 2. Convertir coordenadas ROS (metros) -> pixeles del canvas corregido.
          //    Como el ImageData fue volteado verticalmente, el eje Y ya es correcto:
          //    Y ROS crece hacia arriba, canvas crece hacia abajo -> inversion estandar.
          var px = (pose.x - origin.x) / res;
          var py = mapH - (pose.y - origin.y) / res;

          // 3. Dibujar el circulo verde del robot
          ctx.beginPath();
          ctx.fillStyle = 'green';
          ctx.arc(px, py, 5, 0, 2 * Math.PI);
          ctx.fill();
        } catch (err) {
          console.error('Error actualizando marcador del robot:', err);
        }
      }
    });

    var gridClient = new ROS2D.OccupancyGridClient({
      ros: ros,
      rootObject: window.mapScene || window.mapViewer.scene,
      continuous: true
    });

    // Exponer cliente y ocultar placeholder cuando llegue el mapa
    try {
      window.gridClient = gridClient;
      gridClient.on('change', function () {
        console.log('OccupancyGridClient: mapa recibido', gridClient.currentGrid);
        var ph = document.getElementById('mapPlaceholder');
        if (ph) ph.style.display = 'none';
        var cvViewer = document.querySelector('#mapViewer canvas');
        if (cvViewer) cvViewer.style.display = 'block';
        if (canvasMap) canvasMap.style.display = 'none';
      });
    } catch (e) {
      console.warn('No se pudo registrar change handler en gridClient', e);
    }

    // Fallback: suscribirse manualmente a /map (prueba ROS2 y ROS1 naming)
    (function trySubscribeMap(typeIndex) {
      var types = ['nav_msgs/msg/OccupancyGrid', 'nav_msgs/OccupancyGrid'];
      var type = types[typeIndex] || types[0];
      try {
        var mapSub = new ROSLIB.Topic({ ros: ros, name: '/map', messageType: type, compression: 'png' });
        mapSub.subscribe(function (msg) {
          try {
            console.log('Fallback /map message received (type=' + type + ')', msg);
            window.lastMapMsg = msg;
            var canvas = document.getElementById('map');
            if (canvas) {
              canvas.style.display = 'block';
              var ph = document.getElementById('mapPlaceholder');
              if (ph) ph.style.display = 'none';
              try {
                // 1. Dibujar el mapa SIN robot. draw_occupancy_grid coloca data[0]
                //    (esquina inferior-izquierda en ROS) en canvas (0,0) = esquina
                //    superior-izquierda, por lo que el mapa queda invertido en Y.
                draw_occupancy_grid(canvas, msg, null);
                var ctx = canvas.getContext('2d');

                // 2. Voltear el ImageData verticalmente para corregir la orientacion.
                //    Asi el norte del mapa queda arriba y las coordenadas ROS->canvas
                //    siguen la conversion estandar (Y_canvas = mapH - Y_ros/res).
                var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                var w = imgData.width, h = imgData.height;
                var rowBytes = w * 4;
                var tmp = new Uint8ClampedArray(rowBytes);
                var d = imgData.data;
                for (var row = 0; row < Math.floor(h / 2); row++) {
                  var top    = row * rowBytes;
                  var bottom = (h - 1 - row) * rowBytes;
                  tmp.set(d.subarray(top, top + rowBytes));
                  d.copyWithin(top, bottom, bottom + rowBytes);
                  d.set(tmp, bottom);
                }
                ctx.putImageData(imgData, 0, 0);

                // 3. Guardar el mapa volteado como cache (sin robot)
                window.mapImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                // 4. Dibujar el robot encima si ya tenemos posicion
                if (currentRobotPos.x !== 0 || currentRobotPos.y !== 0) {
                  var info   = msg.info;
                  var origin = info.origin.position;
                  var res    = info.resolution;
                  var mapH   = info.height;
                  var px = (currentRobotPos.x - origin.x) / res;
                  var py = mapH - (currentRobotPos.y - origin.y) / res;
                  ctx.beginPath();
                  ctx.fillStyle = 'green';
                  ctx.arc(px, py, 5, 0, 2 * Math.PI);
                  ctx.fill();
                }
              } catch (err) {
                console.error('draw_occupancy_grid error', err);
              }
            }
          } catch (err2) {
            console.error('Error procesando /map:', err2);
          }
        });
      } catch (e) {
        console.warn('No se pudo subscribir a /map con tipo', type, e);
        if (typeIndex + 1 < 2) trySubscribeMap(typeIndex + 1);
      }
    })(0);

    setTimeout(function () {
      addAlert('Panel conectado. Nav2 listo.', 'info');
      safeSetText(el.svcStatusText, 'Sistema listo.');
      if (currentMode === 'manual') setControlsEnabled(true);
    }, 1500);
  });

  ros.on('error', function (err) {
    console.error('ROS WebSocket error:', err);
    setConnectionStatus('Error de conexión', 'Fallo de WebSocket');
    safeSetText(el.svcStatusText, 'Error de conexión con rosbridge.');
    el.connectBtn.disabled = false;
    el.disconnectBtn.disabled = true;
  });

  ros.on('close', function () {
    isConnected = false;
    cmdVelTopic = null;
    alertsTopic = null;
    mapTopic = null;
    odomTopic = null;
    currentMapData = null;
    window.mapScene = null;
    window.lastMapMsg = null;
    window.mapImageData = null;
    setConnectionStatus('Desconectado', 'Conexión cerrada');
    el.connectBtn.disabled = false;
    el.disconnectBtn.disabled = true;
    setControlsEnabled(false);
    safeSetText(el.svcStatusText, 'Desconectado de ROS2.');
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

  currentLinear = smoothStep(currentLinear, targetLinear, ACCEL_LIN * DT);
  currentAngular = smoothStep(currentAngular, targetAngular, ACCEL_ANG * DT);

  var stillMoving = Math.abs(currentLinear) > 0.001 || Math.abs(currentAngular) > 0.001;

  if (stillMoving) {
    cmdVelTopic.publish(new ROSLIB.Message({
      linear: { x: currentLinear, y: 0, z: 0 },
      angular: { x: 0, y: 0, z: currentAngular }
    }));
    isMoving = true;
  } else if (isMoving) {
    currentLinear = currentAngular = 0;
    cmdVelTopic.publish(new ROSLIB.Message({
      linear: { x: 0, y: 0, z: 0 }, angular: { x: 0, y: 0, z: 0 }
    }));
    isMoving = false;
    safeSetText(el.serviceStatus, 'Detenido');
    safeSetText(el.svcStatusText, 'Robot detenido.');
  }
}, DT * 1000);

/* ── Hold-to-move buttons ───────────────────────────────── */
var dirMap = {
  forward: { lin: MAX_LIN, ang: 0 },
  backward: { lin: -MAX_LIN, ang: 0 },
  left: { lin: 0, ang: MAX_ANG },
  right: { lin: 0, ang: -MAX_ANG }
};
var dirLabels = {
  forward: 'Adelante', backward: 'Atrás', left: 'Izquierda', right: 'Derecha'
};

function setupHoldButton(btnId, direction) {
  var btn = document.getElementById(btnId);
  var d = dirMap[direction];
  var lbl = dirLabels[direction];

  function onStart(e) {
    e.preventDefault();
    if (!isConnected || currentMode !== 'manual') return;
    targetLinear = d.lin;
    targetAngular = d.ang;
    safeSetText(el.lastCommand, lbl);
    safeSetText(el.serviceStatus, 'Acelerando...');
    safeSetText(el.svcStatusText, 'Movimiento: ' + lbl);
  }

  function onStop(e) {
    e.preventDefault();
    if (currentMode !== 'manual') return;
    targetLinear = targetAngular = 0;
    if (isConnected) {
      safeSetText(el.serviceStatus, 'Frenando...');
      safeSetText(el.svcStatusText, 'Desacelerando...');
    }
  }

  btn.addEventListener('mousedown', onStart);
  btn.addEventListener('mouseup', onStop);
  btn.addEventListener('mouseleave', onStop);
  btn.addEventListener('touchstart', onStart, { passive: false });
  btn.addEventListener('touchend', onStop, { passive: false });
}

setupHoldButton('btnForward', 'forward');
setupHoldButton('btnBackward', 'backward');
setupHoldButton('btnLeft', 'left');
setupHoldButton('btnRight', 'right');

el.btnStop.addEventListener('click', function () {
  if (!isConnected || currentMode !== 'manual') return;
  targetLinear = targetAngular = currentLinear = currentAngular = 0;
  safeSetText(el.lastCommand, 'STOP');
  safeSetText(el.serviceStatus, 'Freno de emergencia');
  safeSetText(el.svcStatusText, 'Freno de emergencia aplicado.');
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
      safeSetText(el.lastCommand, 'Adelante (teclado)'); break;
    case 'ArrowDown':
    case 'KeyS':
      targetLinear = -MAX_LIN; targetAngular = 0;
      safeSetText(el.lastCommand, 'Atrás (teclado)'); break;
    case 'ArrowLeft':
    case 'KeyA':
      targetLinear = 0; targetAngular = MAX_ANG;
      safeSetText(el.lastCommand, 'Izquierda (teclado)'); break;
    case 'ArrowRight':
    case 'KeyD':
      targetLinear = 0; targetAngular = -MAX_ANG;
      safeSetText(el.lastCommand, 'Derecha (teclado)'); break;
    case 'Space':
      e.preventDefault();
      targetLinear = targetAngular = currentLinear = currentAngular = 0;
      safeSetText(el.lastCommand, 'STOP (teclado)');
      safeSetText(el.serviceStatus, 'Freno de emergencia'); break;
  }
});

document.addEventListener('keyup', function (e) {
  var movKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS', 'KeyA', 'KeyD'];
  if (movKeys.indexOf(e.code) !== -1 && currentMode === 'manual') {
    targetLinear = targetAngular = 0;
  }
});

/* ── Mode switching ─────────────────────────────────────── */
function setOperationMode(mode) {
  currentMode = mode;

  if (mode === 'manual') {
    if (el.modeToggle) el.modeToggle.checked = false;
    safeSetText(el.modeNameText, 'Manual');
    safeSetText(el.modeDescText, 'Control directo del operador');
    safeSetText(el.currentModeText, 'Manual');
    if (el.currentModeText) el.currentModeText.className = 'mode-pill manual';
    setControlsEnabled(isConnected);
    targetLinear = targetAngular = 0;

  } else if (mode === 'auto') {
    if (el.modeToggle) el.modeToggle.checked = true;
    safeSetText(el.modeNameText, 'Automático');
    safeSetText(el.modeDescText, 'Patrulla autónoma Nav2 activa');
    safeSetText(el.currentModeText, 'Automático');
    if (el.currentModeText) el.currentModeText.className = 'mode-pill auto';
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
  safeSetText(el.svcStatusText, 'Enviando ruta a Nav2...');

  var patrolSrv = new ROSLIB.Service({
    ros: ros, name: '/start_patrol', serviceType: 'std_srvs/srv/Trigger'
  });

  patrolSrv.callService(new ROSLIB.ServiceRequest({}), function (result) {
    if (result && result.success) {
      safeSetText(el.serviceStatus, 'Patrullando');
      safeSetText(el.svcStatusText, 'Patrulla autónoma activa.');
      addAlert('Patrulla iniciada correctamente.', 'info');
    } else {
      var msg = (result && result.message) ? result.message : 'Sin respuesta';
      safeSetText(el.serviceStatus, 'Error Nav2');
      safeSetText(el.svcStatusText, 'Fallo al iniciar patrulla: ' + msg);
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
setControlsEnabled(true);