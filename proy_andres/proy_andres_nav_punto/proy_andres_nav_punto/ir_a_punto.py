#!/usr/bin/env python3
import rclpy
from rclpy.node import Node
from nav2_simple_commander.robot_navigator import BasicNavigator, TaskResult
from geometry_msgs.msg import PoseStamped

def main(args=None):
    rclpy.init(args=args)
    
    # Iniciamos el navegador de Nav2
    navigator = BasicNavigator()

    # Esperamos a que Nav2 esté completamente activo (mapa cargado, AMCL listo, etc.)
    navigator.waitUntilNav2Active()

    # Definimos el punto de destino
    goal_pose = PoseStamped()
    goal_pose.header.frame_id = 'map'
    
    # Coordenadas X e Y (ajusta estos valores según tu mapa de Gazebo)
    goal_pose.pose.position.x = 8.5
    goal_pose.pose.position.y = -8.0
    # Orientación (cuaternión). w=1.0 significa mirando hacia adelante sin rotación extra
    goal_pose.pose.orientation.w = 1.0

    print("Enviando orden para ir a la coordenada elegida...")
    navigator.goToPose(goal_pose)

    # Bucle para ir comprobando cómo va el viaje
    while not navigator.isTaskComplete():
        feedback = navigator.getFeedback()
        if feedback:
            print(f'Distancia restante: {feedback.distance_remaining:.2f} metros')

    # Resultado final
    result = navigator.getResult()
    if result == TaskResult.SUCCEEDED:
        print('¡Robot ha llegado a su destino exitosamente!')
    elif result == TaskResult.CANCELED:
        print('La navegación fue cancelada.')
    elif result == TaskResult.FAILED:
        print('El robot falló al intentar llegar al destino (¿obstáculo insalvable?).')

    rclpy.shutdown()

if __name__ == '__main__':
    main()
