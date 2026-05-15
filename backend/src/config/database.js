const mysql = require("mysql2");
const dotenv = require("dotenv");
dotenv.config();

// Pool en vez de createConnection — se reconecta solo
const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port:     process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

// Verificar que la conexión funciona al arrancar
pool.getConnection((err, connection) => {
  if (err) {
    console.error("Error conexion MySQL:", err);
    return;
  }
  console.log("Conectado a MySQL");
  connection.release(); // ← importante: devolver la conexión al pool
});

module.exports = pool.promise();