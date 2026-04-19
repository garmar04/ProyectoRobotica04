from setuptools import find_packages, setup

package_name = 'proy_andres_nav_ruta'

setup(
    name=package_name,
    version='0.0.0',
    packages=find_packages(exclude=['test']),
    data_files=[
        ('share/ament_index/resource_index/packages',
            ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='andres',
    maintainer_email='acatmar@epsg.upv.es',
    description='TODO: Package description',
    license='TODO: License declaration',
    extras_require={
        'test': [
            'pytest',
        ],
    },
    entry_points={
        'console_scripts':[
            'patrullar = proy_andres_nav_ruta.patrullar:main',
            'patrulla_bridge = proy_andres_nav_ruta.patrulla_bridge:main'
        ],
    },
)
