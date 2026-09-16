package pe.sistema.insectosbeneficos.usuarios;

import java.util.List;
import java.util.Objects;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;

import pe.sistema.insectosbeneficos.seguridad.ActualUsuario;
import pe.sistema.insectosbeneficos.seguridad.ApiException;
import pe.sistema.insectosbeneficos.seguridad.BcryptService;
import pe.sistema.insectosbeneficos.seguridad.MensajeResponse;
import pe.sistema.insectosbeneficos.usuarios.dto.ActualizarUsuarioRequest;
import pe.sistema.insectosbeneficos.usuarios.dto.CrearUsuarioRequest;
import pe.sistema.insectosbeneficos.usuarios.dto.UsuarioDto;

/**
 * CRUD de usuarios con soft delete y RBAC (ADR-A002 D-AUTH-2/D-AUTH-5,
 * adaptado a ADR-A003 D-AUTH2-1 con roles en tabla):
 * - SUPER_ADMIN ("Super Admin"): gestiona cualquier rol (incluido SUPER_ADMIN).
 * - ADMIN ("Admin"): gestiona solo Admin y Usuario (nunca Super Admin).
 * - USUARIO ("Usuario"): no accede (protegido por @RolesAllowed en el recurso).
 *
 * SOBRE EL DELETE FISICO: aqui NO existe ningun metodo que borre filas.
 * "Eliminar" = estado INACTIVO (soft delete). Las escrituras requieren
 * @Transactional; nunca se invoca Usuario.delete()/deleteById() (regla de
 * seguridad).
 *
 * Reglas de integridad (ADR-A003 D-AUTH2-6 + task INC-1 BE-006):
 * - El seed id=1 (Super Admin) es INMUNE: no puede desactivarse ni eliminarse
 *   (400 SEED_SUPER_ADMIN_INMUNE), ni por si mismo ni por otro Super Admin.
 * - No se puede desactivar el ultimo SUPER_ADMIN activo (400) — regla que con
 *   el seed inmune queda como defensa en profundidad para escenarios sin seed.
 * - No se puede desactivar la propia cuenta (400).
 * - No se puede crear/actualizar a SUPER_ADMIN desde ADMIN (403).
 */
@ApplicationScoped
public class UsuarioService {

    /** Contrasena por defecto al crear usuarios (ADR-A002 D-AUTH-3). */
    public static final String PASSWORD_DEFAULT = "00000000";

    /** Literales con espacios (ADR-A003 D-AUTH2-1) — deben coincidir con
     *  @RolesAllowed y con el claim "groups" del JWT. */
    public static final String ROL_SUPER_ADMIN = "Super Admin";
    public static final String ROL_ADMIN = "Admin";
    public static final String ROL_USUARIO = "Usuario";

    /** Seed inmune (ADR-A003 D-AUTH2-6): id=1 nunca se desactiva ni elimina. */
    public static final Long ID_SEED_SUPER_ADMIN = 1L;

    @Inject
    ActualUsuario actual;

    @Inject
    BcryptService bcrypt;

    @Inject
    UsuarioMapper mapper;

    // ------------------------------------------------------------------
    // RBAC
    // ------------------------------------------------------------------

    /** Valida que el actor pueda gestionar el rol objetivo (403 si no). */
    private void verificarPuedeGestionar(String rolObjetivo) {
        String actor = actual.getRol();
        if (ROL_SUPER_ADMIN.equals(actor)) {
            return;
        }
        if (ROL_ADMIN.equals(actor) && (ROL_ADMIN.equals(rolObjetivo) || ROL_USUARIO.equals(rolObjetivo))) {
            return;
        }
        throw new ApiException(Response.Status.FORBIDDEN, "SIN_PERMISOS",
                "No tiene permisos para gestionar el perfil " + rolObjetivo);
    }

    /** Regla de integridad: no desactivar el ultimo SUPER_ADMIN activo (400).
     *  Con el seed inmune (id=1) no deberia dispararse en el estado normal,
     *  pero se conserva como defensa en profundidad (escenario sin seed). */
    private void verificarNoEsUltimoSuperAdminActivo(Usuario objetivo) {
        if (!ROL_SUPER_ADMIN.equals(objetivo.rol.nombre)) {
            return;
        }
        long activos = Usuario.count("rol.nombre = ?1 and estado = ?2", ROL_SUPER_ADMIN, EstadoUsuario.ACTIVO);
        if (activos <= 1) {
            throw new ApiException(Response.Status.BAD_REQUEST, "ULTIMO_SUPER_ADMIN",
                    "No se puede desactivar el último SUPER_ADMIN activo");
        }
    }

    /** Regla reforzada (ADR-A003 D-AUTH2-6): el seed id=1 no se desactiva ni elimina. */
    private void verificarSeedInmune(Usuario objetivo) {
        if (ID_SEED_SUPER_ADMIN.equals(objetivo.id)) {
            throw new ApiException(Response.Status.BAD_REQUEST, "SEED_SUPER_ADMIN_INMUNE",
                    "El Super Admin inicial no puede desactivarse ni eliminarse");
        }
    }

    /** Regla de integridad: nadie desactiva su propia cuenta (400). */
    private void verificarNoAutoDesactivacion(Usuario objetivo) {
        if (Objects.equals(objetivo.id, actual.getId())) {
            throw new ApiException(Response.Status.BAD_REQUEST, "NO_AUTO_DESACTIVACION",
                    "No puede desactivar su propio usuario");
        }
    }

    /** Busca el rol por id; null -> 404 (referencia invalida en la solicitud). */
    private Rol buscarRol(Long rolId) {
        if (rolId == null) {
            throw new ApiException(Response.Status.BAD_REQUEST, "ROL_NO_ENCONTRADO", "El rol es obligatorio");
        }
        Rol r = Rol.findById(rolId);
        if (r == null) {
            throw new ApiException(Response.Status.NOT_FOUND, "ROL_NO_ENCONTRADO", "Rol no encontrado");
        }
        return r;
    }

    /**
     * Reglas de negocio del DNI (compartidas con crear/cambiar-password).
     * En la creacion el DNI es opcional; si viene, se valida igual.
     */
    void validarDni(String dni) {
        if (dni == null || dni.isBlank()) {
            throw new ApiException(Response.Status.BAD_REQUEST, "DATOS_INVALIDOS", "El DNI es obligatorio");
        }
        if (!dni.matches("[0-9]+")) {
            throw new ApiException(Response.Status.BAD_REQUEST, "DATOS_INVALIDOS",
                    "El DNI debe ser numérico (solo dígitos 0-9)");
        }
        if (dni.length() > 8) {
            throw new ApiException(Response.Status.BAD_REQUEST, "DATOS_INVALIDOS", "El DNI no puede superar 8 dígitos");
        }
        if (PASSWORD_DEFAULT.equals(dni)) {
            throw new ApiException(Response.Status.BAD_REQUEST, "DATOS_INVALIDOS",
                    "El DNI no puede ser la contraseña por defecto (00000000)");
        }
    }

    // ------------------------------------------------------------------
    // Correo de notificaciones (HITO-018)
    // ------------------------------------------------------------------

    /** Normaliza el correo: trim + lowercase; vacio/null -> null (sin correo). */
    private String normalizarEmail(String email) {
        if (email == null || email.isBlank()) {
            return null;
        }
        String limpio = email.trim().toLowerCase();
        if (!limpio.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw new ApiException(Response.Status.BAD_REQUEST, "CORREO_INVALIDO",
                    "El correo electrónico no tiene un formato válido");
        }
        return limpio;
    }

    /** Verifica unicidad del correo (409 si otro usuario lo usa). */
    private void verificarEmailUnico(String email, Long exceptoId) {
        if (email == null) {
            return;
        }
        Usuario duplicado = exceptoId == null
                ? Usuario.find("email", email).firstResult()
                : Usuario.find("email = ?1 and id <> ?2", email, exceptoId).firstResult();
        if (duplicado != null) {
            throw new ApiException(Response.Status.CONFLICT, "CORREO_YA_EXISTE",
                    "El correo '" + email + "' ya está asignado a otro usuario");
        }
    }

    // ------------------------------------------------------------------
    // Listado / detalle
    // ------------------------------------------------------------------

    public List<UsuarioDto> listar(String estado, Long rolId) {
        List<Usuario> lista = buscar(estado, rolId);
        String actor = actual.getRol();
        if (ROL_ADMIN.equals(actor)) {
            // ADMIN solo ve Admin/Usuario (nunca Super Admin)
            lista = lista.stream().filter(u -> !ROL_SUPER_ADMIN.equals(u.rol.nombre)).toList();
        }
        return lista.stream().map(mapper::toDto).toList();
    }

    private List<Usuario> buscar(String estado, Long rolId) {
        EstadoUsuario est = parseEstado(estado);
        if (est != null && rolId != null) {
            return Usuario.list("estado = ?1 and rol.id = ?2 order by id", est, rolId);
        }
        if (est != null) {
            return Usuario.list("estado = ?1 order by id", est);
        }
        if (rolId != null) {
            return Usuario.list("rol.id = ?1 order by id", rolId);
        }
        return Usuario.list("order by id");
    }

    private EstadoUsuario parseEstado(String valor) {
        if (valor == null || valor.isBlank()) {
            return null;
        }
        try {
            return EstadoUsuario.valueOf(valor);
        } catch (IllegalArgumentException e) {
            throw new ApiException(Response.Status.BAD_REQUEST, "DATOS_INVALIDOS",
                    "Valor inválido para estado: " + valor);
        }
    }

    public UsuarioDto obtenerPorId(Long id) {
        Usuario u = Usuario.findById(id);
        if (u == null) {
            throw new ApiException(Response.Status.NOT_FOUND, "USUARIO_NO_ENCONTRADO", "Usuario no encontrado");
        }
        verificarPuedeGestionar(u.rol.nombre);
        return mapper.toDto(u);
    }

    // ------------------------------------------------------------------
    // Crear
    // ------------------------------------------------------------------

    @Transactional
    public UsuarioDto crear(CrearUsuarioRequest req) {
        if (req.dni != null && !req.dni.isBlank()) {
            validarDni(req.dni);
        }
        Rol rol = buscarRol(req.rolId);
        verificarPuedeGestionar(rol.nombre);

        Usuario existente = Usuario.find("usuario", req.usuario.trim()).firstResult();
        if (existente != null) {
            throw new ApiException(Response.Status.CONFLICT, "USUARIO_YA_EXISTE",
                    "El usuario '" + req.usuario.trim() + "' ya existe");
        }

        // Email de notificaciones (HITO-018): opcional, se normaliza y valida.
        String email = normalizarEmail(req.email);
        if (email != null) {
            verificarEmailUnico(email, null);
        }

        Usuario u = new Usuario();
        u.usuario = req.usuario.trim();
        u.nombre = req.nombre.trim();
        u.rol = rol;
        // Password SIEMPRE el default 00000000 hasheado (no se acepta otro en creacion)
        u.contrasenaHash = bcrypt.hash(PASSWORD_DEFAULT);
        u.debeCambiarPassword = true;
        u.estado = EstadoUsuario.ACTIVO;
        u.dni = (req.dni == null || req.dni.isBlank()) ? null : req.dni;
        u.email = email;
        u.creadoPor = actual.getId();
        u.persist();
        return mapper.toDto(u);
    }

    // ------------------------------------------------------------------
    // Actualizar (sin password; no toca dni ni debe_cambiar_password)
    // ------------------------------------------------------------------

    @Transactional
    public UsuarioDto actualizar(Long id, ActualizarUsuarioRequest req) {
        Usuario u = Usuario.findById(id);
        if (u == null) {
            throw new ApiException(Response.Status.NOT_FOUND, "USUARIO_NO_ENCONTRADO", "Usuario no encontrado");
        }
        verificarPuedeGestionar(u.rol.nombre);
        Rol nuevoRol = buscarRol(req.rolId);
        verificarPuedeGestionar(nuevoRol.nombre);

        if (!u.usuario.equals(req.usuario.trim())) {
            Usuario existente = Usuario.find("usuario", req.usuario.trim()).firstResult();
            if (existente != null) {
                throw new ApiException(Response.Status.CONFLICT, "USUARIO_YA_EXISTE",
                        "El usuario '" + req.usuario.trim() + "' ya existe");
            }
        }

        if (req.estado == EstadoUsuario.INACTIVO) {
            // Mismas reglas de integridad que el soft delete (DELETE): no bypass por PUT
            verificarSeedInmune(u);
            verificarNoEsUltimoSuperAdminActivo(u);
            verificarNoAutoDesactivacion(u);
        }

        u.usuario = req.usuario.trim();
        u.nombre = req.nombre.trim();
        u.rol = nuevoRol;
        u.estado = req.estado;
        // Email (HITO-018): si el campo viene null se PRESERVA el actual; si viene
        // como string (incl. vacio) se normaliza/valida y se aplica (vacio limpia).
        if (req.email != null) {
            String email = normalizarEmail(req.email);
            verificarEmailUnico(email, id);
            u.email = email;
        }
        u.updatedAt = java.time.Instant.now();
        u.persist();
        return mapper.toDto(u);
    }

    // ------------------------------------------------------------------
    // Soft delete (NUNCA DELETE fisico)
    // ------------------------------------------------------------------

    @Transactional
    public MensajeResponse eliminar(Long id) {
        Usuario u = Usuario.findById(id);
        if (u == null) {
            throw new ApiException(Response.Status.NOT_FOUND, "USUARIO_NO_ENCONTRADO", "Usuario no encontrado");
        }
        verificarPuedeGestionar(u.rol.nombre);
        if (u.estado == EstadoUsuario.INACTIVO) {
            throw new ApiException(Response.Status.BAD_REQUEST, "USUARIO_YA_INACTIVO", "El usuario ya está inactivo");
        }
        // Integridad primero: seed inmune -> ultimo SUPER_ADMIN -> auto-desactivacion.
        verificarSeedInmune(u);
        verificarNoEsUltimoSuperAdminActivo(u);
        verificarNoAutoDesactivacion(u);

        u.estado = EstadoUsuario.INACTIVO;
        u.updatedAt = java.time.Instant.now();
        u.persist();
        return new MensajeResponse("Usuario desactivado correctamente");
    }
}