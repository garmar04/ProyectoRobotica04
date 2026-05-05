#!/usr/bin/env python3
"""Nodo de navegación a un punto fijo del mapa.

Este script utiliza el `BasicNavigator` de Nav2 para enviar al robot a una
coordenada predefinida del mapa, mostrando por consola la distancia restante
hasta el destino y el resultado final de la tarea.

Uso:
    ros2 run proy_andres_nav_punto ir_a_punto
"""

import rclpy
from nav2_simple_commander.robot_navigator import BasicNavigator, TaskResult
from geometry_msgs.msg import PoseStamped


def build_goal_pose(x: float, y: float, w: float = 1.0) -> PoseStamped:
    """Construye un `PoseStamped` en el frame `map` con la pose indicada.

    Args:
        x: Coordenada X en metros.
        y: Coordenada Y en metros.
        w: Componente w del cuaternión de orientación (1.0 = sin rotación).

    Returns:
        Un mensaje `PoseStamped` listo para enviar a Nav2.
    """
    goal_pose = PoseStamped()
    goal_pose.header.frame_id = 'map'
    goal_pose.pose.position.x = float(x)
    goal_pose.pose.position.y = float(y)
    goal_pose.pose.orientation.w = float(w)
    return goal_pose


def main(args=None):
    """Punto de entrada: inicia rclpy, envía la meta y espera resultado."""
    rclpy.init(args=args)
    navigator = None
    try:
        navigator = BasicNavigator()

        # Bloquea hasta que Nav2 esté listo (mapa cargado, AMCL activo, etc.)
        navigator.waitUntilNav2Active()

        goal_pose = build_goal_pose(x=8.5, y=-8.0)

        print("Enviando orden para ir a la coordenada elegida...")
        navigator.goToPose(goal_pose)

        while not navigator.isTaskComplete():
            feedback = navigator.getFeedback()
            if feedback:
                print(f'Distancia restante: {feedback.distance_remaining:.2f} metros')

        result = navigator.getResult()
        if result == TaskResult.SUCCEEDED:
            print('¡Robot ha llegado a su destino exitosamente!')
        elif result == TaskResult.CANCELED:
            print('La navegación fue cancelada.')
        elif result == TaskResult.FAILED:
            print('El robot falló al intentar llegar al destino (¿obstáculo insalvable?).')
        else:
            print(f'Resultado de navegación desconocido: {result}')

    except KeyboardInterrupt:
        print('\nInterrupción del usuario: cancelando navegación...')
        if navigator is not None:
            try:
                navigator.cancelTask()
            except Exception as cancel_err:
                print(f'No se pudo cancelar la tarea limpiamente: {cancel_err}')
    except Exception as err:
        # Captura genérica para evitar un traceback desnudo en runtime de ROS.
        print(f'Error durante la navegación: {err}')
    finally:
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == '__main__':
    main()
