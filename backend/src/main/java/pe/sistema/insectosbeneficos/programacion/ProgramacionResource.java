package pe.sistema.insectosbeneficos.programacion;

import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import pe.sistema.insectosbeneficos.programacion.dto.CrearProgramacionRequest;
import pe.sistema.insectosbeneficos.programacion.dto.ProgramacionDto;
import pe.sistema.insectosbeneficos.programacion.dto.UpdateProgramacionRequest;
import pe.sistema.insectosbeneficos.seguridad.ActualUsuario;
import java.util.List;

@Path("/api/v1/programaciones")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ProgramacionResource {

    @Inject
    ProgramacionService programacionService;

    @Inject
    ActualUsuario actualUsuario;

    @GET
    public List<ProgramacionDto> getProgramaciones(@QueryParam("anio") Integer anio, @QueryParam("mes") Integer mes) {
        if (anio == null || mes == null) {
            throw new IllegalArgumentException("Anio y mes son requeridos");
        }
        return programacionService.getProgramaciones(anio, mes);
    }

    @GET
    @Path("/{id}")
    public ProgramacionDto getProgramacion(@PathParam("id") Long id) {
        return programacionService.getProgramacion(id);
    }

    /**
     * POST /api/v1/programaciones — crea una nueva programacion.
     * Solo Admin/Super Admin pueden crear (RBAC).
     * Valida que no exista ya una programacion para el mismo mes+año+especie.
     * La validacion de campos se delega en Bean Validation (@Valid) -> 400 DATOS_INVALIDOS.
     */
    @POST
    @RolesAllowed({"Super Admin", "Admin"})
    public Response crearProgramacion(@Valid CrearProgramacionRequest request) {
        ProgramacionDto creada = programacionService.crearProgramacion(
                request.getAnio(), request.getMes(), request.getEspecieId());
        return Response.status(Response.Status.CREATED).entity(creada).build();
    }

    @PUT
    @Path("/{id}")
    @RolesAllowed({"Super Admin", "Admin"})
    public ProgramacionDto updateProgramacion(@PathParam("id") Long id, UpdateProgramacionRequest request) {
        return programacionService.updateProgramacion(id, request);
    }

    /**
     * POST /api/v1/programaciones/{id}/publicar — publica y notifica.
     * excludeUsuarioId se deriva del JWT (ActualUsuario) para excluir al remitente.
     */
    @POST
    @Path("/{id}/publicar")
    @RolesAllowed({"Super Admin", "Admin"})
    public ProgramacionDto publicarProgramacion(@PathParam("id") Long id) {
        Long excludeUsuarioId = actualUsuario.getId();
        return programacionService.publicarProgramacion(id, excludeUsuarioId);
    }
}
