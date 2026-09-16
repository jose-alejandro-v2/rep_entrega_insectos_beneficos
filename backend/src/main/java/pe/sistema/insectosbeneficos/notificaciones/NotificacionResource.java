package pe.sistema.insectosbeneficos.notificaciones;

import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;

import java.util.List;

/**
 * Endpoints del centro de notificaciones in-app (HITO-018 — ADR-A004).
 *
 * Contrato alineado con {@code mobile/src/screens/NotificacionesScreen.tsx}:
 *   GET    /api/v1/notificaciones          — listar notificaciones del usuario
 *   PATCH  /api/v1/notificaciones/{id}/leer — marcar como leida
 *   PATCH  /api/v1/notificaciones/leer-todas — marcar todas como leidas
 *
 * RBAC: todos los roles autenticados pueden consultar sus notificaciones.
 */
@Path("/api/v1/notificaciones")
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed({"Super Admin", "Admin", "Usuario"})
public class NotificacionResource {

    @Inject
    NotificacionRepository notificacionRepo;

    /**
     * Lista las notificaciones del usuario autenticado (más recientes primero).
     */
    @GET
    public List<NotificacionDto> listar(@HeaderParam("X-Usuario-Id") Long usuarioId) {
        if (usuarioId == null) {
            return List.of();
        }
        return notificacionRepo.findByUsuario(usuarioId).stream()
                .map(NotificacionDto::from)
                .toList();
    }

    /**
     * Marca una notificacion como leida.
     */
    @PATCH
    @Path("/{id}/leer")
    public java.util.Map<String, Object> marcarLeida(@PathParam("id") Long id) {
        notificacionRepo.marcarLeida(id);
        return java.util.Map.of("ok", true);
    }

    /**
     * Marca todas las notificaciones del usuario como leidas.
     */
    @PATCH
    @Path("/leer-todas")
    public java.util.Map<String, Object> marcarTodasLeidas(
            @HeaderParam("X-Usuario-Id") Long usuarioId) {
        if (usuarioId != null) {
            notificacionRepo.marcarTodasLeidas(usuarioId);
        }
        return java.util.Map.of("ok", true);
    }
}
