const db = require("../config/database");

const obtenerPersonasPublicasDB = async () => {
  const sql = `
    SELECT
      p.id_persona, p.codigo, p.edad, p.sexo,
      p.discapacidad, p.rlcpd, p.tiene_cuidador, p.activo,
      u.zona, u.vereda, u.cod_sector, u.sector, u.barrio
    FROM personas_discapacidad p
    JOIN ubicaciones u ON p.id_ubicacion = u.id_ubicacion
  `;
  const [result] = await db.query(sql);
  return result;
};

const obtenerPersonasDB = async () => {
  const sql = `
    SELECT
      p.id_persona, p.codigo, p.cod_tipo_doc, t.descripcion_min,
      p.documento, p.primer_nombre, p.segundo_nombre,
      p.primer_apellido, p.segundo_apellido, p.nombre_completo,
      p.fecha_nacimiento, p.edad, p.sexo, p.discapacidad,
      p.celular, p.rlcpd, p.tiene_cuidador, p.activo,
      u.zona, u.vereda, u.cod_sector, u.sector, u.barrio, u.finca, u.direccion,
      c.cod_tipo_doc        AS cuidador_cod_tipo_doc,
      tc.descripcion_min    AS cuidador_descripcion_min,
      c.primer_nombre       AS cuidador_primer_nombre,
      c.segundo_nombre      AS cuidador_segundo_nombre,
      c.primer_apellido     AS cuidador_primer_apellido,
      c.segundo_apellido    AS cuidador_segundo_apellido,
      c.nombre_completo     AS cuidador_nombre,
      c.documento           AS cuidador_documento,
      c.fecha_nacimiento    AS cuidador_fecha_nacimiento,
      c.parentesco          AS cuidador_parentesco,
      c.celular             AS cuidador_celular,
      c.sexo                AS cuidador_sexo,
      c.edad                AS cuidador_edad
    FROM personas_discapacidad p
    JOIN ubicaciones u  ON u.id_ubicacion  = p.id_ubicacion
    LEFT JOIN ttipo_doc t  ON t.cod_tipo_doc  = p.cod_tipo_doc
    LEFT JOIN cuidadores c ON c.id_persona    = p.id_persona
    LEFT JOIN ttipo_doc tc ON tc.cod_tipo_doc = c.cod_tipo_doc
  `;
  const [result] = await db.query(sql);
  return result;
};

const crearCuidador = async (idPersona, cuidador) => {
  const [rows] = await db.query(
    `SELECT id_cuidador FROM cuidadores WHERE cod_tipo_doc = ? AND documento = ?`,
    [cuidador.cod_tipo_doc, cuidador.documento]
  );

  if (rows.length > 0) return rows[0].id_cuidador;

  const nombreCompleto = [
    cuidador.primer_nombre, cuidador.segundo_nombre,
    cuidador.primer_apellido, cuidador.segundo_apellido
  ].filter(Boolean).join(" ");

  let edad = null;
  if (cuidador.fecha_nacimiento) {
    const fechaNacimiento = new Date(cuidador.fecha_nacimiento);
    const hoy = new Date();
    edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
    const mes = hoy.getMonth() - fechaNacimiento.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNacimiento.getDate())) edad--;
  }

  const [result] = await db.query(
    `INSERT INTO cuidadores
      (id_persona, cod_tipo_doc, documento, primer_apellido, segundo_apellido,
       primer_nombre, segundo_nombre, nombre_completo, fecha_nacimiento, edad, sexo, parentesco, celular)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      idPersona,
      cuidador.cod_tipo_doc || null, cuidador.documento || null,
      cuidador.primer_apellido || null, cuidador.segundo_apellido || null,
      cuidador.primer_nombre || null, cuidador.segundo_nombre || null,
      nombreCompleto || null, cuidador.fecha_nacimiento || null,
      edad, cuidador.sexo || null, cuidador.parentesco || null, cuidador.celular || null
    ]
  );
  return result.insertId;
};

const actualizarCuidador = async (idPersona, cuidador) => {
  const [rows] = await db.query(
    `SELECT id_cuidador FROM cuidadores WHERE id_persona = ?`,
    [idPersona]
  );

  const nombreCompleto = [
    cuidador.primer_nombre, cuidador.segundo_nombre,
    cuidador.primer_apellido, cuidador.segundo_apellido
  ].filter(Boolean).join(" ");

  let edad = null;
  if (cuidador.fecha_nacimiento) {
    const fechaNacimiento = new Date(cuidador.fecha_nacimiento);
    const hoy = new Date();
    edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
    const mes = hoy.getMonth() - fechaNacimiento.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNacimiento.getDate())) edad--;
  }

  if (rows.length > 0) {
    await db.query(
      `UPDATE cuidadores SET
        cod_tipo_doc=?, documento=?, primer_nombre=?, segundo_nombre=?,
        primer_apellido=?, segundo_apellido=?, nombre_completo=?,
        fecha_nacimiento=?, edad=?, sexo=?, parentesco=?, celular=?
       WHERE id_persona=?`,
      [
        cuidador.cod_tipo_doc || null, cuidador.documento || null,
        cuidador.primer_nombre || null, cuidador.segundo_nombre || null,
        cuidador.primer_apellido || null, cuidador.segundo_apellido || null,
        nombreCompleto || null, cuidador.fecha_nacimiento || null,
        edad, cuidador.sexo || null, cuidador.parentesco || null,
        cuidador.celular || null, idPersona
      ]
    );
  } else {
    await crearCuidador(idPersona, cuidador);
  }
};

const insertarPersonaDB = async (persona) => {
  const [resultUbicacion] = await db.query(
    `INSERT INTO ubicaciones (zona, vereda, sector, direccion) VALUES (?, ?, ?, ?)`,
    [persona.zona, persona.vereda, persona.sector, persona.direccion]
  );
  const idUbicacion = resultUbicacion.insertId;

  const fechaNacimiento = new Date(persona.fecha_nacimiento);
  const hoy = new Date();
  let edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
  const mes = hoy.getMonth() - fechaNacimiento.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNacimiento.getDate())) edad--;

  const iniciales =
    (persona.primer_nombre[0] || '') + (persona.segundo_nombre[0] || '') +
    (persona.primer_apellido[0] || '') + (persona.segundo_apellido[0] || '');
  const codigo = (iniciales + persona.documento.slice(-4)).toUpperCase();
  const nombreCompleto = `${persona.primer_nombre} ${persona.segundo_nombre} ${persona.primer_apellido} ${persona.segundo_apellido}`;

  const [resultPersona] = await db.query(
    `INSERT INTO personas_discapacidad
      (codigo, rlcpd, cod_tipo_doc, documento, primer_nombre, segundo_nombre,
       primer_apellido, segundo_apellido, nombre_completo, fecha_nacimiento,
       edad, sexo, discapacidad, celular, id_ubicacion, tiene_cuidador)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      codigo, persona.rlcpd || null, persona.cod_tipo_doc, persona.documento,
      persona.primer_nombre, persona.segundo_nombre,
      persona.primer_apellido, persona.segundo_apellido,
      nombreCompleto, persona.fecha_nacimiento, edad, persona.sexo,
      persona.discapacidad, persona.celular, idUbicacion, persona.tiene_cuidador
    ]
  );
  const idPersona = resultPersona.insertId;

  if (persona.tiene_cuidador && persona.cuidador) {
    const idCuidador = await crearCuidador(idPersona, persona.cuidador);
    return { persona: resultPersona, idCuidador };
  }

  return { persona: resultPersona };
};

const editarPersonaDB = async (id, persona) => {
  await db.query(
    `UPDATE ubicaciones SET zona=?, vereda=?, sector=?, direccion=?
     WHERE id_ubicacion = (SELECT id_ubicacion FROM personas_discapacidad WHERE id_persona = ?)`,
    [persona.zona, persona.vereda, persona.sector, persona.direccion, id]
  );

  const [result] = await db.query(
    `UPDATE personas_discapacidad SET
      documento=?, primer_nombre=?, segundo_nombre=?,
      primer_apellido=?, segundo_apellido=?, fecha_nacimiento=?,
      sexo=?, discapacidad=?, celular=?, tiene_cuidador=?
     WHERE id_persona=?`,
    [
      persona.documento, persona.primer_nombre, persona.segundo_nombre,
      persona.primer_apellido, persona.segundo_apellido, persona.fecha_nacimiento,
      persona.sexo, persona.discapacidad, persona.celular, persona.tiene_cuidador, id
    ]
  );

  if (persona.tiene_cuidador && persona.cuidador) {
    await actualizarCuidador(id, persona.cuidador);
  } else {
    await db.query(`DELETE FROM cuidadores WHERE id_persona = ?`, [id]);
  }

  return result;
};

const cambiarEstadoPersonaDB = async (id, estado, razon) => {
  const razonFinal = estado === 0 ? razon : "";
  const [result] = await db.query(
    `UPDATE personas_discapacidad
     SET activo=?, razon_estado=?, fecha_modificacion=NOW()
     WHERE id_persona=?`,
    [estado, razonFinal, id]
  );
  return result;
};

const obtenerPersonaPorIdDB = async (id) => {
  const sql = `
    SELECT
      p.*, u.zona, u.vereda, u.sector, u.direccion,
      c.id_cuidador,
      c.cod_tipo_doc AS cuidador_cod_tipo_doc, c.documento AS cuidador_documento,
      c.primer_nombre AS cuidador_primer_nombre, c.segundo_nombre AS cuidador_segundo_nombre,
      c.primer_apellido AS cuidador_primer_apellido, c.segundo_apellido AS cuidador_segundo_apellido,
      c.fecha_nacimiento AS cuidador_fecha_nacimiento, c.sexo AS cuidador_sexo,
      c.parentesco AS cuidador_parentesco, c.celular AS cuidador_celular
    FROM personas_discapacidad p
    LEFT JOIN ubicaciones u ON p.id_ubicacion = u.id_ubicacion
    LEFT JOIN cuidadores c ON p.id_persona = c.id_persona
    WHERE p.id_persona = ?
  `;
  const [rows] = await db.query(sql, [id]);
  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    ...row,
    cuidador: row.id_cuidador ? {
      cod_tipo_doc:     row.cuidador_cod_tipo_doc,
      documento:        row.cuidador_documento,
      primer_nombre:    row.cuidador_primer_nombre,
      segundo_nombre:   row.cuidador_segundo_nombre,
      primer_apellido:  row.cuidador_primer_apellido,
      segundo_apellido: row.cuidador_segundo_apellido,
      fecha_nacimiento: row.cuidador_fecha_nacimiento,
      sexo:             row.cuidador_sexo,
      parentesco:       row.cuidador_parentesco,
      celular:          row.cuidador_celular
    } : null
  };
};

const buscarCuidadorPorDocumentoDB = async (documento) => {
  const [rows] = await db.query(
    `SELECT * FROM cuidadores WHERE documento = ? LIMIT 1`,
    [documento]
  );
  return rows.length > 0 ? rows[0] : null;
};

module.exports = {
  obtenerPersonasPublicasDB, obtenerPersonasDB, insertarPersonaDB,
  editarPersonaDB, cambiarEstadoPersonaDB, obtenerPersonaPorIdDB,
  buscarCuidadorPorDocumentoDB
};