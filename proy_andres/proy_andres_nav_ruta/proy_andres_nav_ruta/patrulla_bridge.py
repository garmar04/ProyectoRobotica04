#!/usr/bin/env python3
import rclpy
from rclpy.node import Node
from rclpy.action import ActionClient
from std_srvs.srv import Trigger
from nav2_msgs.action import FollowWaypoints
from geometry_msgs.msg import PoseStamped

class PatrolBridge(Node):
    def __init__(self):
        super().__init__('patrol_bridge_node')
        
        # 1. FORZAR AL NODO A USAR EL RELOJ DE GAZEBO
        self.set_parameters([rclpy.parameter.Parameter('use_sim_time', rclpy.Parameter.Type.BOOL, True)])
        
        # 2. Servicio para escuchar a la web
        self.srv = self.create_service(Trigger, '/start_patrol', self.patrol_callback)
        
        # 3. Cliente de Acción nativo
        self._action_client = ActionClient(self, FollowWaypoints, 'follow_waypoints')
        self.get_logger().info('Servicio Puente /start_patrol listo (Sincronizado con Gazebo).')

    def patrol_callback(self, request, response):
        self.get_logger().info('Iniciando modo automático desde la web...')
        self.execute_patrol()
        response.success = True
        response.message = "Patrulla enviada a Nav2"
        return response

    def execute_patrol(self):
        if not self._action_client.wait_for_server(timeout_sec=2.0):
            self.get_logger().error('Nav2 no está listo aún.')
            return
        
        goal_msg = FollowWaypoints.Goal()
        puntos = [(-7.0, 4.0), (-7.0, -4.0), (0.5, -7.0), (7.0, 4.0)]
        
        for x, y in puntos:
            pose = PoseStamped()
            pose.header.frame_id = 'map'
            # No es necesario fijar el tiempo manualmente para FollowWaypoints;
            # dejar el timestamp en cero evita problemas si el reloj simulado aún no está listo.
            pose.pose.position.x = float(x)
            pose.pose.position.y = float(y)
            pose.pose.orientation.w = 1.0
            goal_msg.poses.append(pose)
            
        self._action_client.send_goal_async(goal_msg)
        self.get_logger().info('¡Ruta inyectada con éxito!')

def main(args=None):
    rclpy.init(args=args)
    node = PatrolBridge()
    rclpy.spin(node)
    rclpy.shutdown()

if __name__ == '__main__':
    main()