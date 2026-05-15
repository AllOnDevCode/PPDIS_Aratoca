const db = require("../config/database");

const loginUsuario = async (email) => {
  const [result] = await db.query("SELECT * FROM usuarios WHERE email = ?", [email]);
  return result;
};

const crearAdminDB = async (usuario) => {
  const [result] = await db.query(
    `INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, 'admin')`,
    [usuario.nombre, usuario.email, usuario.password]
  );
  return result;
};

const obtenerAdminsDB = async () => {
  const [result] = await db.query(
    `SELECT id_usuario, nombre, email, estado FROM usuarios WHERE rol = 'admin'`
  );
  return result;
};

const cambiarEstadoAdminDB = async (id, estado) => {
  const [result] = await db.query(
    "UPDATE usuarios SET estado = ? WHERE id_usuario = ?",
    [estado, id]
  );
  return result;
};

const editarAdminDB = async (id, usuario) => {
  const sql = `
    UPDATE usuarios
    SET nombre = ?, email = ?
    ${usuario.password ? ", password = ?" : ""}
    WHERE id_usuario = ?
  `;
  const params = usuario.password
    ? [usuario.nombre, usuario.email, usuario.password, id]
    : [usuario.nombre, usuario.email, id];

  const [result] = await db.query(sql, params);
  return result;
};

const obtenerAdminPorIdDB = async (id) => {
  const [rows] = await db.query(
    "SELECT id_usuario, nombre, email FROM usuarios WHERE id_usuario = ?",
    [id]
  );
  return rows[0];
};

const guardarTokenRecuperacionDB = async (email, token, expiracion) => {
  const [result] = await db.query(
    `UPDATE usuarios SET reset_token = ?, reset_token_expira = ? WHERE email = ?`,
    [token, expiracion, email]
  );
  return result;
};

const buscarPorTokenRecuperacionDB = async (token) => {
  const [rows] = await db.query(
    `SELECT id_usuario, email FROM usuarios WHERE reset_token = ? AND reset_token_expira > ?`,
    [token, new Date()]
  );
  return rows[0];
};

const actualizarPasswordDB = async (id, hashedPassword) => {
  const [result] = await db.query(
    `UPDATE usuarios SET password = ?, reset_token = NULL, reset_token_expira = NULL WHERE id_usuario = ?`,
    [hashedPassword, id]
  );
  return result;
};

module.exports = {
  loginUsuario, crearAdminDB, cambiarEstadoAdminDB, obtenerAdminsDB,
  editarAdminDB, obtenerAdminPorIdDB,
  guardarTokenRecuperacionDB, buscarPorTokenRecuperacionDB, actualizarPasswordDB
};