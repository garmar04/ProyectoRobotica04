import os
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import IncludeLaunchDescription, DeclareLaunchArgument
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration

def generate_launch_description():
    pkg_ros_gz_sim = get_package_share_directory('ros_gz_sim')
    pkg_proy_mundo = get_package_share_directory('proy_andres_mundo')
    pkg_turtlebot3_gazebo = get_package_share_directory('turtlebot3_gazebo')

    # Variable para usar el tiempo de simulación por defecto
    use_sim_time = LaunchConfiguration('use_sim_time')

    # Declarar el argumento para que pueda ser modificado desde terminal si se desea, 
    # pero por defecto será 'true'
    declare_use_sim_time_cmd = DeclareLaunchArgument(
        'use_sim_time',
        default_value='true',
        description='Usa el reloj de la simulacion (Gazebo) en vez del reloj del sistema'
    )

    # Ruta al archivo del mundo
    world_file = os.path.join(pkg_proy_mundo, 'worlds', 'warehouse.world')

    # Incluir el simulador Gazebo
    gz_sim = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            os.path.join(pkg_ros_gz_sim, 'launch', 'gz_sim.launch.py')
        ),
        launch_arguments={'gz_args': f'-r {world_file}'}.items(),
    )

    # Lanzar el robot_state_publisher (esto soluciona el problema de las TFs y RViz)
    robot_state_publisher = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            os.path.join(pkg_turtlebot3_gazebo, 'launch', 'robot_state_publisher.launch.py')
        ),
        launch_arguments={'use_sim_time': use_sim_time}.items(),
    )

    # Lanzar el robot TurtleBot3 (esto llama al spawn oficial)
    spawn_robot = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            os.path.join(pkg_turtlebot3_gazebo, 'launch', 'spawn_turtlebot3.launch.py')
        )
    )

    return LaunchDescription([
        declare_use_sim_time_cmd,
        gz_sim,
        robot_state_publisher,
        spawn_robot,
    ])