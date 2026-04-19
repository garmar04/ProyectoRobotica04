#!/bin/bash

echo "====================================================="
echo "🚀 Iniciando Sistema de Vigilancia (VERSIÓN DEFINITIVA + GIROS LENTOS)"
echo "====================================================="

# 1. LIMPIEZA TOTAL
echo "🧹 Limpiando procesos anteriores..."
pkill -9 gz || true
pkill -9 ruby || true
pkill -9 gazebo || true
pkill -9 ros2 || true
pkill -9 rviz2 || true
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

export ROS_DOMAIN_ID=0
export ROS_LOCALHOST_ONLY=0
export TURTLEBOT3_MODEL=burger
export GZ_SIM_RESOURCE_PATH=$WORKSPACE_DIR/install/proy_andres_mundo/share/proy_andres_mundo/models:$WORKSPACE_DIR/install/proy_andres_mundo/share/proy_andres_mundo/worlds:$WORKSPACE_DIR/install/turtlebot3_gazebo/share/turtlebot3_gazebo/models

# 3. LANZAMIENTO
echo "[1/7] 🌐 Levantando servidor Web (Vite/React)..."
cd $WORKSPACE_DIR/WebRos
npm run dev &
VITE_PID=$!
cd $WORKSPACE_DIR

echo "[2/7] 🧪 Levantando Gazebo..."
export LIBGL_ALWAYS_SOFTWARE=1
ros2 launch proy_andres_mundo warehouse.launch.py use_sim_time:=true gz_args:="-r" &
GAZEBO_PID=$!
sleep 8

echo "[3/7] 🧠 Levantando Nav2..."
ros2 launch nav2_bringup bringup_launch.py use_sim_time:=true map:=$WORKSPACE_DIR/mapa_warehouse.yaml &
NAV_PID=$!
sleep 15

echo "[3.5/7] 🐢 Configurando giros lentos en modo automático..."
ros2 param set /controller_server FollowPath.wz_max 0.25

echo "[4/7] 🌉 Abriendo Rosbridge WebSockets..."
ros2 launch rosbridge_server rosbridge_websocket_launch.xml use_sim_time:=true &
BRIDGE_PID=$!
sleep 3

echo "[5/7] 📡 Mapeando tópicos Lidar e IMU..."
ros2 run ros_gz_bridge parameter_bridge /scan@sensor_msgs/msg/LaserScan[gz.msgs.LaserScan --ros-args -p use_sim_time:=true &
ros2 run ros_gz_bridge parameter_bridge /imu@sensor_msgs/msg/Imu[gz.msgs.IMU --ros-args -p use_sim_time:=true &
sleep 2

echo "[6/7] 🔄 Levantando Nodo Puente Web..."
ros2 run proy_andres_nav_ruta patrulla_bridge --ros-args -p use_sim_time:=true &
PATROL_PID=$!
sleep 2

echo "[7/7] 📺 Abriendo RViz..."
ros2 launch nav2_bringup rviz_launch.py use_sim_time:=true &
RVIZ_PID=$!

echo ""
echo "====================================================="
echo "✅ ¡Sistema listo con giros LENTOS en patrulla!"
echo "🌐 http://localhost:5173"
echo "🐢 Modo automático ahora hace giros suaves (0.35 rad/s)"
echo "====================================================="
echo "Presiona Ctrl+C para apagar todo."

trap "echo '🛑 Apagando...'; kill -9 \$GAZEBO_PID \$NAV_PID \$BRIDGE_PID \$PATROL_PID \$RVIZ_PID \$VITE_PID 2>/dev/null; pkill -9 ros_gz_bridge 2>/dev/null; ros2 daemon stop 2>/dev/null; exit 0" SIGINT SIGTERM

wait