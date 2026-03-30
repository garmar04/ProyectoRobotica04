#!/usr/bin/env python3
import rclpy
from nav2_simple_commander.robot_navigator import BasicNavigator, TaskResult
from geometry_msgs.msg import PoseStamped

def create_pose(navigator, x, y, w=1.0):
    pose = PoseStamped()
    pose.header.frame_id = 'map'
    pose.pose.position.x = x
    pose.pose.position.y = y
    pose.pose.orientation.w = w
    return pose

def main(args=None):
    rclpy.init(args=args)
    navigator = BasicNavigator()
    navigator.waitUntilNav2Active()

    print("Iniciando modo patrulla...")

    # Creamos una lista de puntos por los que tiene que pasar el robot
    waypoints =[]
    waypoints.append(create_pose(navigator, -7.0, 4.0))    # Punto 1: Pasillo A
    waypoints.append(create_pose(navigator, -7.0, -4.0))    # Punto 2: Esquina estanterías
    waypoints.append(create_pose(navigator, 0.5, -7.0))   # Punto 3: Pasillo B
    waypoints.append(create_pose(navigator, 7.0, 4.0))    # Punto 4: Vuelta al inicio

    # Le damos la lista completa a Nav2
    navigator.followWaypoints(waypoints)

    while not navigator.isTaskComplete():
        feedback = navigator.getFeedback()
        if feedback:
            print(f'Navegando al waypoint {feedback.current_waypoint} de {len(waypoints)}')

    result = navigator.getResult()
    if result == TaskResult.SUCCEEDED:
        print('¡Patrulla completada con éxito!')
    else:
        print('Problema durante la patrulla.')

    rclpy.shutdown()

if __name__ == '__main__':
    main()
