package pe.sistema.insectosbeneficos.programacion;

import jakarta.annotation.security.PermitAll;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import pe.sistema.insectosbeneficos.programacion.dto.ActualizarEspecieRequest;
import pe.sistema.insectosbeneficos.programacion.dto.CrearEspecieRequest;
import pe.sistema.insectosbeneficos.programacion.dto.EspecieDto;
import pe.sistema.insectosbeneficos.seguridad.MensajeResponse;
import java.util.List;

/**
 * CRUD de especies bajo /api/v1. Lectura pública; escritura solo Super Admin/Admin.
 * Soft delete = estado INACTIVO.
 */
@Path("/api/v1/especies")
@RolesAllowed({ "Super Admin", "Admin" })
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class EspecieResource {

    @Inject
    EspecieService especieService;

    @GET
    @PermitAll
    public List<EspecieDto> listar() {
        return especieService.getEspecies();
    }

    @POST
    public Response crear(CrearEspecieRequest req) {
        return Response.status(Response.Status.CREATED).entity(especieService.crear(req)).build();
    }

    @PUT
    @Path("/{id}")
    public EspecieDto actualizar(@PathParam("id") Long id, ActualizarEspecieRequest req) {
        return especieService.actualizar(id, req);
    }

    @DELETE
    @Path("/{id}")
    public MensajeResponse eliminar(@PathParam("id") Long id) {
        return especieService.eliminar(id);
    }
}