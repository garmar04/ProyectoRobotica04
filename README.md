# ProyectoRobotica04

ProyectoRobotica04 es un proyecto de robótica que integra simulación, navegación y una interfaz web en tiempo real para monitorizar y controlar un robot móvil en un entorno tipo almacén.

## Memoria del proyecto
La memoria completa del proyecto se puede consultar aquí:
[Ver memoria del proyecto](docs/MemoriaVelaris.pdf)



Características principales
- Interfaz web (WebRos) que detecta el estado de conexión y del robot, muestra alarmas, vídeo de cámara, minimapa y permite controles manuales y automáticos.
- Simulación en Gazebo / ROS-GZ con un mundo de almacén y mapa (`mapa_warehouse.pgm` / `mapa_warehouse.yaml`).
- Navegación autónoma con Nav2 y perfiles de patrulla (nodos de puente para rutas/patrulla).
- Puente WebSockets (rosbridge) para comunicación entre navegador y ROS2.
- Puentes `ros_gz_bridge` para exponer sensores de la simulación a ROS2.
- Script de arranque `start.sh` que orquesta servidor web, simulador, Nav2, rosbridge, nodos puente y RViz.

Contenido del repositorio
- `WebRos/` — aplicación web (Vite + React) que sirve la UI en `http://localhost:5173`.
- `proy_andres_*` — paquetes ROS2 del proyecto (mundo, navegación, captación, puentes, etc.).
- `mapa_warehouse.pgm`, `mapa_warehouse.yaml` — mapa usado por Nav2.
- `start.sh` — script de conveniencia que inicia todos los componentes (limpieza, entorno, web, simulador, Nav2, rosbridge, nodos puente, RViz).
- `build/`, `install/` — artefactos de compilación (generados por `colcon build`).

Estructura de archivos
A continuación se muestra la organización principal del repositorio (se omiten `node_modules/`, `build/` e `install/`):

```text
ProyectoRobotica04/
├── README.md
├── start.sh                          # Script de arranque (limpia, lanza web, sim, Nav2, rosbridge, RViz)
├── comandos.txt                      # Comandos útiles de referencia
├── mapa_warehouse.pgm                # Mapa (imagen) usado por Nav2
├── mapa_warehouse.yaml               # Metadatos del mapa (resolución, origen, etc.)
│
├── scripts/
│   └── publish_initialpose.py        # Publica la pose inicial del robot en /initialpose
│
├── WebRos/                           # Aplicación web (Vite + React + TypeScript)
│   ├── index.html                    # Entrada principal de la UI
│   ├── landing.html                  # Página de aterrizaje
│   ├── login.html                    # Página de login
│   ├── registro.html                 # Página de registro
│   ├── script.js                     # Lógica cliente: rosbridge, mapa, controles
│   ├── styles.css                    # Estilos principales
│   ├── velaris.css                   # Tema/estilos adicionales
│   ├── package.json                  # Dependencias y scripts npm
│   ├── vite.config.ts                # Configuración de Vite
│   ├── tailwind.config.js            # Configuración de Tailwind
│   ├── postcss.config.js             # Configuración de PostCSS
│   ├── eslint.config.js              # Reglas de linting
│   ├── tsconfig*.json                # Configuraciones de TypeScript
│   ├── src/
│   │   ├── main.tsx                  # Punto de entrada React
│   │   ├── App.tsx                   # Componente raíz
│   │   ├── index.css                 # Estilos del bundle React
│   │   └── vite-env.d.ts             # Tipados de Vite
│   └── static/
│       └── js/
│           └── draw_occupancy_grid.js  # Renderizado del minimapa (occupancy grid)
│
├── proy_andres/                      # Workspace de paquetes ROS2 del proyecto
│   ├── README.md
│   ├── proy_andres/                  # Metapaquete (CMake)
│   │   ├── CMakeLists.txt
│   │   └── package.xml
│   ├── proy_andres_interface/        # Definición de servicios/mensajes personalizados
│   │   ├── CMakeLists.txt
│   │   ├── package.xml
│   │   └── srv/
│   │       └── MyMoveMsg.srv
│   ├── proy_andres_captacion/        # Paquete Python para captación de datos
│   │   ├── package.xml
│   │   ├── setup.py
│   │   ├── setup.cfg
│   │   ├── resource/
│   │   ├── test/
│   │   └── proy_andres_captacion/
│   │       └── __init__.py
│   ├── proy_andres_nav_punto/        # Navegación a un punto + teleop web
│   │   ├── package.xml
│   │   ├── setup.py
│   │   ├── setup.cfg
│   │   ├── resource/
│   │   ├── test/
│   │   └── proy_andres_nav_punto/
│   │       ├── __init__.py
│   │       ├── ir_a_punto.py         # Cliente Nav2 para ir a coordenadas
│   │       └── web_teleop_service.py # Servicio para teleop desde la UI
│   ├── proy_andres_nav_ruta/         # Navegación por ruta / patrulla
│   │   ├── package.xml
│   │   ├── setup.py
│   │   ├── setup.cfg
│   │   ├── resource/
│   │   ├── test/
│   │   └── proy_andres_nav_ruta/
│   │       ├── __init__.py
│   │       ├── patrulla_bridge.py    # Puente entre la UI y el nodo de patrulla
│   │       └── patrullar.py          # Lógica de patrullaje
│   └── proy_andres_mundo/            # Mundo, modelos, lanzadores y parámetros
│       ├── CMakeLists.txt
│       ├── package.xml
│       ├── launch/
│       │   ├── warehouse.launch.py
│       │   └── warehouse_simulation.launch
│       ├── worlds/
│       │   └── warehouse.world
│       ├── param/                    # Parámetros de costmap / planner
│       │   ├── base_local_planner_params.yaml
│       │   ├── costmap_common_params.yaml
│       │   ├── global_costmap_params.yaml
│       │   ├── local_costmap_params.yaml
│       │   ├── move_base_params.yaml
│       │   └── navfn.yaml
│       ├── rviz/
│       │   └── navigation.rviz
│       ├── src/
│       │   └── control_manual.cpp    # Nodo C++ de control manual
│       ├── urdf/                     # Descripción del robot Pioneer 3DX
│       │   ├── materials.xacro
│       │   ├── pioneer3dx.xacro
│       │   ├── pioneer3dx_body.xacro
│       │   └── pioneer3dx_wheel.xacro
│       ├── meshes/                   # Mallas STL/OBJ del robot
│       ├── models/                   # Modelos del entorno (workcell, etc.)
│       └── img/                      # GIFs/capturas del proyecto
│
└── turtlebot3_simulations/           # Paquetes externos de simulación TurtleBot3
    ├── README.md
    ├── LICENSE
    ├── CONTRIBUTING.md
    ├── turtlebot3_simulations_ci.repos
    ├── turtlebot3_fake_node/
    ├── turtlebot3_gazebo/
    └── turtlebot3_simulations/
```

Requisitos
- Linux (Ubuntu 22.04 o similar recomendado).
- ROS 2 (se usa `jazzy` en los scripts; puede adaptarse a otra distribución: `source /opt/ros/<distro>/setup.bash`).
- Colcon para construir el workspace: `colcon`.
- Gazebo / ROS-GZ (según el `launch` usado en `proy_andres_mundo`).
- Node.js >= 16 / npm para la interfaz web (`WebRos`).

Instalación y compilación (rápido)
1. Clonar el repositorio:

```bash
git clone <repo-url> ProyectoRobotica04
cd ProyectoRobotica04
```

2. Preparar ROS 2 y dependencias (ejemplo con Jazzy):

```bash
source /opt/ros/jazzy/setup.bash
# Instala dependencias del workspace si es necesario (rosdep, paquetes de sistema...)
rosdep update && rosdep install --from-paths src --ignore-src -r -y
```

3. Compilar el workspace:

```bash
colcon build --symlink-install
source install/setup.bash
```

4. Instalar dependencias de la interfaz web:

```bash
cd WebRos
npm install
cd ..
```

Arranque rápido (todo junto)
El proyecto incluye `start.sh`, que realiza limpieza, carga entornos y lanza el servidor web, simulador, Nav2, rosbridge, puentes y RViz. Es la forma recomendada durante desarrollo:

```bash
chmod +x start.sh
./start.sh
```

El script muestra la URL de la UI web: http://localhost:5173

Arranque por componentes (opcional)
Si prefieres levantar cada componente manualmente, usa los siguientes comandos en terminales separadas:

```bash
# 1) Web UI
cd WebRos
npm run dev

# 2) Preparar entorno ROS (en otra terminal)
source /opt/ros/jazzy/setup.bash
source install/setup.bash

# 3) Lanzar simulador / mundo (usa gz_args según configuración)
ros2 launch proy_andres_mundo warehouse.launch.py use_sim_time:=true gz_args:="-r"

# 4) Lanzar Nav2 con el mapa del almacén
ros2 launch nav2_bringup bringup_launch.py use_sim_time:=true map:=$PWD/mapa_warehouse.yaml

# 5) Levantar rosbridge (WebSockets) para la comunicación del navegador
ros2 launch rosbridge_server rosbridge_websocket_launch.xml

# 6) Ejecutar el nodo puente de patrulla (o nodos específicos del proyecto)
ros2 run proy_andres_nav_ruta patrulla_bridge --ros-args -p use_sim_time:=true

# 7) (Opcional) Abrir RViz
ros2 launch nav2_bringup rviz_launch.py use_sim_time:=true
```

Detalles de la interfaz web (WebRos)
- URL por defecto: `http://localhost:5173`.
- Conexión a ROS: la UI usa rosbridge vía WebSockets (habitualmente `ws://localhost:9090`).
- Funcionalidades implementadas:
	- Detección del estado de la conexión y del robot (con alertas/alarmas).
	- Transmisión y visualización de la cámara del robot.
	- Minimapa con posición/pose del robot y obstáculos.
	- Controles manuales (teleoperación / joystick virtual) y botones de control automático (iniciar/parar patrulla, rutas).

Temas / tópicos principales
La UI y los nodos usan tópicos ROS típicos (verificar con `ros2 topic list -v`):
- `/tf` — transformaciones del robot.
- `/odom` — odometría.
- `/scan` — LIDAR (LaserScan) expuesto mediante `ros_gz_bridge`.
- `/camera/...` — tópicos de imagen (si están configurados en la simulación).
- `/cmd_vel` — velocidad de control (desde la UI al robot).

Resolución de problemas
- Si `source /opt/ros/jazzy/setup.bash` falla: instala o usa tu distribución ROS 2 y ajusta el script a `source /opt/ros/<distro>/setup.bash`.
- Si el puerto `5173` ya está en uso: cierra la aplicación que lo usa o cambia el puerto en `WebRos`/Vite.
- Si rosbridge no se inicia: instala `rosbridge_server` y comprueba que no haya otro proceso ocupando `9090`.
- Para limpiar procesos anteriores, `start.sh` ya hace `pkill` de procesos comunes; también puedes usar:

```bash
pkill -9 gz ros2 rviz2 ros_gz_bridge node || true
```

Desarrollo y pruebas
- Para compilar la UI en modo producción:

```bash
cd WebRos
npm run build
```

- Ejecuta `ros2 topic list -v` y `ros2 node list` para comprobar que los nodos y tópicos esperados estén activos.

Contribuciones
- Usa ramas y pull requests para propuestas y correcciones.
- Añade documentación de nuevas funcionalidades en este README o en la carpeta `docs/` si se crea.

Contacto y autores
- Mantenedores: equipo ProyectoRobotica04.
- Para dudas sobre configuración o despliegue, abrir un issue o contactar con el autor del sprint.

Licencia
- Revisa el archivo `LICENSE` del repositorio (si existe) para conocer los términos.

Notas finales
- Esta documentación recoge el estado actual del sprint: existe una interfaz web que muestra el estado de conexión y del robot, alarmas, cámara, minimapa y controles manuales/automáticos. Si quieres que amplíe secciones concretas (diagramas, topologías de tópicos, instrucciones para Docker/CI, o detalles de la API web), dime y lo añado.

