package pe.sistema.insectosbeneficos.notificaciones;

import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;

import java.util.List;

import pe.sistema.insectosbeneficos.seguridad.ActualUsuario;

/**
 * Endpoints del centro de notificaciones in-app (HITO-018 — ADR-A004).
 *
 * Contrato alineado con {@code mobile/src/screens/NotificacionesScreen.tsx}:
 *   GET    /api/v1/notificaciones          — listar notificaciones del usuario
 *   PATCH  /api/v1/notificaciones/{id}/leer — marcar como leida
 *   PATCH  /api/v1/notificaciones/leer-todas — marcar todas como leidas
 *
 * RBAC: todos los roles autenticados pueden consultar sus notificaciones.
 * Usuario derivado del JWT via ActualUsuario (HITO-018 fix v1.14.2).
 */
@Path("/api/v1/notificaciones")
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed({"Super Admin", "Admin", "Usuario"})
public class NotificacionResource {

    @Inject
    NotificacionRepository notificacionRepo;

    @Inject
    ActualUsuario actualUsuario;

    /**
     * Lista las notificaciones del usuario autenticado (más recientes primero).
     */
    @GET
    public List<NotificacionDto> listar() {
        Long usuarioId = actualUsuario.getId();
        if (usuarioId == null) {
            return List.of();
        }
        return notificacionRepo.findByUsuario(usuarioId).stream()
                .map(NotificacionDto::from)
                .toList();
    }

    /**
     * Marca una notificacion como leida (valida ownership).
     */
    @PATCH
    @Path("/{id}/leer")
    public java.util.Map<String, Object> marcarLeida(@PathParam("id") Long id) {
        Long usuarioId = actualUsuario.getId();
        if (usuarioId == null) {
            return java.util.Map.of("ok", false);
        }
        notificacionRepo.marcarLeidaOwned(id, usuarioId);
        return java.util.Map.of("ok", true);
    }

    /**
     * Marca todas las notificaciones del usuario como leidas.
     */
    @PATCH
    @Path("/leer-todas")
    public java.util.Map<String, Object> marcarTodasLeidas() {
        Long usuarioId = actualUsuario.getId();
        if (usuarioId != null) {
            notificacionRepo.marcarTodasLeidas(usuarioId);
        }
        return java.util.Map.of("ok", true);
    }
}
