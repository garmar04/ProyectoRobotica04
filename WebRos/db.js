/* ============================================================
   VELARIS — Base de datos local de demostración
   Modelo implementado según el diseño ER del proyecto.

   Nota: esta implementación usa localStorage para la demo web.
   En producción estas tablas deberían estar en una BBDD real
   como PostgreSQL/Supabase, MySQL o similar.
   ============================================================ */

'use strict';

(function () {
  const DB_KEY = 'velaris_db_v1';
  const SESSION_KEY = 'velaris_session_v1';

  const emptyDB = () => ({
    usuarios: [],
    robots: [],
    alertas: [],
    detecciones: [],
    conexiones_ros: [],
    patrullas: [],
    puntos_patrulla: [],
    horarios: [],
    counters: {
      usuario: 1,
      robot: 1,
      alerta: 1,
      deteccion: 1,
      conexion: 1,
      patrulla: 1,
      punto: 1,
      horario: 1,
    },
  });

  function nowISO() {
    return new Date().toISOString();
  }

  function loadDB() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (!raw) return emptyDB();
      const parsed = JSON.parse(raw);
      return {
        ...emptyDB(),
        ...parsed,
        counters: { ...emptyDB().counters, ...(parsed.counters || {}) },
      };
    } catch (err) {
      console.error('No se pudo cargar la BBDD local:', err);
      return emptyDB();
    }
  }

  function saveDB(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

  function nextId(db, key) {
    const value = db.counters[key] || 1;
    db.counters[key] = value + 1;
    return value;
  }

  function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  // Hash simple para demo. No usar en producción.
  function hashPassword(password) {
    return btoa(unescape(encodeURIComponent(String(password || ''))));
  }

  function init() {
    const db = loadDB();

    // Usuario de prueba para poder entrar si se necesita.
    if (db.usuarios.length === 0) {
      const user = {
        id_usuario: nextId(db, 'usuario'),
        nombre: 'Cliente Demo',
        email: 'cliente@velaris.com',
        password_hash: hashPassword('12345678'),
        activo: true,
        fecha_creacion: nowISO(),
        ultimo_acceso: null,
      };
      db.usuarios.push(user);

      const robot = {
        id_robot: nextId(db, 'robot'),
        nombre: 'Robot Vigilancia 01',
        modelo: 'TurtleBot3 Burger',
        estado: 'Desconectado',
        modo_operacion: 'manual',
        ultima_conexion: null,
        ubicacion_actual_x: 0,
        ubicacion_actual_y: 0,
        id_usuario: user.id_usuario,
      };
      db.robots.push(robot);

      const patrulla = {
        id_patrulla: nextId(db, 'patrulla'),
        nombre: 'Patrulla almacén principal',
        descripcion: 'Ruta inicial de vigilancia por el entorno simulado.',
        activa: true,
        fecha_creacion: nowISO(),
        id_robot: robot.id_robot,
      };
      db.patrullas.push(patrulla);

      db.puntos_patrulla.push(
        { id_punto: nextId(db, 'punto'), id_patrulla: patrulla.id_patrulla, orden: 1, coord_x: -7.0, coord_y: 4.0, coord_theta: 0, es_puerta: false },
        { id_punto: nextId(db, 'punto'), id_patrulla: patrulla.id_patrulla, orden: 2, coord_x: -7.0, coord_y: -4.0, coord_theta: 0, es_puerta: false },
        { id_punto: nextId(db, 'punto'), id_patrulla: patrulla.id_patrulla, orden: 3, coord_x: 0.5, coord_y: -7.0, coord_theta: 1.57, es_puerta: true }, // Puerta
        { id_punto: nextId(db, 'punto'), id_patrulla: patrulla.id_patrulla, orden: 4, coord_x: 7.0, coord_y: 4.0, coord_theta: 0, es_puerta: false }
      );

      db.horarios.push({
        id_horario: nextId(db, 'horario'),
        id_patrulla: patrulla.id_patrulla,
        fecha_inicio: nowISO(),
        fecha_fin: null,
      });

      saveDB(db);
    }

    return db;
  }

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    } catch {
      return null;
    }
  }

  function setSession(session) {
    if (!session) localStorage.removeItem(SESSION_KEY);
    else localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function createUser({ nombre, email, password }) {
    const db = init();
    const cleanEmail = normalizeEmail(email);

    if (db.usuarios.some(u => normalizeEmail(u.email) === cleanEmail)) {
      throw new Error('Ya existe una cuenta con ese correo electrónico.');
    }

    const user = {
      id_usuario: nextId(db, 'usuario'),
      nombre: String(nombre || '').trim(),
      email: cleanEmail,
      password_hash: hashPassword(password),
      activo: true,
      fecha_creacion: nowISO(),
      ultimo_acceso: null,
    };
    db.usuarios.push(user);

    // Cada cuenta nueva recibe un robot base para poder probar la web.
    const robot = {
      id_robot: nextId(db, 'robot'),
      nombre: 'Robot Vigilancia ' + String(user.id_usuario).padStart(2, '0'),
      modelo: 'TurtleBot3 Burger',
      estado: 'Desconectado',
      modo_operacion: 'manual',
      ultima_conexion: null,
      ubicacion_actual_x: 0,
      ubicacion_actual_y: 0,
      id_usuario: user.id_usuario,
    };
    db.robots.push(robot);

    const patrulla = {
      id_patrulla: nextId(db, 'patrulla'),
      nombre: 'Patrulla inicial',
      descripcion: 'Ruta por defecto del robot.',
      activa: true,
      fecha_creacion: nowISO(),
      id_robot: robot.id_robot,
    };
    db.patrullas.push(patrulla);

    db.puntos_patrulla.push(
      { id_punto: nextId(db, 'punto'), id_patrulla: patrulla.id_patrulla, orden: 1, coord_x: 0, coord_y: 0, coord_theta: 0, es_puerta: false },
      { id_punto: nextId(db, 'punto'), id_patrulla: patrulla.id_patrulla, orden: 2, coord_x: 1.5, coord_y: 0, coord_theta: 0, es_puerta: false },
      { id_punto: nextId(db, 'punto'), id_patrulla: patrulla.id_patrulla, orden: 3, coord_x: 1.5, coord_y: 1.5, coord_theta: 1.57, es_puerta: true }
    );

    saveDB(db);
    return user;
  }

  function login(email, password) {
    const db = init();
    const cleanEmail = normalizeEmail(email);
    const user = db.usuarios.find(u => normalizeEmail(u.email) === cleanEmail && u.password_hash === hashPassword(password) && u.activo);
    if (!user) return null;

    user.ultimo_acceso = nowISO();
    saveDB(db);

    setSession({ id_usuario: user.id_usuario, email: user.email, login_at: nowISO() });
    return user;
  }

  function logout() {
    setSession(null);
  }

  function getCurrentUser() {
    const session = getSession();
    if (!session) return null;
    const db = init();
    return db.usuarios.find(u => u.id_usuario === session.id_usuario) || null;
  }

  function getRobotsForCurrentUser() {
    const user = getCurrentUser();
    if (!user) return [];
    const db = init();
    return db.robots.filter(r => r.id_usuario === user.id_usuario);
  }

  function getSelectedRobot() {
    const robots = getRobotsForCurrentUser();
    if (robots.length === 0) return null;
    const saved = Number(localStorage.getItem('velaris_selected_robot_id'));
    return robots.find(r => r.id_robot === saved) || robots[0];
  }

  function setSelectedRobot(id_robot) {
    localStorage.setItem('velaris_selected_robot_id', String(id_robot));
  }

  function updateRobot(id_robot, fields) {
    const db = init();
    const robot = db.robots.find(r => r.id_robot === Number(id_robot));
    if (!robot) return null;
    Object.assign(robot, fields || {});
    saveDB(db);
    return robot;
  }

  function createConnection({ id_robot, url_websocket, estado }) {
    const db = init();
    const conexion = {
      id_conexion: nextId(db, 'conexion'),
      id_robot: Number(id_robot),
      url_websocket,
      estado,
      fecha_inicio: nowISO(),
      fecha_fin: null,
    };
    db.conexiones_ros.push(conexion);
    saveDB(db);
    return conexion;
  }

  function closeLastConnection(id_robot, estado) {
    const db = init();
    const conexiones = db.conexiones_ros
      .filter(c => c.id_robot === Number(id_robot) && c.fecha_fin === null)
      .sort((a, b) => b.id_conexion - a.id_conexion);
    if (conexiones[0]) {
      conexiones[0].estado = estado || 'Cerrada';
      conexiones[0].fecha_fin = nowISO();
      saveDB(db);
      return conexiones[0];
    }
    return null;
  }

  function updateRobotPosition(id_robot, x, y) {
    return updateRobot(id_robot, {
      ubicacion_actual_x: Number(x || 0),
      ubicacion_actual_y: Number(y || 0),
    });
  }

  function createDetection({ id_robot, tipo_deteccion, resultado, confianza, coord_x, coord_y }) {
    const db = init();
    const deteccion = {
      id_deteccion: nextId(db, 'deteccion'),
      id_robot: Number(id_robot),
      tipo_deteccion: tipo_deteccion || 'evento',
      resultado: resultado || 'detectado',
      confianza: Number(confianza ?? 1),
      fecha_hora: nowISO(),
      coord_x: Number(coord_x || 0),
      coord_y: Number(coord_y || 0),
    };
    db.detecciones.push(deteccion);
    saveDB(db);
    return deteccion;
  }

  function createAlert({ id_robot, id_deteccion, tipo_alerta, descripcion, nivel, coord_x, coord_y, ruta_imagen }) {
    const db = init();
    
    const numRobot = Number(id_robot);
    const cx = Number(coord_x || 0);
    const cy = Number(coord_y || 0);
    const type = tipo_alerta || 'seguridad';

    const duplicateIndex = db.alertas.findIndex(a => {
      if (a.estado_alerta !== 'pendiente' || a.id_robot !== numRobot || a.tipo_alerta !== type) {
        return false;
      }
      const distance = Math.sqrt(Math.pow(a.coord_x - cx, 2) + Math.pow(a.coord_y - cy, 2));
      return distance < 0.2;
    });

    if (duplicateIndex !== -1) {
      const oldAlert = db.alertas[duplicateIndex];
      const newId = nextId(db, 'alerta');
      
      db.alertas[duplicateIndex] = {
        ...oldAlert,
        id_alerta: newId,
        id_deteccion: id_deteccion ? Number(id_deteccion) : oldAlert.id_deteccion,
        descripcion: descripcion || oldAlert.descripcion,
        nivel: nivel || oldAlert.nivel,
        fecha_hora: nowISO(),
        coord_x: cx,
        coord_y: cy,
        ruta_imagen: ruta_imagen || oldAlert.ruta_imagen
      };
      
      saveDB(db);
      return db.alertas[duplicateIndex];
    } else {
      const alerta = {
        id_alerta: nextId(db, 'alerta'),
        id_robot: numRobot,
        id_deteccion: id_deteccion ? Number(id_deteccion) : null,
        tipo_alerta: type,
        descripcion: descripcion || 'Alerta generada por el robot',
        nivel: nivel || 'media',
        fecha_hora: nowISO(),
        coord_x: cx,
        coord_y: cy,
        ruta_imagen: ruta_imagen || null,
        estado_alerta: 'pendiente',
      };
      db.alertas.push(alerta);
      saveDB(db);
      return alerta;
    }
  }

  function getDataForCurrentUser() {
    const db = init();
    const user = getCurrentUser();
    if (!user) return { user: null, robots: [], alertas: [], detecciones: [], conexiones_ros: [], patrullas: [], puntos_patrulla: [], horarios: [] };

    const robots = db.robots.filter(r => r.id_usuario === user.id_usuario);
    const robotIds = robots.map(r => r.id_robot);
    const patrullas = db.patrullas.filter(p => robotIds.includes(p.id_robot));
    const patrullaIds = patrullas.map(p => p.id_patrulla);

    return {
      user,
      robots,
      alertas: db.alertas.filter(a => robotIds.includes(a.id_robot)),
      detecciones: db.detecciones.filter(d => robotIds.includes(d.id_robot)),
      conexiones_ros: db.conexiones_ros.filter(c => robotIds.includes(c.id_robot)),
      patrullas,
      puntos_patrulla: db.puntos_patrulla.filter(p => patrullaIds.includes(p.id_patrulla)),
      horarios: db.horarios.filter(h => patrullaIds.includes(h.id_patrulla)),
    };
  }

  function clearDemoData() {
    localStorage.removeItem(DB_KEY);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('velaris_selected_robot_id');
    init();
  }

  function updateAlertState(id_alerta, estado_alerta) {
    const db = loadDB();
    const alert = db.alertas.find(a => a.id_alerta === id_alerta);
    if (alert) {
      alert.estado_alerta = estado_alerta;
      saveDB(db);
      return true;
    }
    return false;
  }

  window.VelarisDB = {
    init,
    loadDB,
    saveDB,
    createUser,
    login,
    logout,
    getCurrentUser,
    getRobotsForCurrentUser,
    getSelectedRobot,
    setSelectedRobot,
    updateRobot,
    updateRobotPosition,
    createConnection,
    closeLastConnection,
    createDetection,
    createAlert,
    updateAlertState,
    getDataForCurrentUser,
    clearDemoData,
  };

  init();
})();
