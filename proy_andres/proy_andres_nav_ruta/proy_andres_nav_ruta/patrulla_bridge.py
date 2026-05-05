#!/usr/bin/env python3
"""Puente entre la web y la acción `follow_waypoints` de Nav2.

Expone el servicio `/start_patrol` (`std_srvs/srv/Trigger`) que la interfaz web
puede llamar sin conocer la API de actions de ROS 2. Al recibir la petición, el
nodo construye los waypoints de patrulla y los envía a Nav2 mediante un
`ActionClient`, devolviendo inmediatamente la confirmación al cliente HTTP.
"""

import rclpy
from rclpy.node import Node
from rclpy.action import ActionClient
from std_srvs.srv import Trigger
from nav2_msgs.action import FollowWaypoints
from geometry_msgs.msg import PoseStamped


# Puntos de la ruta de patrulla, en el frame `map`.
PATROL_POINTS = [(-7.0, 4.0), (-7.0, -4.0), (0.5, -7.0), (7.0, 4.0)]

# Tiempo máximo de espera para que el servidor de Nav2 esté disponible.
NAV2_WAIT_TIMEOUT_SEC = 2.0


class PatrolBridge(Node):
    """Nodo puente que traduce un `Trigger` en una acción `FollowWaypoints`."""

    def __init__(self):
        """Configura `use_sim_time`, el servicio de entrada y el cliente de acción."""
        super().__init__('patrol_bridge_node')

        # Forzamos `use_sim_time` para sincronizar con el reloj de Gazebo,
        # de lo contrario los timestamps en los goals desfasarían a Nav2.
        self.set_parameters([
            rclpy.parameter.Parameter('use_sim_time', rclpy.Parameter.Type.BOOL, True)
        ])

        self.srv = self.create_service(Trigger, '/start_patrol', self.patrol_callback)
        self._action_client = ActionClient(self, FollowWaypoints, 'follow_waypoints')
        self.get_logger().info('Servicio Puente /start_patrol listo (Sincronizado con Gazebo).')

    def patrol_callback(self, request, response):
        """Callback del servicio `/start_patrol`.

        Args:
            request: Petición `Trigger` (sin payload).
            response: Respuesta `Trigger` con `success` y `message`.

        Returns:
            La respuesta indicando si la ruta se envió correctamente a Nav2.
        """
        self.get_logger().info('Iniciando modo automático desde la web...')
        try:
            sent = self.execute_patrol()
        except Exception as err:
            # Cualquier fallo inesperado debe devolverse al cliente HTTP en
            # lugar de propagarse y romper el ciclo de spin.
            self.get_logger().error(f'Error al enviar la patrulla: {err}')
            response.success = False
            response.message = f'Error interno: {err}'
            return response

        if sent:
            response.success = True
            response.message = "Patrulla enviada a Nav2"
        else:
            response.success = False
            response.message = "Nav2 no estaba disponible para recibir la patrulla"
        return response

    def execute_patrol(self) -> bool:
        """Construye y envía los waypoints al servidor de acción de Nav2.

        Returns:
            True si el goal fue enviado al servidor, False si Nav2 no respondió
            dentro del tiempo de espera.
        """
        if not self._action_client.wait_for_server(timeout_sec=NAV2_WAIT_TIMEOUT_SEC):
            self.get_logger().error('Nav2 no está listo aún.')
            return False

        goal_msg = FollowWaypoints.Goal()
        for x, y in PATROL_POINTS:
            pose = PoseStamped()
            pose.header.frame_id = 'map'
            # Dejamos el timestamp a cero deliberadamente: si el reloj simulado
            # aún no ha empezado, fijarlo manualmente provoca rechazos en Nav2.
            pose.pose.position.x = float(x)
            pose.pose.position.y = float(y)
            pose.pose.orientation.w = 1.0
            goal_msg.poses.append(pose)

        self._action_client.send_goal_async(goal_msg)
        self.get_logger().info('¡Ruta inyectada con éxito!')
        return True


def main(args=None):
    """Inicia rclpy, gira el nodo y libera recursos al salir."""
    rclpy.init(args=args)
    node = None
    try:
        node = PatrolBridge()
        rclpy.spin(node)
    except KeyboardInterrupt:
        if node is not None:
            node.get_logger().info('Interrupción del usuario, cerrando puente de patrulla.')
    except Exception as err:
        if node is not None:
            node.get_logger().error(f'Error inesperado en patrol_bridge: {err}')
        else:
            print(f'Error al inicializar patrol_bridge: {err}')
    finally:
        if node is not None:
            node.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == '__main__':
    main()
