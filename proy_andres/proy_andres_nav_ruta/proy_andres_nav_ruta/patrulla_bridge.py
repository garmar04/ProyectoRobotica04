#!/usr/bin/env python3
"""Puente entre la web y la acción `follow_waypoints` de Nav2.

Expone el servicio `/start_patrol` (`std_srvs/srv/Trigger`) que la interfaz web
puede llamar sin conocer la API de actions de ROS 2. Al recibir la petición, el
nodo construye los waypoints de patrulla y los envía a Nav2 mediante un
`ActionClient`, devolviendo inmediatamente la confirmación al cliente HTTP.
"""

import rclpy
from rclpy.node import Node
from std_srvs.srv import Trigger
from geometry_msgs.msg import PoseStamped
from nav2_simple_commander.robot_navigator import BasicNavigator, TaskResult
import threading

# Puntos de la ruta de patrulla, en el frame `map`.
PATROL_POINTS = [(-7.0, 4.0), (-7.0, -4.0), (0.5, -7.0), (7.0, 4.0)]

class PatrolBridge(Node):
    def __init__(self):
        super().__init__('patrol_bridge_node')
        # Sincronizar con Gazebo
        self.set_parameters([
            rclpy.parameter.Parameter('use_sim_time', rclpy.Parameter.Type.BOOL, True)
        ])
        self.srv = self.create_service(Trigger, '/start_patrol', self.patrol_callback)
        self.get_logger().info('Servicio Puente /start_patrol listo.')
        # Cliente para el procesador de imagen
        self.img_client = self.create_client(Trigger, 'capturar_y_procesar')
        self.nav = None

    def patrol_callback(self, request, response):
        self.get_logger().info('Iniciando patrulla secuencial desde la web...')
        # Ejecutamos la patrulla en un hilo separado para no bloquear el servicio
        threading.Thread(target=self.run_patrol_logic).start()
        
        response.success = True
        response.message = "Patrulla secuencial iniciada"
        return response

    def run_patrol_logic(self):
        if self.nav is None:
            self.nav = BasicNavigator()
        
        self.nav.waitUntilNav2Active()

        for i, (x, y) in enumerate(PATROL_POINTS):
            self.get_logger().info(f"Navegando al punto {i}...")
            pose = PoseStamped()
            pose.header.frame_id = 'map'
            pose.pose.position.x = float(x)
            pose.pose.position.y = float(y)
            pose.pose.orientation.w = 1.0
            
            self.nav.goToPose(pose)
            while not self.nav.isTaskComplete():
                pass

            if self.nav.getResult() == TaskResult.SUCCEEDED:
                self.get_logger().info(f"Punto {i} alcanzado. Procesando imagen...")
                self.call_image_service()
            else:
                self.get_logger().warn(f"No se pudo llegar al punto {i}")

        self.get_logger().info("Patrulla completada con éxito.")

    def call_image_service(self):
        if not self.img_client.wait_for_service(timeout_sec=1.0):
            self.get_logger().warn("Servicio de imagen no disponible.")
            return

        req = Trigger.Request()
        # No esperamos el resultado para no complicar el hilo, 
        # el nodo procesador ya se encarga de guardar y publicar.
        self.img_client.call_async(req)
        self.get_logger().info("Petición de procesamiento enviada.")


def main(args=None):
    """Inicia rclpy, gira el nodo y libera recursos al salir."""
    rclpy.init(args=args)
    node = None
    try:
        node = PatrolBridge()
        # Usamos un MultiThreadedExecutor para permitir llamadas de servicio 
        # mientras el hilo principal gira
        executor = rclpy.executors.MultiThreadedExecutor()
        rclpy.spin(node, executor=executor)
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
