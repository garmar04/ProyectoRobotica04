#!/usr/bin/env python3
import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist
from custom_interface.srv import MyMoveMsg 

class WebTeleopService(Node):
    def __init__(self):
        super().__init__('web_teleop_service')
        self.srv = self.create_service(MyMoveMsg, '/movement', self.movement_callback)
        self.publisher_ = self.create_publisher(Twist, 'cmd_vel', 10)
        self.target_linear = 0.0
        self.target_angular = 0.0
        self.timer = self.create_timer(0.1, self.publish_velocity)
        self.get_logger().info('Servicio /movement listo para la Web...')

    def movement_callback(self, request, response):
        command = request.move.lower()
        self.get_logger().info(f'Recibido: "{command}"')

        if command == 'forward':
            self.target_linear, self.target_angular = 1.2, 0.0
        elif command == 'backward':
            self.target_linear, self.target_angular = -1.2, 0.0
        elif command == 'left':
            self.target_linear, self.target_angular = 0.0, 0.6
        elif command == 'right':
            self.target_linear, self.target_angular = 0.0, -0.6
        elif command == 'stop':
            self.target_linear, self.target_angular = 0.0, 0.0

        response.success = True
        return response

    def publish_velocity(self):
        msg = Twist()
        msg.linear.x = self.target_linear
        msg.angular.z = self.target_angular
        self.publisher_.publish(msg)

def main(args=None):
    rclpy.init(args=args)
    node = WebTeleopService()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
