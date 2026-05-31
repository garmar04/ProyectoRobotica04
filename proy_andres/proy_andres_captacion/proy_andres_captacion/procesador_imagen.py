import os
import cv2
import rclpy
from rclpy.node import Node
from sensor_msgs.msg import Image, CompressedImage
from cv_bridge import CvBridge
from std_srvs.srv import Trigger

class ProcesadorImagenNode(Node):
    def __init__(self):
        super().__init__('procesador_imagen')
        self.bridge = CvBridge()
        
        # Suscriptor a la cámara
        self.subscription = self.create_subscription(
            Image,
            '/camera/image_raw',
            self.listener_callback,
            10)
        
        # Publicador para el "flash" en la web
        self.flash_pub = self.create_publisher(
            CompressedImage,
            '/camera/processed/compressed',
            10)
        
        # Servicio para capturar y procesar una imagen
        self.srv = self.create_service(Trigger, 'capturar_y_procesar', self.capturar_callback)
        
        self.last_msg = None
        # Volver a ruta relativa
        self.save_path = 'capturas_procesadas'
        
        # Asegurar que el directorio existe (se creará relativo a donde se ejecute start.sh)
        if not os.path.exists(self.save_path):
            os.makedirs(self.save_path)
            self.get_logger().info(f'Directorio creado: {os.path.abspath(self.save_path)}')
            
        self.get_logger().info(f'Nodo Procesador iniciado. Ruta: {os.path.abspath(self.save_path)}')

    def listener_callback(self, msg):
        self.last_msg = msg

    def capturar_callback(self, request, response):
        self.get_logger().info('--- Solicitud de captura recibida ---')
        if self.last_msg is None:
            self.get_logger().warn('No hay imagen disponible todavía')
            response.success = False
            response.message = "No se ha recibido ninguna imagen de la cámara todavía."
            return response

        try:
            # Convertir imagen ROS a OpenCV
            cv_image = self.bridge.imgmsg_to_cv2(self.last_msg, "bgr8")
            
            # 1. Escala de grises
            gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
            
            # 2. Resaltar bordes (Canny)
            edges = cv2.Canny(gray, 100, 200)
            
            # 3. Crear imagen combinada (Fondo gris + Bordes en verde neón)
            # Convertimos el gris a 3 canales para poder ponerle color encima
            combined = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
            # Pintamos los píxeles donde hay bordes de color verde (B=0, G=255, R=0)
            combined[edges > 0] = [0, 255, 0]
            
            # 4. Publicar "flash" combinado para la web
            success, encoded_image = cv2.imencode('.jpg', combined)
            if success:
                flash_msg = CompressedImage()
                flash_msg.header = self.last_msg.header
                flash_msg.format = 'jpeg'
                flash_msg.data = encoded_image.tobytes()
                self.flash_pub.publish(flash_msg)
                self.get_logger().info('Flash combinado publicado en la web')
            
            # 5. Guardar las diferentes versiones
            timestamp = self.get_clock().now().to_msg().sec
            files = {
                'raw': os.path.join(self.save_path, f'raw_{timestamp}.jpg'),
                'gray': os.path.join(self.save_path, f'gray_{timestamp}.jpg'),
                'edges': os.path.join(self.save_path, f'edges_{timestamp}.jpg'),
                'combined': os.path.join(self.save_path, f'combined_{timestamp}.jpg')
            }
            
            cv2.imwrite(files['raw'], cv_image)
            cv2.imwrite(files['gray'], gray)
            cv2.imwrite(files['edges'], edges)
            cv2.imwrite(files['combined'], combined)
            
            self.get_logger().info(f'ÉXITO: 4 versiones guardadas en {self.save_path}')
            response.success = True
            response.message = f"Capturas generadas con éxito (timestamp: {timestamp})"
                
        except Exception as e:
            self.get_logger().error(f'Error procesando imagen: {str(e)}')
            response.success = False
            response.message = f"Error: {str(e)}"
            
        return response

def main(args=None):
    rclpy.init(args=args)
    node = ProcesadorImagenNode()
    rclpy.spin(node)
    rclpy.shutdown()

if __name__ == '__main__':
    main()
