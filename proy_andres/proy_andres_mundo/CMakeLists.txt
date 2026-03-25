cmake_minimum_required(VERSION 3.5)
project(proy_andres_mundo)

find_package(ament_cmake REQUIRED)

install(DIRECTORY
  launch
  models
  worlds
  DESTINATION share/${PROJECT_NAME}
)

ament_package()

# --- Añade esto para buscar los paquetes primero ---
find_package(rclcpp REQUIRED)
find_package(geometry_msgs REQUIRED)

# Compilar el nodo de C++
add_executable(control_manual src/control_manual.cpp)

# Añadir las dependencias de ROS 2
ament_target_dependencies(control_manual rclcpp geometry_msgs)

# Instalar el ejecutable en la carpeta correcta
install(TARGETS
  control_manual
  DESTINATION lib/${PROJECT_NAME}
)
