package pe.sistema.insectosbeneficos.dispositivos;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

/**
 * Repository para dispositivos_tokens (ADR-A004).
 */
@ApplicationScoped
public class DispositivoTokenRepository implements PanacheRepositoryBase<DispositivoToken, Long> {

    /** Busca un token exacto (para verificar si ya existe). */
    public Optional<DispositivoToken> findByToken(String fcmToken) {
        return find("fcmToken = ?1", fcmToken).firstResultOptional();
    }

    /** Tokens activos de un usuario (para gestionar dispositivos). */
    public List<DispositivoToken> findActivosByUsuario(Long usuarioId) {
        return list("usuarioId = ?1 and activo = true", usuarioId);
    }

    /** Todos los tokens activos (broadcast a todos los usuarios). */
    public List<DispositivoToken> findAllActivos() {
        return list("activo = true");
    }

    /**
     * Todos los tokens activos EXCEPTO los de un usuario específico.
     * Null-safe: si excludeUsuarioId es null, retorna todos los activos.
     */
    public List<DispositivoToken> findAllActivosExcluding(Long excludeUsuarioId) {
        if (excludeUsuarioId == null) {
            return findAllActivos();
        }
        return list("activo = true and usuarioId != ?1", excludeUsuarioId);
    }

    /** Soft delete: desactiva un token (no lo borra fisicamente). */
    public void desactivar(String fcmToken) {
        update("activo = false, fechaActualizacion = ?1 where fcmToken = ?2", Instant.now(), fcmToken);
    }

    /** Desactiva todos los tokens de un usuario (logout completo). */
    public void desactivarTodosDeUsuario(Long usuarioId) {
        update("activo = false, fechaActualizacion = ?1 where usuarioId = ?2 and activo = true", Instant.now(), usuarioId);
    }
}
