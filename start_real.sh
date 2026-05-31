#!/bin/bash

echo "====================================================="
echo "🤖 Iniciando Sistema de Vigilancia (ROBOT REAL vía WiFi)"
echo "====================================================="

# =====================================================================
# CONFIGURACIÓN DEL ROBOT REAL  (edita estos valores antes de lanzar)
# =====================================================================
# IP del robot dentro de la red TP-LINK (ver documento de IPs del grupo).
ROBOT_IP="192.168.0.XX"
# Usuario SSH del TurtleBot.
ROBOT_USER="ubuntu"
# ROS_DOMAIN_ID: DEBE ser el mismo que tiene el robot en su ~/.bashrc
# (en clase suele ser X = número de equipo). Aquí mantenemos 42 como en start.sh.
ROBOT_DOMAIN_ID=42
# Tópico de la cámara del robot real (image_tools/cam2image publica en /image).
CAMERA_TOPIC="/image"
# Pose inicial del robot respecto al mapa real (x y yaw en rad). Ajusta donde
# coloques físicamente el robot al arrancar; por defecto el origen del mapa.
INITIAL_POSE="0.0 0.0 0.0"
# Pon a "true" para lanzar el bringup del robot automáticamente por SSH.
# Si lo dejas en "false" deberás ejecutar tú mismo, en un terminal:
#     ssh ${ROBOT_USER}@${ROBOT_IP}
#     export ROS_DOMAIN_ID=${ROBOT_DOMAIN_ID}
#     ros2 launch turtlebot3_bringup robot.launch.py
LAUNCH_ROBOT_BRINGUP=false

# 1. LIMPIEZA TOTAL (procesos del PC, NO del robot)
echo "🧹 Limpiando procesos anteriores..."
pkill -9 ros2 || true
pkill -9 rviz2 || true
pkill -9 ros_gz_bridge || true
fuser -k 9090/tcp 2>/dev/null || true
fuser -k 5173/tcp 2>/dev/null || true
ros2 daemon stop 2>/dev/null || true
rm -rf ~/.ros/log/* 2>/dev/null || true
sleep 2

# 2. ENTORNO
WORKSPACE_DIR="/home/javier/Escritorio/GTI/ProyectoRobotica04"
cd $WORKSPACE_DIR

echo "📦 Cargando entorno ROS 2 Jazzy..."
source /opt/ros/jazzy/setup.bash
source $WORKSPACE_DIR/install/setup.bash

# Dominio: igual que el del robot para que se vean los nodos.
export ROS_DOMAIN_ID=$ROBOT_DOMAIN_ID
# CLAVE para robot real: descubrimiento en TODA la subred WiFi (no solo localhost).
export ROS_AUTOMATIC_DISCOVERY_RANGE=SUBNET
export ROS_LOCALHOST_ONLY=0
# El robot físico del laboratorio es un TurtleBot3 burger.
export TURTLEBOT3_MODEL=burger

# 3. (OPCIONAL) ARRANCAR EL BRINGUP DEL ROBOT POR SSH
SSH_PID=""
if [ "$LAUNCH_ROBOT_BRINGUP" = "true" ]; then
  echo "🔌 Lanzando bringup en el robot ($ROBOT_USER@$ROBOT_IP) por SSH..."
  ssh -t ${ROBOT_USER}@${ROBOT_IP} \
    "export ROS_DOMAIN_ID=${ROBOT_DOMAIN_ID}; export TURTLEBOT3_MODEL=burger; ros2 launch turtlebot3_bringup robot.launch.py" &
  SSH_PID=$!
else
  echo "ℹ️  Recuerda lanzar en el ROBOT (por SSH):"
  echo "     export ROS_DOMAIN_ID=${ROBOT_DOMAIN_ID}"
  echo "     ros2 launch turtlebot3_bringup robot.launch.py"
fi

# 4. ESPERAR A QUE EL ROBOT PUBLIQUE SUS TÓPICOS (/scan y /odom)
echo "⏳ Esperando a que el robot esté online (descubriendo /scan)..."
WAITED=0
until ros2 topic list 2>/dev/null | grep -q "^/scan$"; do
  sleep 1
  WAITED=$((WAITED + 1))
  if [ $WAITED -ge 60 ]; then
    echo "⚠️  No se detecta /scan tras 60s. Revisa: WiFi, IP del robot,"
    echo "    ROS_DOMAIN_ID (PC=$ROBOT_DOMAIN_ID y robot deben coincidir) y que"
    echo "    el bringup del robot esté en marcha. Continuando de todas formas..."
    break
  fi
done
echo "✅ Robot detectado (o timeout). Continuando con el arranque..."

# 5. LANZAMIENTO DE LA PILA EN EL PC
echo "[1/7] 🌐 Levantando servidor Web (Vite/React)..."
cd $WORKSPACE_DIR/WebRos
npm run dev &
VITE_PID=$!
cd $WORKSPACE_DIR

echo "[2/7] 🧠 Levantando Nav2 con el MAPA REAL..."
ros2 launch nav2_bringup bringup_launch.py \
  use_sim_time:=false \
  map:=$WORKSPACE_DIR/mapa_warehouse_real.yaml &
NAV_PID=$!

# Publicar Pose Inicial automáticamente (usa el reloj real, no /clock).
(sleep 5; python3 $WORKSPACE_DIR/scripts/publish_initialpose.py $INITIAL_POSE \
  --ros-args -p use_sim_time:=false) &
POSE_PID=$!

sleep 15

echo "[3/7] 🐢 Configurando giros lentos en modo automático..."
ros2 param set /controller_server FollowPath.wz_max 0.25 || true

echo "[4/7] 🌉 Abriendo Rosbridge WebSockets..."
ros2 launch rosbridge_server rosbridge_websocket_launch.xml use_sim_time:=false &
BRIDGE_PID=$!
sleep 3

echo "[5/7] 📡 Cámara del robot real -> web..."
# NOTA: la /scan e /imu las publica directamente el robot (turtlebot3_bringup),
# por eso aquí NO usamos ros_gz_bridge (eso era exclusivo de Gazebo).
# Comprimimos la imagen de la cámara del robot ($CAMERA_TOPIC) al tópico que
# espera la web (/camera/image_raw/compressed).
# Requiere que en el robot esté corriendo la cámara, p.ej.:
#     ros2 run image_tools cam2image   (publica en /image)
ros2 run image_transport republish raw compressed \
  --ros-args \
  --remap in:=$CAMERA_TOPIC \
  --remap out/compressed:=/camera/image_raw/compressed &
COMPRESS_PID=$!
sleep 2

echo "[6/7] 🔄 Levantando Nodo Puente Web (patrulla)..."
ros2 run proy_andres_nav_ruta patrulla_bridge --ros-args -p use_sim_time:=false &
PATROL_PID=$!
sleep 2

echo "[6.5/7] 📸 Levantando Nodo Procesador de Imagen..."
ros2 run proy_andres_captacion procesador_imagen \
  --ros-args -p use_sim_time:=false -p camera_topic:=$CAMERA_TOPIC &
IMG_PROC_PID=$!
sleep 2

echo "[7/7] 📺 Abriendo RViz..."
ros2 launch nav2_bringup rviz_launch.py use_sim_time:=false &
RVIZ_PID=$!

echo ""
echo "====================================================="
echo "✅ ¡Sistema listo con el ROBOT REAL!"
echo "🌐 Web:        http://localhost:5173"
echo "🗺️  Mapa:       mapa_warehouse_real.yaml"
echo "🤖 Robot:      $ROBOT_USER@$ROBOT_IP (DOMAIN_ID=$ROBOT_DOMAIN_ID)"
echo "🎮 Control:    manual y automático publican en /cmd_vel (robot real)"
echo "====================================================="
echo "Presiona Ctrl+C para apagar todo (en el PC)."

trap "echo '🛑 Apagando...'; kill -9 \$NAV_PID \$BRIDGE_PID \$PATROL_PID \$RVIZ_PID \$VITE_PID \$POSE_PID \$COMPRESS_PID \$IMG_PROC_PID \$SSH_PID 2>/dev/null; pkill -9 ros_gz_bridge 2>/dev/null; ros2 daemon stop 2>/dev/null; exit 0" SIGINT SIGTERM

wait
