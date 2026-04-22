#!/usr/bin/env python3
import sys
import rclpy
from rclpy.node import Node
from geometry_msgs.msg import PoseWithCovarianceStamped
from nav_msgs.msg import Odometry


class InitialPosePublisher(Node):
    def __init__(self):
        super().__init__('initialpose_publisher')
        # Declare use_sim_time so the parameter exists for this node
        try:
            self.declare_parameter('use_sim_time', True)
        except Exception:
            pass
        self.pub = self.create_publisher(PoseWithCovarianceStamped, '/initialpose', 10)
        self.timer = self.create_timer(0.5, self.timer_callback)
        self.published = False
        self.last_odom_stamp = None
        self.create_subscription(Odometry, '/odom', self.odom_callback, 10)
        self.get_logger().info('InitialPosePublisher started, waiting for /clock...')

    def timer_callback(self):
        now = self.get_clock().now()
        # wait until sim clock is published (non-zero time)
        try:
            sec = now.seconds
            nsec = now.nanoseconds
        except Exception:
            # Fallback: try to convert to msg
            tmsg = now.to_msg()
            sec = tmsg.sec
            nsec = tmsg.nanosec

        if sec == 0 and nsec == 0:
            self.get_logger().debug('waiting for non-zero clock...')
            return

        # Wait until we have received at least one /odom message
        if self.last_odom_stamp is None:
            self.get_logger().debug('waiting for /odom message before publishing initial pose...')
            return

        # Use the timestamp from the latest odom message to avoid TF extrapolation
        odom_stamp = self.last_odom_stamp
        if odom_stamp.sec == 0 and odom_stamp.nanosec == 0:
            self.get_logger().debug('odom stamp is zero, waiting...')
            return

        msg = PoseWithCovarianceStamped()
        msg.header.stamp = odom_stamp
        msg.header.frame_id = 'map'
        msg.pose.pose.position.x = 0.0
        msg.pose.pose.position.y = 0.0
        msg.pose.pose.orientation.w = 1.0
        self.pub.publish(msg)
        self.get_logger().info('Published initial pose using latest /odom timestamp')
        self.published = True
        try:
            self.timer.cancel()
        except Exception:
            pass

    def odom_callback(self, msg: Odometry):
        # store the raw header stamp (builtin_interfaces/Time)
        self.last_odom_stamp = msg.header.stamp


def main():
    try:
        rclpy.init()
    except Exception as e:
        print('rclpy.init() failed:', e, file=sys.stderr)
        return 1

    node = None
    try:
        node = InitialPosePublisher()
        # Spin until we've published the pose or until shutdown
        while rclpy.ok() and not node.published:
            rclpy.spin_once(node, timeout_sec=0.5)
    except KeyboardInterrupt:
        pass
    finally:
        if node is not None:
            try:
                node.destroy_node()
            except Exception:
                pass
        try:
            rclpy.shutdown()
        except Exception:
            # If shutdown is called without init, ignore
            pass

    return 0


if __name__ == '__main__':
    sys.exit(main())
