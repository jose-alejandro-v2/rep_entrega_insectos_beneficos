package pe.sistema.insectosbeneficos.requerimientos;

import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;
import pe.sistema.insectosbeneficos.requerimientos.dto.FotoRequerimientoDto;

import java.io.InputStream;
import java.util.List;

/**
 * Endpoints del módulo de fotos de requerimientos (HITO-010).
 * Sub-recurso de {@link RequerimientoResource}: fotos adjuntas a un
 * requerimiento específico para evidencia fotográfica en campo.
 *
 * Contrato:
 *   POST   /api/v1/requerimientos/{requerimientoId}/fotos  (multipart/form-data)
 *   GET    /api/v1/requerimientos/{requerimientoId}/fotos
 *   DELETE /api/v1/requerimientos/{requerimientoId}/fotos/{fotoId}
 *
 * El flujo de requerimientos lo usan admin i+d (publica/configura) y
 * user sanidad (operación en campo) → ambos roles tienen acceso.
 */
@Path("/api/v1/requerimientos/{requerimientoId}/fotos")
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed({"Super Admin", "Admin", "Usuario"})
public class FotoRequerimientoResource {

    @Inject
    FotoRequerimientoService fotoService;

    /**
     * Sube una foto para un requerimiento (multipart/form-data).
     * El archivo debe ser JPG o PNG, máximo 5 MB.
     * Máximo 2 fotos por requerimiento.
     */
    @POST
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    public Response subirFoto(
            @PathParam("requerimientoId") Long requerimientoId,
            @RestForm("archivo") FileUpload archivo,
            @RestForm String metadatos) {

        FotoRequerimientoDto dto = fotoService.subirFoto(
                requerimientoId,
                archivo.fileName(),
                archivo.contentType(),
                archivo.size(),
                archivo.uploadedFile(),
                metadatos
        );

        return Response.status(Response.Status.CREATED).entity(dto).build();
    }

    /**
     * Lista todas las fotos de un requerimiento.
     */
    @GET
    public List<FotoRequerimientoDto> listarFotos(
            @PathParam("requerimientoId") Long requerimientoId) {
        return fotoService.listarFotos(requerimientoId);
    }

    /**
     * Descarga la imagen binaria de una foto (HITO-010 gap).
     * Retorna el contenido con el Content-Type correcto (image/jpeg o image/png).
     */
    @GET
    @Path("/{fotoId}/imagen")
    @Produces({"image/jpeg", "image/png"})
    public Response descargarImagen(
            @PathParam("requerimientoId") Long requerimientoId,
            @PathParam("fotoId") Long fotoId) {

        FotoRequerimientoService.FotoBinaria binaria =
                fotoService.getFotoStream(requerimientoId, fotoId);

        return Response.ok(binaria.contenido(), binaria.contentType())
                .header("Content-Length", binaria.tamanoBytes())
                .header("Content-Disposition",
                        "inline; filename=\"" + binaria.nombreArchivo() + "\"")
                .header("Cache-Control", "public, max-age=86400")
                .build();
    }

    /**
     * Elimina una foto y su archivo físico en disco.
     */
    @DELETE
    @Path("/{fotoId}")
    public Response eliminarFoto(
            @PathParam("requerimientoId") Long requerimientoId,
            @PathParam("fotoId") Long fotoId) {
        fotoService.eliminarFoto(requerimientoId, fotoId);
        return Response.noContent().build();
    }
}
