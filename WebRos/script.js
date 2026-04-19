let ros = null;
let isConnected = false;

let cmdVelTopic = null;
let initialPoseTopic = null;

let targetLinear = 0.0;
let targetAngular = 0.0;
let currentLinear = 0.0;
let currentAngular = 0.0;

const MAX_LIN = 0.5;
const MAX_ANG = 0.5; 
const ACCEL_LIN = 0.4;
const ACCEL_ANG = 1.0;
const DT = 0.05; 

const elements = {
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
    alertsList: document.getElementById('alertsList'),
    alertsCount: document.getElementById('alertsCount'),
    clearAlertsBtn: document.getElementById('clearAlertsBtn'),
    modeToggle: document.getElementById('modeToggle'),
    modeStatusDesc: document.getElementById('modeStatusDesc'),
    currentModeText: document.getElementById('currentModeText')
};

let currentMode = 'manual';

function updateTime() {
    const now = new Date();
    elements.currentTime.textContent = now.toLocaleTimeString('es-ES', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
}
setInterval(updateTime, 1000);
updateTime();

function updateConnectionStatus(status, message, eventType = null) {
    elements.connectionStatus.textContent = status;
    elements.statusText.textContent = status;

    if (eventType) {
        const now = new Date().toLocaleTimeString('es-ES');
        elements.lastEvent.textContent = `${eventType} - ${now}`;
    }

    elements.statusDot.className = 'status-dot';
    if (status === 'Conectado') {
        elements.statusDot.classList.add('connected');
    } else if (status.includes('Error')) {
        elements.statusDot.classList.add('error');
    }
}

function toggleControlButtons(enabled) {
    elements.btnForward.disabled = !enabled;
    elements.btnBackward.disabled = !enabled;
    elements.btnLeft.disabled = !enabled;
    elements.btnRight.disabled = !enabled;
    elements.btnStop.disabled = !enabled;
}

// --- CONEXIÓN ROS ---
function connectToROS() {
    let url = elements.websocketUrl.value || 'ws://127.0.0.1:9090';
    ros = new ROSLIB.Ros({ url : url });

    ros.on('connection', function() {
        console.log('Conectado a websocket server.');
        isConnected = true;
        updateConnectionStatus('Conectado', '', 'Conexión establecida');
        
        // 1. Tópico de movimiento manual
        cmdVelTopic = new ROSLIB.Topic({
            ros: ros, name: '/cmd_vel', messageType: 'geometry_msgs/msg/Twist'
        });

        // 2. Despertar a Nav2 enviando la pose inicial automáticamente
        initialPoseTopic = new ROSLIB.Topic({
            ros: ros, name: '/initialpose', messageType: 'geometry_msgs/msg/PoseWithCovarianceStamped'
        });

        setTimeout(() => {
            let poseMsg = new ROSLIB.Message({
                header: { 
                    frame_id: 'map',
                    stamp: { sec: 0, nanosec: 0 }
                },
                pose: {
                    pose: { position: { x: 0.0, y: 0.0, z: 0.0 }, orientation: { w: 1.0 } },
                    covariance: [0.25,0,0,0,0,0, 0,0.25,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0.068]
                }
            });
            initialPoseTopic.publish(poseMsg);
            addAlert("Pose inicial enviada. Nav2 activado.");
            console.log("Pose inicial inyectada en Nav2 (Con Stamp 0)");
        }, 1500);
    });

    ros.on('error', function(error) {
        console.log('Error conectando a websocket server: ', error);
        updateConnectionStatus('Error de conexión', '', 'Fallo de WebSocket');
    });

    ros.on('close', function() {
        isConnected = false;
        updateConnectionStatus('Desconectado', '', 'Conexión cerrada');
    });
}

function disconnectFromROS() {
    if (ros) {
        ros.close();
        ros = null;
        updateConnectionStatus('Desconectado', '', 'Desconexión manual');
    }
}

// --- BUCLE DE FÍSICA Y FRENADO ---
let isMoving = false;

setInterval(() => {
    if (!isConnected || !cmdVelTopic || currentMode !== 'manual') return;

    currentLinear = smoothDato(currentLinear, targetLinear, ACCEL_LIN * DT);
    currentAngular = smoothDato(currentAngular, targetAngular, ACCEL_ANG * DT);

    if (Math.abs(currentLinear) > 0.001 || Math.abs(currentAngular) > 0.001) {
        let twist = new ROSLIB.Message({
            linear: { x: currentLinear, y: 0.0, z: 0.0 },
            angular: { x: 0.0, y: 0.0, z: currentAngular }
        });
        cmdVelTopic.publish(twist);
        isMoving = true;
    } 
    else if (isMoving) {
        currentLinear = 0.0;
        currentAngular = 0.0;
        let twist = new ROSLIB.Message({
            linear: { x: 0.0, y: 0.0, z: 0.0 },
            angular: { x: 0.0, y: 0.0, z: 0.0 }
        });
        cmdVelTopic.publish(twist);
        isMoving = false;
    }
}, DT * 1000);

function publishTwist(lin, ang) {
    let twist = new ROSLIB.Message({
        linear: { x: lin, y: 0.0, z: 0.0 },
        angular: { x: 0.0, y: 0.0, z: ang }
    });
    cmdVelTopic.publish(twist);
}

function smoothDato(current, target, step) {
    if (current < target) return Math.min(current + step, target);
    if (current > target) return Math.max(current - step, target);
    return current;
}

function setupHoldButton(btnId, direction) {
    const btn = document.getElementById(btnId);
    
    const startMove = (e) => {
        e.preventDefault(); 
        if (!isConnected || currentMode !== 'manual') return;
        elements.lastCommand.textContent = direction;
        elements.serviceStatus.textContent = "Acelerando...";
        
        switch (direction) {
            case 'forward': targetLinear = MAX_LIN; targetAngular = 0.0; break;
            case 'backward': targetLinear = -MAX_LIN; targetAngular = 0.0; break;
            case 'left': targetLinear = 0.0; targetAngular = MAX_ANG; break;
            case 'right': targetLinear = 0.0; targetAngular = -MAX_ANG; break;
        }
    };

    const stopMove = (e) => {
        e.preventDefault();
        if (currentMode !== 'manual') return;
        targetLinear = 0.0;
        targetAngular = 0.0;
        if (isConnected) elements.serviceStatus.textContent = "Frenando...";
    };

    btn.addEventListener('mousedown', startMove);
    btn.addEventListener('mouseup', stopMove);
    btn.addEventListener('mouseleave', stopMove);
    
    btn.addEventListener('touchstart', startMove);
    btn.addEventListener('touchend', stopMove);
}

setupHoldButton('btnForward', 'forward');
setupHoldButton('btnBackward', 'backward');
setupHoldButton('btnLeft', 'left');
setupHoldButton('btnRight', 'right');

elements.btnStop.addEventListener('click', () => {
    if (!isConnected || currentMode !== 'manual') return;
    targetLinear = 0.0; targetAngular = 0.0;
    currentLinear = 0.0; currentAngular = 0.0; 
    elements.lastCommand.textContent = 'STOP';
    elements.serviceStatus.textContent = "Freno de emergencia";
});

function iniciarPatrulla() {
    if (!isConnected) {
        alert("Conecta con ROS primero para iniciar la patrulla.");
        elements.modeToggle.checked = false;
        setOperationMode('manual');
        return;
    }

    addAlert("Iniciando patrulla autónoma (Evitando obstáculos)...");
    elements.serviceStatus.textContent = "Enviando ruta a Nav2...";

    let patrolSrv = new ROSLIB.Service({
        ros: ros, 
        name: '/start_patrol', 
        serviceType: 'std_srvs/srv/Trigger'
    });

    patrolSrv.callService(new ROSLIB.ServiceRequest({}), function(result) {
        console.log("Respuesta del puente: ", result.message);
        if (result.success) {
            elements.serviceStatus.textContent = "Patrullando...";
        } else {
            elements.serviceStatus.textContent = "Fallo al enviar patrulla";
            addAlert("Error al iniciar patrulla.");
        }
    });
}

function setOperationMode(mode) {
    currentMode = mode;

    if (mode === 'manual') {
        elements.modeToggle.checked = false;
        elements.currentModeText.textContent = 'Modo Manual';
        elements.currentModeText.className = 'value mode-manual';
        elements.modeStatusDesc.textContent = 'El robot está bajo control manual del usuario.';
        toggleControlButtons(true);
        
        targetLinear = 0.0; targetAngular = 0.0;
        
    } else if (mode === 'auto') {
        elements.modeToggle.checked = true;
        elements.currentModeText.textContent = 'Modo Automático';
        elements.currentModeText.className = 'value mode-auto';
        elements.modeStatusDesc.textContent = 'El robot navega de forma autónoma usando Nav2.';
        toggleControlButtons(false);
        
        iniciarPatrulla();
    }
}

function addAlert(message) {
    const alertsEmpty = elements.alertsList.querySelector('.alerts-empty');
    if (alertsEmpty) alertsEmpty.remove();

    const alertItem = document.createElement('div');
    alertItem.className = 'alert-item';
    
    const now = new Date();
    const timeString = now.toLocaleTimeString('es-ES');
    
    if (message.toLowerCase().includes('error') || message.toLowerCase().includes('fallo')) {
        alertItem.classList.add('critical');
    }

    alertItem.innerHTML = `
        <div class="alert-header">
            <span class="alert-time">${timeString}</span>
        </div>
        <div class="alert-message">${message}</div>
    `;

    elements.alertsList.insertBefore(alertItem, elements.alertsList.firstChild);
    updateAlertsCount();
}

function updateAlertsCount() {
    elements.alertsCount.textContent = elements.alertsList.querySelectorAll('.alert-item').length;
}

function clearAlerts() {
    elements.alertsList.innerHTML = `
        <div class="alerts-empty">
            <p>No hay alertas</p>
        </div>
    `;
    updateAlertsCount();
}

elements.connectBtn.addEventListener('click', connectToROS);
elements.disconnectBtn.addEventListener('click', disconnectFromROS);
elements.clearAlertsBtn.addEventListener('click', clearAlerts);

elements.modeToggle.addEventListener('change', (e) => {
    const mode = e.target.checked ? 'auto' : 'manual';
    setOperationMode(mode);
});

setOperationMode('manual');