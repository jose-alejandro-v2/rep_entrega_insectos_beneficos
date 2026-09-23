package pe.sistema.insectosbeneficos.catalogos;

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
import pe.sistema.insectosbeneficos.catalogos.dto.ActualizarCatalogoRequest;
import pe.sistema.insectosbeneficos.catalogos.dto.CrearCatalogoRequest;
import pe.sistema.insectosbeneficos.catalogos.dto.PlagaDto;
import pe.sistema.insectosbeneficos.seguridad.MensajeResponse;
import pe.sistema.insectosbeneficos.seguridad.Validacion;
import java.util.List;

/**
 * CRUD de plagas bajo /api/v1. Lectura pública; escritura solo Super Admin/Admin.
 * Soft delete = estado INACTIVO.
 */
@Path("/api/v1/plagas")
@RolesAllowed({ "Super Admin", "Admin" })
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class PlagaResource {

    @Inject
    PlagaService plagaService;

    @Inject
    Validacion validacion;

    @GET
    @PermitAll
    public List<PlagaDto> listar() {
        return plagaService.listar();
    }

    @POST
    public Response crear(CrearCatalogoRequest req) {
        CrearCatalogoRequest valido = validacion.validar(req);
        return Response.status(Response.Status.CREATED).entity(plagaService.crear(valido)).build();
    }

    @PUT
    @Path("/{id}")
    public PlagaDto actualizar(@PathParam("id") Long id, ActualizarCatalogoRequest req) {
        ActualizarCatalogoRequest valido = validacion.validar(req);
        return plagaService.actualizar(id, valido);
    }

    @DELETE
    @Path("/{id}")
    public MensajeResponse eliminar(@PathParam("id") Long id) {
        return plagaService.eliminar(id);
    }
}
