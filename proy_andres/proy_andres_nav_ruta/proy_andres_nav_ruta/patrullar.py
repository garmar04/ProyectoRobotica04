#!/usr/bin/env python3
"""Modo patrulla: recorre una ruta predefinida usando `followWaypoints`.

Define cuatro puntos de paso por el almacén y los envía a Nav2 mediante el
`BasicNavigator`, mostrando por consola el progreso entre waypoints.

Uso:
    ros2 run proy_andres_nav_ruta patrullar
"""

import rclpy
from nav2_simple_commander.robot_navigator import BasicNavigator, TaskResult
from geometry_msgs.msg import PoseStamped


# Ruta de patrulla: lista de puntos (x, y) en el frame `map`.
# Modificar aquí para cambiar el recorrido sin tocar la lógica de navegación.
PATROL_WAYPOINTS = [
    (-7.0,  4.0),  # Punto 1: Pasillo A
    (-7.0, -4.0),  # Punto 2: Esquina estanterías
    ( 0.5, -7.0),  # Punto 3: Pasillo B
    ( 7.0,  4.0),  # Punto 4: Vuelta al inicio
]


def create_pose(x: float, y: float, w: float = 1.0) -> PoseStamped:
    """Construye un `PoseStamped` en el frame `map` con la pose indicada.

    Args:
        x: Coordenada X en metros.
        y: Coordenada Y en metros.
        w: Componente w del cuaternión de orientación (1.0 = sin rotación).

    Returns:
        Mensaje `PoseStamped` listo para añadir a la lista de waypoints.
    """
    pose = PoseStamped()
    pose.header.frame_id = 'map'
    pose.pose.position.x = float(x)
    pose.pose.position.y = float(y)
    pose.pose.orientation.w = float(w)
    return pose


def main(args=None):
    """Inicializa Nav2, envía la ruta de patrulla y muestra el resultado."""
    rclpy.init(args=args)
    navigator = None
    try:
        navigator = BasicNavigator()
        navigator.waitUntilNav2Active()

        print("Iniciando modo patrulla...")

        waypoints = [create_pose(x, y) for x, y in PATROL_WAYPOINTS]

        navigator.followWaypoints(waypoints)

        while not navigator.isTaskComplete():
            feedback = navigator.getFeedback()
            if feedback:
                print(f'Navegando al waypoint {feedback.current_waypoint} de {len(waypoints)}')

        result = navigator.getResult()
        if result == TaskResult.SUCCEEDED:
            print('¡Patrulla completada con éxito!')
        elif result == TaskResult.CANCELED:
            print('Patrulla cancelada por el usuario o por Nav2.')
        elif result == TaskResult.FAILED:
            print('Problema durante la patrulla: Nav2 ha reportado un fallo.')
        else:
            print(f'Resultado de patrulla desconocido: {result}')

    except KeyboardInterrupt:
        print('\nInterrupción del usuario: cancelando patrulla...')
        if navigator is not None:
            try:
                navigator.cancelTask()
            except Exception as cancel_err:
                print(f'No se pudo cancelar la patrulla limpiamente: {cancel_err}')
    except Exception as err:
        print(f'Error durante la patrulla: {err}')
    finally:
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == '__main__':
    main()
