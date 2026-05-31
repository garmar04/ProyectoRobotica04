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
from std_srvs.srv import Trigger


def llamar_servicio_procesamiento(node):
    """Llama al servicio de captación de imágenes."""
    client = node.create_client(Trigger, 'capturar_y_procesar')
    if not client.wait_for_service(timeout_sec=1.0):
        print("Servicio de captación no disponible.")
        return

    req = Trigger.Request()
    future = client.call_async(req)
    rclpy.spin_until_future_complete(node, future, timeout_sec=2.0)
    
    if future.done():
        res = future.result()
        if res.success:
            print(f"Imagen capturada: {res.message}")
        else:
            print(f"Fallo en captación: {res.message}")


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
    """Inicializa Nav2, recorre los puntos uno a uno y procesa la imagen en cada parada."""
    rclpy.init(args=args)
    navigator = None
    try:
        navigator = BasicNavigator()
        navigator.waitUntilNav2Active()

        print("=== VERSIÓN CON PROCESAMIENTO DE IMAGEN ACTIVA ===")
        print("Iniciando modo patrulla secuencial...")

        for i, (x, y) in enumerate(PATROL_WAYPOINTS):
            print(f"Navegando al waypoint {i}: ({x}, {y})...")
            pose = create_pose(x, y)
            navigator.goToPose(pose)

            while not navigator.isTaskComplete():
                # Opcional: imprimir feedback de distancia
                pass

            result = navigator.getResult()
            if result == TaskResult.SUCCEEDED:
                print(f"¡Llegada al waypoint {i}! Procesando imagen...")
                llamar_servicio_procesamiento(navigator)
            else:
                print(f"No se pudo llegar al waypoint {i}. Saltando...")

        print('¡Ruta de patrulla completada!')

    except KeyboardInterrupt:
...
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
