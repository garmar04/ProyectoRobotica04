#include <rclcpp/rclcpp.hpp>
#include <geometry_msgs/msg/twist_stamped.hpp>
#include <termios.h>
#include <unistd.h>
#include <thread>
#include <atomic>
#include <algorithm>

int kfd = 0;
struct termios cooked;

void setupKeyboard() {
  tcgetattr(kfd, &cooked);
  struct termios raw_temp;
  memcpy(&raw_temp, &cooked, sizeof(struct termios));
  raw_temp.c_lflag &=~ (ICANON | ECHO);
  raw_temp.c_cc[VMIN] = 1;
  raw_temp.c_cc[VTIME] = 0;
  tcsetattr(kfd, TCSANOW, &raw_temp);
}

void restoreKeyboard() {
  tcsetattr(kfd, TCSANOW, &cooked);
}

class SmoothTeleop : public rclcpp::Node {
public:
  SmoothTeleop() : Node("smooth_teleop") {
    max_linear_ = 1.22;
    max_angular_ = 0.6;

    accel_linear_ = 0.5;
    accel_angular_ = 1.5;

    target_linear_ = 0.0;
    target_angular_ = 0.0;
    current_linear_ = 0.0;
    current_angular_ = 0.0;

    twist_pub_ = this->create_publisher<geometry_msgs::msg::TwistStamped>("cmd_vel", 10);
    timer_ = this->create_wall_timer(std::chrono::milliseconds(50), std::bind(&SmoothTeleop::controlLoop, this));

    last_key_time_ = this->now();
    running_ = true;
    key_thread_ = std::thread(&SmoothTeleop::keyLoop, this);

    puts("Reading from keyboard (COMBO DRIVE MODE)");
    puts("-----------------------------------------");
    puts("W/S: Forward/Back | A/D: Turn Left/Right");
    puts("Espacio: Freno de emergencia");
    puts("Press 'q' to quit.");
  }

  ~SmoothTeleop() {
    running_ = false;
    if (key_thread_.joinable()) key_thread_.join();
  }

private:
  void keyLoop() {
    char c;
    while (running_ && rclcpp::ok()) {
      if (read(kfd, &c, 1) > 0) {
        last_key_time_ = this->now();
        switch(c) {
          case 'w': case 'W': 
            target_linear_ = max_linear_; 
            break;
          case 's': case 'S': 
            target_linear_ = -max_linear_; 
            break;
          case 'a': case 'A': 
            target_angular_ = max_angular_; 
            break;
          case 'd': case 'D': 
            target_angular_ = -max_angular_; 
            break;
          case ' ': // NUEVO: Freno inmediato
            target_linear_ = 0.0;
            target_angular_ = 0.0;
            current_linear_ = 0.0; 
            current_angular_ = 0.0;
            break;
          case 'q': case 'Q': 
            restoreKeyboard(); rclcpp::shutdown(); exit(0); break;
        }
      }
    }
  }

  void controlLoop() {
    // CORRECCIÓN 2: Reducido el delay de 0.6s a 0.15s para que frene rápido al soltar
    if ((this->now() - last_key_time_).seconds() > 0.15) {
      target_linear_ = 0.0;
      target_angular_ = 0.0;
    }

    double dt = 0.05; 
    
    current_linear_ = smoothDato(current_linear_, target_linear_, accel_linear_ * dt);
    current_angular_ = smoothDato(current_angular_, target_angular_, accel_angular_ * dt);

    geometry_msgs::msg::TwistStamped msg;
    msg.header.stamp = this->get_clock()->now();
    msg.header.frame_id = "base_link";
    msg.twist.linear.x = current_linear_;
    msg.twist.angular.z = current_angular_;
    twist_pub_->publish(msg);
  }

  double smoothDato(double current, double target, double step) {
    if (current < target) return std::min(current + step, target);
    if (current > target) return std::max(current - step, target);
    return current;
  }

  rclcpp::Publisher<geometry_msgs::msg::TwistStamped>::SharedPtr twist_pub_;
  rclcpp::TimerBase::SharedPtr timer_;
  rclcpp::Time last_key_time_;
  std::thread key_thread_;
  std::atomic<bool> running_;
  double max_linear_, max_angular_, accel_linear_, accel_angular_;
  std::atomic<double> target_linear_, target_angular_;
  double current_linear_, current_angular_;
};

int main(int argc, char** argv) {
  rclcpp::init(argc, argv);
  setupKeyboard();
  auto node = std::make_shared<SmoothTeleop>();
  rclcpp::spin(node);
  restoreKeyboard();
  return 0;
}