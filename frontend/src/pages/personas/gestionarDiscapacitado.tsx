import { useEffect, useState } from "react";
import Sidebar from "../../components/sidebar";
import { useNavigate } from "react-router-dom";
import { obtenerPersonas, cambiarEstado } from "../../services/personService";
import type { Persona } from "../../types/person";
import "../../styles/dashboard.css";

export default function EditarDiscapacitado() {

  const navigate = useNavigate();

  // Lista completa de personas cargada desde el backend
  const [personas, setPersonas] = useState<Persona[]>([]);
  // Texto del campo de busqueda
  const [busqueda, setBusqueda] = useState("");
  // Persona sobre la que se hizo clic para abrir el modal
  const [personaSeleccionada, setPersonaSeleccionada] = useState<Persona | null>(null);
  // Controla si el modal de confirmacion es visible
  const [mostrarModal, setMostrarModal] = useState(false);
  // Razon de inactivacion que escribe el usuario en el textarea del modal
  const [razon, setRazon] = useState("");
  // Mensaje de retroalimentacion (exito o error)
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState<"success" | "error">("success");

  // Se ejecuta una sola vez al cargar el componente para traer las personas del backend
  useEffect(() => {
    cargarPersonas();
  }, []);

  const cargarPersonas = async () => {
    try {
      const data = await obtenerPersonas();
      setPersonas(data);
    } catch (error) {
      console.error(error);
    }
  }

  // Normaliza un texto para comparar: minusculas y sin tildes (ej: "Gómez" -> "gomez")
  const normalizar = (texto: string) =>
    texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  // Filtra por documento o por nombres y apellidos.
  // El texto se divide en palabras y cada palabra debe aparecer en el documento
  // o en algun nombre/apellido, asi "juan perez" o "perez juan" encuentran a "Juan Carlos Perez Gomez".
  const palabrasBusqueda = normalizar(busqueda).split(/\s+/).filter(Boolean);
  const personasFiltradas = personas.filter((p) => {
    const textoPersona = normalizar(
      [
        p.documento,
        p.primer_nombre,
        p.segundo_nombre,
        p.primer_apellido,
        p.segundo_apellido,
        p.nombre_completo,
      ].filter(Boolean).join(" ")
    );
    return palabrasBusqueda.every((palabra) => textoPersona.includes(palabra));
  });

  const abrirModal = (persona: Persona) => {
    setPersonaSeleccionada(persona);
    setMostrarModal(true);
  };

  const confirmarCambioEstado = async () => {
    if (!personaSeleccionada) return;

    // Determina si la accion es inactivar (activo=1) o activar (activo=0)
    const esInactivar = personaSeleccionada.activo === 1;

    // Si va a inactivar, la razon es obligatoria
    if (esInactivar && !razon.trim()) {
      alert("Debes ingresar una razon para inactivar");
      return;
    }

    // Invierte el estado: si estaba activo ahora sera inactivo y viceversa
    const nuevoEstado = esInactivar ? 0 : 1;

    try {
      await cambiarEstado(
        personaSeleccionada.id_persona,
        nuevoEstado,
        razon
      );

      setTipoMensaje("success");
      setMensaje(
        esInactivar
          ? "Persona inactivada correctamente"
          : "Persona activada correctamente"
      );

      setMostrarModal(false);
      setRazon(""); // Limpia la razon para la proxima vez que se abra el modal
      cargarPersonas(); // Recarga la lista para mostrar el nuevo estado

      // Oculta el mensaje despues de 3 segundos
      setTimeout(() => setMensaje(""), 3000);

    } catch (error) {
      setTipoMensaje("error");
      setMensaje("Error al procesar");
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />

      <div className="dashboard-content">
        <div className="dashboard-container">

          <h2 className="title">Gestion de Personas con Discapacidad</h2>

          {/* Alerta de exito o error, solo visible cuando hay un mensaje */}
          {mensaje && (
            <div className={`alerta ${tipoMensaje}`}>
              {mensaje}
            </div>
          )}

          {/* Campo de busqueda por numero de documento, nombres o apellidos */}
          <input
            className="input-busqueda"
            placeholder="Buscar por documento, nombres o apellidos"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />

          <div className="tabla-container">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Codigo</th>
                  <th>Documento</th>
                  <th>Nombre</th>
                  <th>Edad</th>
                  <th>Discapacidad</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {personasFiltradas.map((p) => (
                  <tr key={p.id_persona}>
                    <td>{p.codigo}</td>
                    <td>{p.documento}</td>
                    {/* title muestra el texto completo al pasar el mouse si el texto esta truncado */}
                    <td className="td-truncate" title={p.nombre_completo}>{p.nombre_completo}</td>
                    <td>{p.edad}</td>
                    <td>{p.discapacidad}</td>

                    <td>
                      <span className={`badge ${p.activo ? "activo" : "inactivo"}`}>
                        {p.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>

                    <td className="acciones">

                      {/* Al navegar a editar se pasa "from: gestionar" para que al guardar
                          el formulario sepa que debe volver a esta pagina */}
                      <button
                        className="btn editar"
                        onClick={() => navigate(`/editar/${p.id_persona}`, { state: { from: "gestionar" } })}
                      >
                        Editar
                      </button>

                      {/* El texto y la clase del boton cambian segun si la persona esta activa o no */}
                      <button
                        className={`btn ${p.activo ? "inactivar" : "activar"}`}
                        onClick={() => abrirModal(p)}
                      >
                        {p.activo ? "Inactivar" : "Activar"}
                      </button>

                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Modal de confirmacion: solo se renderiza cuando mostrarModal es true */}
          {mostrarModal && personaSeleccionada && (
            <div className="modal">
              <div className="modal-content">
                <h3>Confirmar accion</h3>

                <p>
                  Seguro que deseas{" "}
                  {personaSeleccionada.activo
                    ? "inactivar"
                    : "activar"} esta persona?
                </p>

                {/* El textarea para la razon solo aparece si se va a INACTIVAR
                    ya que activar no requiere justificacion */}
                {personaSeleccionada.activo === 1 && (
                  <textarea
                    placeholder="Ingrese la razon de inactivacion"
                    value={razon}
                    onChange={(e) => setRazon(e.target.value)}
                  />
                )}

                <div className="modal-buttons">
                  <button
                    className="btn confirmar"
                    onClick={confirmarCambioEstado}
                  >
                    Confirmar
                  </button>

                  <button
                    className="btn cancelar"
                    onClick={() => setMostrarModal(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
