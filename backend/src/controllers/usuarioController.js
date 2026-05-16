// bcrypt es una libreria de hashing de contrasenas.
// "Hashear" significa convertir una contrasena en una cadena irreversible.
// Nunca se guarda la contrasena original en la base de datos, solo el hash.
// crypto es un modulo nativo de Node: genera tokens aleatorios seguros
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { Resend } = require("resend");

const {
  loginUsuario, crearAdminDB, cambiarEstadoAdminDB, editarAdminDB,
  obtenerAdminPorIdDB, obtenerAdminsDB,
  guardarTokenRecuperacionDB, buscarPorTokenRecuperacionDB, actualizarPasswordDB
} = require("../models/usuarioModel");
// ─────────────────────────────────────────────────────────────────────────────
// LOGIN
// POST /api/usuarios/login
// Recibe email y password, verifica las credenciales y devuelve un token JWT.
// ─────────────────────────────────────────────────────────────────────────────
const login = async (req, res) => {
  // Desestructuramos solo los campos que necesitamos del cuerpo de la peticion
  const { email, password } = req.body;

  try {
    // Busca en la base de datos si existe un usuario con ese email.
    // Retorna un array; si esta vacio, el usuario no existe.
    const result = await loginUsuario(email);

    if (result.length === 0) {
      // Usamos el mismo mensaje para usuario inexistente y contrasena incorrecta.
      // Dar mensajes distintos ayudaria a un atacante a saber si el email existe.
      return res.status(401).json({ mensaje: "Usuario o contrasena incorrectos" });
    }

    const usuario = result[0];

    // bcrypt.compare() toma la contrasena que escribio el usuario y el hash guardado en BD.
    // Internamente aplica el mismo algoritmo y compara los resultados.
    // Retorna true si coinciden, false si no. NUNCA descifra el hash guardado.
    const passwordValido = await bcrypt.compare(password, usuario.password);

    if (!passwordValido) {
      return res.status(401).json({ mensaje: "Usuario o contrasena incorrectos" });
    }

    // jwt.sign() genera el token con tres argumentos:
    //   1. payload: datos que queremos guardar dentro del token (se pueden leer pero no modificar)
    //   2. secret:  clave secreta para firmar el token (guardada en .env, nunca en el codigo)
    //   3. options: configuracion, expiresIn define cuanto tiempo es valido el token
    const token = jwt.sign(
      { id_usuario: usuario.id_usuario, email: usuario.email, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: "8h" } // El token expira en 8 horas; el usuario debera volver a hacer login
    );

    // Enviamos el token y los datos del usuario al frontend.
    // El frontend guarda el token en localStorage y lo envia en cada peticion siguiente.
    // NUNCA incluimos la contrasena en la respuesta.
    res.json({
      mensaje: "Login exitoso",
      token,
      usuario: {
        id_usuario: usuario.id_usuario,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error en el servidor" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CREAR ADMINISTRADOR
// POST /api/usuarios
// Crea un nuevo usuario con rol 'admin'. Requiere token (ruta privada).
// ─────────────────────────────────────────────────────────────────────────────
const crearAdmin = async (req, res) => {
  try {
    const { nombre, email, password } = req.body;

    // Validaciones basicas antes de tocar la base de datos
    if (!nombre || !email || !password) {
      return res.status(400).json({ mensaje: "Todos los campos son obligatorios" });
    }

    if (password.length < 6) {
      return res.status(400).json({ mensaje: "La contrasena debe tener minimo 6 caracteres" });
    }

    // bcrypt.hash() convierte la contrasena a un hash de forma irreversible.
    // El numero 10 es el "factor de costo" (salt rounds): cuanto mas alto, mas lento pero mas seguro.
    // Un factor de 10 es el estandar recomendado para aplicaciones web.
    const hashedPassword = await bcrypt.hash(password, 10);

    const nuevoUsuario = { nombre, email, password: hashedPassword };
    const resultado = await crearAdminDB(nuevoUsuario);

    res.status(201).json({
      mensaje: "Administrador creado correctamente",
      id: resultado.insertId // insertId es el ID auto-generado por MySQL para el nuevo registro
    });

  } catch (error) {
    console.error(error);

    // ER_DUP_ENTRY es el codigo de error de MySQL cuando se intenta insertar un valor
    // duplicado en una columna con restriccion UNIQUE (como el email).
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ mensaje: "El correo ya esta registrado" });
    }

    res.status(500).json({ mensaje: "Error al crear administrador" });
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// OBTENER TODOS LOS ADMINISTRADORES
// GET /api/usuarios
// ─────────────────────────────────────────────────────────────────────────────
const obtenerAdmins = async (req, res) => {
  try {
    const admins = await obtenerAdminsDB();
    res.json(admins);
  } catch (error) {
    res.status(500).json({ mensaje: "Error obteniendo administradores" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CAMBIAR ESTADO DE UN ADMINISTRADOR
// PATCH /api/usuarios/:id/estado
// Activa (estado=1) o inactiva (estado=0) un administrador.
// ─────────────────────────────────────────────────────────────────────────────
const cambiarEstadoAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    await cambiarEstadoAdminDB(id, estado);
    res.json({ mensaje: "Estado actualizado" });

  } catch (error) {
    console.error("ERROR CAMBIAR ESTADO:", error);
    res.status(500).json({ mensaje: "Error en el servidor" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// EDITAR ADMINISTRADOR
// PUT /api/usuarios/:id
// Actualiza nombre, email y opcionalmente la contrasena.
// ─────────────────────────────────────────────────────────────────────────────
const editarAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email, password } = req.body;

    // Siempre se actualiza nombre y email
    let usuarioActualizado = { nombre, email };

    // La contrasena es opcional: solo se actualiza si el usuario escribio una nueva.
    // Si no se envia password, el campo existente en la BD no se toca.
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      usuarioActualizado.password = hashedPassword;
    }

    await editarAdminDB(id, usuarioActualizado);
    res.json({ mensaje: "Administrador actualizado correctamente" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al actualizar administrador" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// OBTENER ADMINISTRADOR POR ID
// GET /api/usuarios/:id
// ─────────────────────────────────────────────────────────────────────────────
const obtenerAdminPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const admin = await obtenerAdminPorIdDB(id);

    if (!admin) {
      return res.status(404).json({ mensaje: "Administrador no encontrado" });
    }

    res.json(admin);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error obteniendo administrador" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SOLICITAR RECUPERACION DE CONTRASEÑA
// POST /api/usuarios/recuperar-contrasena
// Genera un token temporal y envia el enlace al email del usuario.
// ─────────────────────────────────────────────────────────────────────────────
const recuperarContrasena = async (req, res) => {
  const { email } = req.body;

  console.log("📨 [recuperarContrasena] Solicitud recibida");
  console.log("📧 Email recibido:", email);
  console.log("🔑 BREVO_USER:", process.env.BREVO_USER ? "✅ definida" : "❌ no definida");
  console.log("🔑 BREVO_PASS:", process.env.BREVO_PASS ? "✅ definida" : "❌ no definida");
  console.log("🌐 FRONTEND_URL:", process.env.FRONTEND_URL);

  try {
    console.log("🔍 Buscando usuario en la base de datos...");
    const result = await loginUsuario(email);
    console.log("📊 Resultado DB:", result.length > 0 ? `Usuario encontrado (id: ${result[0].id_usuario})` : "Usuario NO encontrado");

    if (result.length === 0) {
      console.log("⚠️ Email no existe, respondiendo con mensaje genérico");
      return res.json({ mensaje: "Si el correo existe, recibirás un enlace." });
    }

    console.log("🎲 Generando token...");
    const token = crypto.randomBytes(32).toString("hex");
    const expiracion = new Date(Date.now() + 60 * 60 * 1000);
    console.log("✅ Token generado:", token.substring(0, 10) + "...");
    console.log("⏰ Expira:", expiracion);

    console.log("💾 Guardando token en base de datos...");
    await guardarTokenRecuperacionDB(email, token, expiracion);
    console.log("✅ Token guardado en DB");

    const enlace = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    console.log("🔗 Enlace generado:", enlace);

    console.log("📮 Creando transporter con Brevo...");
    const transporter = nodemailer.createTransport({
      host: process.env.BREVO_HOST,
      port: Number(process.env.BREVO_PORT),
      secure: false,
      auth: {
        user: process.env.BREVO_USER,
        pass: process.env.BREVO_PASS
      }
    });

    console.log("📤 Enviando correo a:", email);
    const info = await transporter.sendMail({
      from: `"Soporte" <${process.env.BREVO_USER}>`,
      to: email,
      subject: "Recuperar contraseña",
      html: `
        <p>Recibimos una solicitud para restablecer tu contraseña.</p>
        <p>Haz clic en el siguiente enlace (válido por 1 hora):</p>
        <a href="${enlace}">${enlace}</a>
        <p>Si no solicitaste esto, ignora este correo.</p>
      `
    });

    console.log("✅ Correo enviado. MessageId:", info.messageId);
    res.json({ mensaje: "Si el correo existe, recibirás un enlace." });

  } catch (error) {
    console.error("❌ ERROR en recuperarContrasena:");
    console.error("   Mensaje:", error.message);
    console.error("   Código:", error.code);
    console.error("   Stack:", error.stack);
    res.status(500).json({ mensaje: "Error al procesar la solicitud" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// RESETEAR CONTRASEÑA
// POST /api/usuarios/reset-password
// Recibe el token del enlace y la nueva contrasena, y la actualiza en la BD.
// ─────────────────────────────────────────────────────────────────────────────
const resetPassword = async (req, res) => {
  const { token, nuevaPassword } = req.body;
  try {
    // Busca el usuario que tenga ese token Y que no haya expirado
    const usuario = await buscarPorTokenRecuperacionDB(token);
    if (!usuario) {
      return res.status(400).json({ mensaje: "El enlace es inválido o ya expiró." });
    }

    if (nuevaPassword.length < 6) {
      return res.status(400).json({ mensaje: "La contraseña debe tener mínimo 6 caracteres." });
    }

    const hashedPassword = await bcrypt.hash(nuevaPassword, 10);
    await actualizarPasswordDB(usuario.id_usuario, hashedPassword);

    res.json({ mensaje: "Contraseña actualizada correctamente." });

  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al resetear la contraseña" });
  }
};

// Exportamos todas las funciones para que el archivo de rutas pueda usarlas.
module.exports = {
  login, crearAdmin, cambiarEstadoAdmin, obtenerAdmins, editarAdmin,
  obtenerAdminPorId, recuperarContrasena, resetPassword
};