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
import pe.sistema.insectosbeneficos.catalogos.dto.NematodoDto;
import pe.sistema.insectosbeneficos.seguridad.MensajeResponse;
import java.util.List;

/**
 * CRUD de nematodos bajo /api/v1. Lectura pública; escritura solo Super Admin/Admin.
 * Soft delete = estado INACTIVO.
 */
@Path("/api/v1/nematodos")
@RolesAllowed({ "Super Admin", "Admin" })
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class NematodoResource {

    @Inject
    NematodoService nematodoService;

    @GET
    @PermitAll
    public List<NematodoDto> listar() {
        return nematodoService.listar();
    }

    @POST
    public Response crear(CrearCatalogoRequest req) {
        return Response.status(Response.Status.CREATED).entity(nematodoService.crear(req)).build();
    }

    @PUT
    @Path("/{id}")
    public NematodoDto actualizar(@PathParam("id") Long id, ActualizarCatalogoRequest req) {
        return nematodoService.actualizar(id, req);
    }

    @DELETE
    @Path("/{id}")
    public MensajeResponse eliminar(@PathParam("id") Long id) {
        return nematodoService.eliminar(id);
    }
}