import os
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration
from launch.actions import IncludeLaunchDescription, DeclareLaunchArgument, AppendEnvironmentVariable, SetEnvironmentVariable

def generate_launch_description():
    pkg_ros_gz_sim = get_package_share_directory('ros_gz_sim')
    pkg_proy_mundo = get_package_share_directory('proy_andres_mundo')
    pkg_turtlebot3_gazebo = get_package_share_directory('turtlebot3_gazebo')

    # 1. AUTO-CONFIGURAR VARIABLES DE ENTORNO
    mundo_models_path = os.path.join(pkg_proy_mundo, 'models')
    tb3_models_path = os.path.join(pkg_turtlebot3_gazebo, 'models')
    
    # Inyectamos las rutas directamente en Gazebo
    set_gz_resource_path = AppendEnvironmentVariable(
        'GZ_SIM_RESOURCE_PATH',
        f"{mundo_models_path}:{tb3_models_path}"
    )

    set_tb3_model = SetEnvironmentVariable(
        name='TURTLEBOT3_MODEL',
        value='burger'
    )

    # 2. CONFIGURACIÓN DEL TIEMPO SIMULADO
    use_sim_time = LaunchConfiguration('use_sim_time')
    declare_use_sim_time_cmd = DeclareLaunchArgument(
        'use_sim_time',
        default_value='true',
        description='Usa el reloj de Gazebo'
    )

    # 3. LANZAR GAZEBO CON EL MUNDO
    world_file = os.path.join(pkg_proy_mundo, 'worlds', 'warehouse.world')
    
    gz_sim = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            os.path.join(pkg_ros_gz_sim, 'launch', 'gz_sim.launch.py')
        ),
        launch_arguments={'gz_args': f'-r {world_file} --render-engine ogre'}.items(),
    )

    # 4. LANZAR TFs DEL ROBOT
    robot_state_publisher = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            os.path.join(pkg_turtlebot3_gazebo, 'launch', 'robot_state_publisher.launch.py')
        ),
        launch_arguments={'use_sim_time': use_sim_time}.items(),
    )

    # 5. SPAWN DEL TURTLEBOT (En una coordenada segura)
    spawn_robot = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            os.path.join(pkg_turtlebot3_gazebo, 'launch', 'spawn_turtlebot3.launch.py')
        ),
        launch_arguments={
            'x_pose': '0.0',
            'y_pose': '0.0',
            'z_pose': '0.1'
        }.items()
    )

    return LaunchDescription([
        set_gz_resource_path,
        set_tb3_model,
        declare_use_sim_time_cmd,
        gz_sim,
        robot_state_publisher,
        spawn_robot,
    ])