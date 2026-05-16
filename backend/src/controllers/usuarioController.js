const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const SibApiV3Sdk = require("sib-api-v3-sdk");

const {
  loginUsuario, crearAdminDB, cambiarEstadoAdminDB, editarAdminDB,
  obtenerAdminPorIdDB, obtenerAdminsDB,
  guardarTokenRecuperacionDB, buscarPorTokenRecuperacionDB, actualizarPasswordDB
} = require("../models/usuarioModel");

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN
// POST /api/usuarios/login
// ─────────────────────────────────────────────────────────────────────────────
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await loginUsuario(email);

    if (result.length === 0) {
      return res.status(401).json({ mensaje: "Usuario o contrasena incorrectos" });
    }

    const usuario = result[0];
    const passwordValido = await bcrypt.compare(password, usuario.password);

    if (!passwordValido) {
      return res.status(401).json({ mensaje: "Usuario o contrasena incorrectos" });
    }

    const token = jwt.sign(
      { id_usuario: usuario.id_usuario, email: usuario.email, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

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
// ─────────────────────────────────────────────────────────────────────────────
const crearAdmin = async (req, res) => {
  try {
    const { nombre, email, password } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ mensaje: "Todos los campos son obligatorios" });
    }

    if (password.length < 6) {
      return res.status(400).json({ mensaje: "La contrasena debe tener minimo 6 caracteres" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const nuevoUsuario = { nombre, email, password: hashedPassword };
    const resultado = await crearAdminDB(nuevoUsuario);

    res.status(201).json({
      mensaje: "Administrador creado correctamente",
      id: resultado.insertId
    });

  } catch (error) {
    console.error(error);
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
// ─────────────────────────────────────────────────────────────────────────────
const editarAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email, password } = req.body;

    let usuarioActualizado = { nombre, email };

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
// ─────────────────────────────────────────────────────────────────────────────
const recuperarContrasena = async (req, res) => {
  const { email } = req.body;

  console.log("📨 [recuperarContrasena] Solicitud recibida");
  console.log("📧 Email recibido:", email);
  console.log("🔑 BREVO_API_KEY:", process.env.BREVO_API_KEY ? "✅ definida" : "❌ no definida");
  console.log("📨 BREVO_FROM:", process.env.BREVO_FROM);
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

    console.log("📮 Enviando correo con Brevo API...");
    const client = SibApiV3Sdk.ApiClient.instance;
    client.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;

    const emailApi = new SibApiV3Sdk.TransactionalEmailsApi();
    const respuesta = await emailApi.sendTransacEmail({
      sender: { name: "Soporte Aratoca", email: process.env.BREVO_FROM },
      to: [{ email }],
      subject: "Recuperar contraseña",
      htmlContent: `
    <p>Recibimos una solicitud para restablecer tu contraseña.</p>
    <p>Haz clic en el siguiente enlace (válido por 1 hora):</p>
    <a href="${enlace}">${enlace}</a>
    <p>Si no solicitaste esto, ignora este correo.</p>
    `
    });

    console.log("✅ Correo enviado. MessageId:", respuesta.messageId);
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
// ─────────────────────────────────────────────────────────────────────────────
const resetPassword = async (req, res) => {
  const { token, nuevaPassword } = req.body;
  try {
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

module.exports = {
  login, crearAdmin, cambiarEstadoAdmin, obtenerAdmins, editarAdmin,
  obtenerAdminPorId, recuperarContrasena, resetPassword
};