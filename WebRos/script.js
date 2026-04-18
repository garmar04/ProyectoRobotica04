let ros = null;
let isConnected = false;

let cameraTopic = null;
let mapTopic = null;
let alertsTopic = null;
let movementService = null;

const elements = {
    websocketUrl: document.getElementById('websocketUrl'),
    connectBtn: document.getElementById('connectBtn'),
    disconnectBtn: document.getElementById('disconnectBtn'),
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText'),
    connectionStatus: document.getElementById('connectionStatus'),
    lastEvent: document.getElementById('lastEvent'),
    currentTime: document.getElementById('currentTime'),
    cameraViewer: document.getElementById('cameraViewer'),
    mapViewer: document.getElementById('mapViewer'),
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
let modeService = null;

function updateTime() {
    const now = new Date();
    elements.currentTime.textContent = now.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
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

function connectToROS() {
    const url = elements.websocketUrl.value.trim();

    if (!url) {
        alert('Por favor, introduce una URL válida');
        return;
    }

    updateConnectionStatus('Conectando...', '', 'Iniciando conexión');
    elements.connectBtn.disabled = true;

    ros = new ROSLIB.Ros({
        url: url
    });

    ros.on('connection', function () {
        isConnected = true;
        updateConnectionStatus('Conectado', '', 'Conexión establecida');
        elements.connectBtn.disabled = true;
        elements.disconnectBtn.disabled = false;
        toggleControlButtons(true);

        initializeTopics();
        initializeService();
        setOperationMode(currentMode); // Refresh UI state on connection
    });

    ros.on('error', function (error) {
        isConnected = false;
        updateConnectionStatus('Error de conexión', '', 'Error');
        console.error('Error de conexión ROS:', error);
        elements.connectBtn.disabled = false;
        elements.disconnectBtn.disabled = true;
        toggleControlButtons(false);
    });

    ros.on('close', function () {
        isConnected = false;
        updateConnectionStatus('Desconectado', '', 'Conexión cerrada');
        elements.connectBtn.disabled = false;
        elements.disconnectBtn.disabled = true;
        toggleControlButtons(false);
        setOperationMode(currentMode); // Refresh UI state on disconnection

        cleanupTopics();
    });
}

function disconnectFromROS() {
    if (ros) {
        cleanupTopics();
        ros.close();
        ros = null;
        updateConnectionStatus('Desconectado', '', 'Desconexión manual');
    }
}

function setOperationMode(mode) {
    currentMode = mode;

    // UI Update (Always allowed for feedback)
    if (mode === 'manual') {
        elements.modeToggle.checked = false;
        elements.currentModeText.textContent = 'Modo Manual';
        elements.currentModeText.className = 'value mode-manual';
        elements.modeStatusDesc.textContent = 'El robot está bajo control manual del usuario.';
        toggleControlButtons(true); // Always enable visually in Manual mode
    } else {
        elements.modeToggle.checked = true;
        elements.currentModeText.textContent = 'Modo Automático';
        elements.currentModeText.className = 'value mode-auto';
        elements.modeStatusDesc.textContent = 'El robot navega de forma autónoma.';
        toggleControlButtons(false);
    }

    // ROS Service call (Only if connected)
    if (isConnected && modeService) {
        const request = new ROSLIB.ServiceRequest({
            data: (mode === 'auto')
        });

        modeService.callService(request, function (result) {
            console.log('Modo cambiado a:', mode, result.success ? 'Éxito' : 'Fallo');
        });
    } else if (!isConnected) {
        console.warn('Cambio de modo en UI (Sin conexión ROS)');
    }
}

function toggleControlButtons(enabled) {
    elements.btnForward.disabled = !enabled;
    elements.btnBackward.disabled = !enabled;
    elements.btnLeft.disabled = !enabled;
    elements.btnRight.disabled = !enabled;
    elements.btnStop.disabled = !enabled;
}

function initializeTopics() {
    cameraTopic = new ROSLIB.Topic({
        ros: ros,
        name: '/camera/image_raw',
        messageType: 'sensor_msgs/Image'
    });

    cameraTopic.subscribe(function (message) {
        displayCameraImage(message);
    });

    mapTopic = new ROSLIB.Topic({
        ros: ros,
        name: '/map',
        messageType: 'nav_msgs/OccupancyGrid'
    });

    mapTopic.subscribe(function (message) {
        displayMap(message);
    });

    alertsTopic = new ROSLIB.Topic({
        ros: ros,
        name: '/robot_alerts',
        messageType: 'std_msgs/String'
    });

    alertsTopic.subscribe(function (message) {
        addAlert(message.data);
    });
}

function cleanupTopics() {
    if (cameraTopic) {
        cameraTopic.unsubscribe();
        cameraTopic = null;
    }

    if (mapTopic) {
        mapTopic.unsubscribe();
        mapTopic = null;
    }

    if (alertsTopic) {
        alertsTopic.unsubscribe();
        alertsTopic = null;
    }

    movementService = null;
}

function displayCameraImage(imageMessage) {
    const canvas = document.createElement('canvas');
    canvas.width = imageMessage.width;
    canvas.height = imageMessage.height;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.objectFit = 'contain';

    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(imageMessage.width, imageMessage.height);

    for (let i = 0; i < imageMessage.data.length; i++) {
        imageData.data[i] = imageMessage.data[i];
    }

    ctx.putImageData(imageData, 0, 0);

    elements.cameraViewer.innerHTML = '';
    elements.cameraViewer.appendChild(canvas);
}

function displayMap(mapMessage) {
    const canvas = document.createElement('canvas');
    canvas.width = mapMessage.info.width;
    canvas.height = mapMessage.info.height;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.objectFit = 'contain';

    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(mapMessage.info.width, mapMessage.info.height);

    for (let i = 0; i < mapMessage.data.length; i++) {
        const value = mapMessage.data[i];
        const pixelIndex = i * 4;

        if (value === -1) {
            imageData.data[pixelIndex] = 128;
            imageData.data[pixelIndex + 1] = 128;
            imageData.data[pixelIndex + 2] = 128;
        } else {
            const grayscale = 255 - Math.floor((value / 100) * 255);
            imageData.data[pixelIndex] = grayscale;
            imageData.data[pixelIndex + 1] = grayscale;
            imageData.data[pixelIndex + 2] = grayscale;
        }
        imageData.data[pixelIndex + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);

    elements.mapViewer.innerHTML = '';
    elements.mapViewer.appendChild(canvas);
}

function initializeService() {
    movementService = new ROSLIB.Service({
        ros: ros,
        name: '/movement',
        serviceType: 'std_srvs/SetBool'
    });


    modeService = new ROSLIB.Service({
        ros: ros,
        name: '/set_operation_mode',
        serviceType: 'std_srvs/SetBool'
    });

    elements.serviceStatus.textContent = 'Servicios listos';
}

function sendMovementCommand(direction) {
    if (!isConnected) {
        elements.serviceStatus.textContent = 'Error: No conectado a ROS';
        elements.serviceStatus.style.color = 'var(--danger-color)';
        setTimeout(() => {
            elements.serviceStatus.style.color = '';
            if (!isConnected) elements.serviceStatus.textContent = 'Desconectado';
        }, 3000);
        return;
    }

    if (!movementService) {
        elements.serviceStatus.textContent = 'Error: Servicio no disponible';
        return;
    }

    const request = new ROSLIB.ServiceRequest({
        data: direction
    });

    elements.lastCommand.textContent = direction.toUpperCase();
    elements.serviceStatus.textContent = 'Enviando...';

    movementService.callService(request, function (result) {
        if (result.success) {
            elements.serviceStatus.textContent = 'Comando ejecutado';
        } else {
            elements.serviceStatus.textContent = 'Error en comando';
        }
    }, function (error) {
        console.error('Error al llamar al servicio:', error);
        elements.serviceStatus.textContent = 'Error de servicio';
    });
}

function addAlert(message) {
    const alertsEmpty = elements.alertsList.querySelector('.alerts-empty');
    if (alertsEmpty) {
        alertsEmpty.remove();
    }

    const alertItem = document.createElement('div');
    alertItem.className = 'alert-item';

    const now = new Date();
    const timeString = now.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    const dateString = now.toLocaleDateString('es-ES');

    if (message.toLowerCase().includes('crítico') || message.toLowerCase().includes('peligro')) {
        alertItem.classList.add('critical');
    }

    alertItem.innerHTML = `
        <div class="alert-header">
            <span class="alert-time">${dateString} ${timeString}</span>
        </div>
        <div class="alert-message">${message}</div>
    `;

    elements.alertsList.insertBefore(alertItem, elements.alertsList.firstChild);

    updateAlertsCount();
}

function updateAlertsCount() {
    const count = elements.alertsList.querySelectorAll('.alert-item').length;
    elements.alertsCount.textContent = count;
}

function clearAlerts() {
    elements.alertsList.innerHTML = `
        <div class="alerts-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <p>No hay alertas</p>
        </div>
    `;
    updateAlertsCount();
}

elements.connectBtn.addEventListener('click', connectToROS);
elements.disconnectBtn.addEventListener('click', disconnectFromROS);

elements.btnForward.addEventListener('click', () => sendMovementCommand('forward'));
elements.btnBackward.addEventListener('click', () => sendMovementCommand('backward'));
elements.btnLeft.addEventListener('click', () => sendMovementCommand('left'));
elements.btnRight.addEventListener('click', () => sendMovementCommand('right'));
elements.btnStop.addEventListener('click', () => sendMovementCommand('stop'));

elements.clearAlertsBtn.addEventListener('click', clearAlerts);

elements.modeToggle.addEventListener('change', (e) => {
    const mode = e.target.checked ? 'auto' : 'manual';
    setOperationMode(mode);
});

setOperationMode('manual'); // Initialize UI state properly (includes toggleControlButtons)
