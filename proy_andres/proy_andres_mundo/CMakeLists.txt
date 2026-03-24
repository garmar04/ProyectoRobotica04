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
