-- Diseño final de BBDD - Robot de Vigilancia
-- Versión pensada para PostgreSQL / Supabase.

CREATE TABLE usuarios (
  id_usuario BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultimo_acceso TIMESTAMPTZ
);

CREATE TABLE robots (
  id_robot BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  modelo TEXT,
  estado TEXT NOT NULL DEFAULT 'desconectado',
  modo_operacion TEXT NOT NULL DEFAULT 'manual',
  ultima_conexion TIMESTAMPTZ,
  ubicacion_actual_x DOUBLE PRECISION DEFAULT 0,
  ubicacion_actual_y DOUBLE PRECISION DEFAULT 0,
  id_usuario BIGINT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE
);

CREATE TABLE detecciones (
  id_deteccion BIGSERIAL PRIMARY KEY,
  id_robot BIGINT NOT NULL REFERENCES robots(id_robot) ON DELETE CASCADE,
  tipo_deteccion TEXT NOT NULL,
  resultado TEXT,
  confianza DOUBLE PRECISION,
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  coord_x DOUBLE PRECISION,
  coord_y DOUBLE PRECISION
);

CREATE TABLE alertas (
  id_alerta BIGSERIAL PRIMARY KEY,
  id_robot BIGINT NOT NULL REFERENCES robots(id_robot) ON DELETE CASCADE,
  id_deteccion BIGINT REFERENCES detecciones(id_deteccion) ON DELETE SET NULL,
  tipo_alerta TEXT NOT NULL,
  descripcion TEXT,
  nivel TEXT,
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  coord_x DOUBLE PRECISION,
  coord_y DOUBLE PRECISION,
  estado_alerta TEXT NOT NULL DEFAULT 'pendiente'
);

CREATE TABLE conexiones_ros (
  id_conexion BIGSERIAL PRIMARY KEY,
  id_robot BIGINT NOT NULL REFERENCES robots(id_robot) ON DELETE CASCADE,
  url_websocket TEXT NOT NULL,
  estado TEXT NOT NULL,
  fecha_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_fin TIMESTAMPTZ
);

CREATE TABLE patrullas (
  id_patrulla BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  id_robot BIGINT NOT NULL REFERENCES robots(id_robot) ON DELETE CASCADE
);

CREATE TABLE puntos_patrulla (
  id_punto BIGSERIAL PRIMARY KEY,
  id_patrulla BIGINT NOT NULL REFERENCES patrullas(id_patrulla) ON DELETE CASCADE,
  orden INTEGER NOT NULL,
  coord_x DOUBLE PRECISION NOT NULL,
  coord_y DOUBLE PRECISION NOT NULL,
  coord_theta DOUBLE PRECISION DEFAULT 0,
  es_puerta BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE horarios (
  id_horario BIGSERIAL PRIMARY KEY,
  id_patrulla BIGINT NOT NULL REFERENCES patrullas(id_patrulla) ON DELETE CASCADE,
  fecha_inicio TIMESTAMPTZ NOT NULL,
  fecha_fin TIMESTAMPTZ
);

CREATE INDEX idx_robots_usuario ON robots(id_usuario);
CREATE INDEX idx_alertas_robot ON alertas(id_robot);
CREATE INDEX idx_detecciones_robot ON detecciones(id_robot);
CREATE INDEX idx_patrullas_robot ON patrullas(id_robot);
CREATE INDEX idx_puntos_patrulla ON puntos_patrulla(id_patrulla);
