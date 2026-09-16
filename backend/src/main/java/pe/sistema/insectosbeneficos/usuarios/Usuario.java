package pe.sistema.insectosbeneficos.usuarios;

import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonIgnore;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import org.hibernate.annotations.Fetch;
import org.hibernate.annotations.FetchMode;

/**
 * Entidad "usuarios" (login local JWT).
 * Patron Panache active-record: las consultas se hacen con los staticos de
 * PanacheEntityBase (Usuario.find(...) / Usuario.list(...) / etc.).
 *
 * ID: la migracion V1 define id BIGSERIAL PRIMARY KEY (Postgres crea la
 * secuencia usuarios_id_seq). Por eso el id usa GenerationType.IDENTITY
 * explicitamente (PanacheEntity por defecto usa SEQUENCE "usuarios_seq",
 * que no existe en nuestra migracion; ver fallo registrado en el analisis).
 *
 * REGLA DE SEGURIDAD: nunca se ejecuta DELETE fisico sobre esta entidad.
 * El unico "borrado" es estado = INACTIVO (soft delete) via UsuarioService.
 * La API de Panache expone delete()/deleteById() en las clases base; el
 * servicio de usuarios JAMAS las invoca (guardas documentadas en
 * UsuarioService). Para escrituras se usa @Transactional en el servicio.
 *
 * El atributo contrasenaHash es @JsonIgnore: nunca sale en ninguna respuesta.
 * La estrategia de nombres snake_case (contrasenaHash -> contrasena_hash)
 * esta configurada en application.properties
 * (quarkus.hibernate-orm.physical-naming-strategy).
 */
@Entity
@Table(name = "usuarios")
public class Usuario extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    /** Login (identificador unico). */
    public String usuario;

    /** Nombre visible. */
    public String nombre;

    /**
     * Rol del usuario (ADR-A003 D-AUTH2-1): ManyToOne a la tabla `roles`.
     * FetchMode.JOIN evita consultas N+1 en listados (G-ORM): al listar
     * usuarios el rol se trae con el mismo SELECT (3 filas de roles en total).
     */
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "rol_id", nullable = false)
    @Fetch(FetchMode.JOIN)
    public Rol rol;

    /** BCrypt del password. JAMAS se expone en respuestas JSON. */
    @JsonIgnore
    public String contrasenaHash;

    /** True obliga a cambiar la contrasena al primer login (nueva = DNI). */
    public boolean debeCambiarPassword = true;

    /** DNI (VARCHAR(8) en BD: preserva ceros a la izquierda). */
    public String dni;

    /** Correo para notificaciones SMTP (HITO-018). Nullable: se carga desde
     *  Catálogos > Usuarios. Unico entre los usuarios que lo tengan (V23). */
    public String email;

    @Enumerated(EnumType.STRING)
    public EstadoUsuario estado = EstadoUsuario.ACTIVO;

    /** Auditoria: id del usuario que lo creo. */
    public Long creadoPor;

    public Instant createdAt = Instant.now();

    public Instant updatedAt = Instant.now();

    public Instant lastLoginAt;
}