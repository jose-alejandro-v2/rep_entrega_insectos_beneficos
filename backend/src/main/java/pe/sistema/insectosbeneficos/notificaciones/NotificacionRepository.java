package pe.sistema.insectosbeneficos.notificaciones;

import java.util.List;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

/**
 * Repository para notificaciones in-app (HITO-018).
 */
@ApplicationScoped
public class NotificacionRepository implements PanacheRepositoryBase<Notificacion, Long> {

    /** Notificaciones del usuario, ordenadas por fecha descendente (más reciente primero). */
    public List<Notificacion> findByUsuario(Long usuarioId) {
        return list("usuarioId = ?1 order by fechaCreacion desc", usuarioId);
    }

    /** Marca una notificacion como leida. */
    public void marcarLeida(Long id) {
        update("leido = true where id = ?1", id);
    }

    /** Marca todas las notificaciones de un usuario como leidas. */
    public void marcarTodasLeidas(Long usuarioId) {
        update("leido = true where usuarioId = ?1 and leido = false", usuarioId);
    }
}
