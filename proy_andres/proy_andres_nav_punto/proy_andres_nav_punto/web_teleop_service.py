#!/usr/bin/env python3
"""Servicio ROS 2 de teleoperación desde la interfaz web.

Expone el servicio `/movement` (tipo `custom_interface/srv/MyMoveMsg`) que recibe
una cadena con la dirección deseada (forward/backward/left/right/stop) y publica
de forma periódica el `Twist` correspondiente en `/cmd_vel`.

El timer mantiene la última velocidad solicitada hasta recibir un nuevo comando,
de modo que la web no necesita reenviar el movimiento continuamente.
"""

import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist
from custom_interface.srv import MyMoveMsg


# Tabla de comandos válidos: (velocidad_lineal, velocidad_angular).
# Centralizar el mapping evita cadenas de if/elif y facilita añadir comandos.
COMMAND_TABLE = {
    'forward':  (1.2,  0.0),
    'backward': (-1.2, 0.0),
    'left':     (0.0,  0.6),
    'right':    (0.0, -0.6),
    'stop':     (0.0,  0.0),
}


class WebTeleopService(Node):
    """Nodo que traduce comandos textuales de la web en velocidades del robot."""

    def __init__(self):
        """Inicializa publishers, servicio y timer de publicación periódica."""
        super().__init__('web_teleop_service')
        self.srv = self.create_service(MyMoveMsg, '/movement', self.movement_callback)
        self.publisher_ = self.create_publisher(Twist, 'cmd_vel', 10)
        self.target_linear = 0.0
        self.target_angular = 0.0
        self.timer = self.create_timer(0.1, self.publish_velocity)
        self.get_logger().info('Servicio /movement listo para la Web...')

    def movement_callback(self, request, response):
        """Procesa una petición de movimiento recibida desde la web.

        Args:
            request: Petición con el campo `move` (str) indicando la dirección.
            response: Respuesta del servicio; se rellena `success` según validez.

        Returns:
            La respuesta con `success=True` si el comando es reconocido, o
            `success=False` si la cadena recibida no está en `COMMAND_TABLE`.
        """
        try:
            command = request.move.lower().strip()
        except AttributeError:
            # `request.move` no es un str (cliente mal formado).
            self.get_logger().warning('Petición inválida: campo "move" ausente o no es string.')
            response.success = False
            return response

        self.get_logger().info(f'Recibido: "{command}"')

        if command not in COMMAND_TABLE:
            self.get_logger().warning(f'Comando desconocido: "{command}" (se ignora).')
            response.success = False
            return response

        self.target_linear, self.target_angular = COMMAND_TABLE[command]
        response.success = True
        return response

    def publish_velocity(self):
        """Publica el último `Twist` solicitado en el tópico `cmd_vel`."""
        msg = Twist()
        msg.linear.x = self.target_linear
        msg.angular.z = self.target_angular
        self.publisher_.publish(msg)


def main(args=None):
    """Inicia rclpy, gira el nodo y libera recursos al salir."""
    rclpy.init(args=args)
    node = None
    try:
        node = WebTeleopService()
        rclpy.spin(node)
    except KeyboardInterrupt:
        # Salida limpia con Ctrl+C: parar el robot antes de cerrar.
        if node is not None:
            node.target_linear = 0.0
            node.target_angular = 0.0
            node.publish_velocity()
            node.get_logger().info('Interrupción del usuario, deteniendo el robot.')
    except Exception as err:
        if node is not None:
            node.get_logger().error(f'Error inesperado en web_teleop_service: {err}')
        else:
            print(f'Error al inicializar web_teleop_service: {err}')
    finally:
        if node is not None:
            node.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == '__main__':
    main()
