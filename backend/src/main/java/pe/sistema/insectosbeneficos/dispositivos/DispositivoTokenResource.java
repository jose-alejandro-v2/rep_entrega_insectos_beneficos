package pe.sistema.insectosbeneficos.dispositivos;

import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import pe.sistema.insectosbeneficos.dispositivos.dto.DispositivoTokenDto;
import pe.sistema.insectosbeneficos.dispositivos.dto.RegistrarTokenRequest;
import pe.sistema.insectosbeneficos.seguridad.ActualUsuario;

import java.util.List;

/**
 * Endpoints para registro de tokens FCM (ADR-A004 D-PUSH-3).
 *
 * Contrato:
 *   POST   /api/v1/dispositivos-token          — registrar token (auth required)
 *   DELETE /api/v1/dispositivos-token/{token}   — eliminar token (auth required)
 *   GET    /api/v1/dispositivos-token           — listar mis tokens (auth required)
 *
 * RBAC: todos los roles autenticados pueden registrar sus dispositivos.
 * Usuario derivado del JWT via ActualUsuario (HITO-018 fix v1.14.2).
 */
@Path("/api/v1/dispositivos-token")
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed({"Super Admin", "Admin", "Usuario"})
public class DispositivoTokenResource {

    @Inject
    DispositivoTokenService service;

    @Inject
    ActualUsuario actualUsuario;

    /**
     * Registra un token FCM para el usuario autenticado.
     * Si el token ya existe, lo reactiva y reasigna al usuario actual.
     */
    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    public Response registrar(@Valid RegistrarTokenRequest req) {
        Long usuarioId = actualUsuario.getId();
        if (usuarioId == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("{\"error\":\"Usuario no autenticado\"}")
                    .build();
        }
        DispositivoTokenDto dto = service.registrar(usuarioId, req);
        return Response.status(Response.Status.CREATED).entity(dto).build();
    }

    /**
     * Elimina un token FCM (soft delete: activo = false).
     */
    @DELETE
    @Path("/{token}")
    public Response eliminar(@PathParam("token") String token) {
        service.eliminar(token);
        return Response.noContent().build();
    }

    /**
     * Lista los tokens activos del usuario autenticado.
     */
    @GET
    public List<DispositivoTokenDto> listar() {
        Long usuarioId = actualUsuario.getId();
        if (usuarioId == null) {
            return List.of();
        }
        return service.listarPorUsuario(usuarioId);
    }
}
