package pe.sistema.insectosbeneficos.requerimientos;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;
import pe.sistema.insectosbeneficos.requerimientos.dto.FotoRequerimientoDto;
import pe.sistema.insectosbeneficos.seguridad.ApiException;

import java.io.IOException;
import java.nio.file.*;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Servicio de dominio del módulo de fotos de requerimientos (HITO-010).
 * Patrón y estilo de errores ({@link ApiException}) idéntico a
 * {@code RequerimientoService}. Las reglas de negocio clave:
 *  - max 2 fotos por requerimiento (RF del dominio).
 *  - Solo JPG (image/jpeg) o PNG (image/png).
 *  - Tamaño máximo 5 MB.
 *  - Los metadatos son inmutables (no editables).
 */
@ApplicationScoped
public class FotoRequerimientoService {

    /** Tamaño máximo de archivo: 5 MB. */
    private static final long MAX_SIZE_BYTES = 5 * 1024 * 1024;

    /** Directorio de uploads relativo al working directory del servidor. */
    private static final Path UPLOAD_DIR = Paths.get("uploads", "fotos");

    /** Máximo de fotos permitidas por requerimiento. */
    private static final int MAX_FOTOS_POR_REQUERIMIENTO = 2;

    @Inject
    FotoRequerimientoRepository fotoRepository;

    @Inject
    RequerimientoRepository requerimientoRepository;

    /**
     * Sube una foto para un requerimiento.
     *
     * @param requerimientoId ID del requerimiento al que se adjunta la foto
     * @param nombreOriginal  nombre del archivo original
     * @param contentType     MIME type (image/jpeg o image/png)
     * @param tamanoBytes     tamaño del archivo en bytes
     * @param contenido       Path al archivo temporal subido (FileUpload.uploadedFile())
     * @param metadatos       metadatos adicionales (exif, GPS, etc.)
     * @return DTO de la foto creada
     * @throws ApiException si la validación falla
     */
    @Transactional
    public FotoRequerimientoDto subirFoto(Long requerimientoId, String nombreOriginal,
                                           String contentType, long tamanoBytes,
                                           Path contenido, String metadatos) {
        // Validar que el requerimiento existe
        Requerimiento requerimiento = requerimientoRepository.findByIdOptional(requerimientoId)
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND,
                        "REQUERIMIENTO_NO_ENCONTRADO", "Requerimiento no encontrado"));

        // Validar máximo de fotos
        long count = fotoRepository.countByRequerimientoId(requerimientoId);
        if (count >= MAX_FOTOS_POR_REQUERIMIENTO) {
            throw new ApiException(Response.Status.BAD_REQUEST,
                    "MAX_FOTOS_ALCANZADO",
                    "No se pueden subir más de " + MAX_FOTOS_POR_REQUERIMIENTO + " fotos por requerimiento");
        }

        // Validar tamaño
        if (tamanoBytes > MAX_SIZE_BYTES) {
            throw new ApiException(Response.Status.BAD_REQUEST,
                    "ARCHIVO_MUY_GRANDE", "El archivo excede el tamaño máximo de 5 MB");
        }

        // Validar content type
        if (!"image/jpeg".equalsIgnoreCase(contentType) && !"image/png".equalsIgnoreCase(contentType)) {
            throw new ApiException(Response.Status.BAD_REQUEST,
                    "FORMATO_NO_VALIDO", "Solo se aceptan archivos JPG o PNG");
        }

        // Crear directorio si no existe
        try {
            Files.createDirectories(UPLOAD_DIR);
        } catch (IOException e) {
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR,
                    "ERROR_DIRECTORIO", "No se pudo crear el directorio de uploads");
        }

        // Guardar archivo con nombre único
        String extension = "image/png".equalsIgnoreCase(contentType) ? ".png" : ".jpg";
        String nombreUnico = UUID.randomUUID().toString() + extension;
        Path rutaArchivo = UPLOAD_DIR.resolve(nombreUnico);

        try {
            Files.copy(contenido, rutaArchivo, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR,
                    "ERROR_GUARDAR", "No se pudo guardar el archivo");
        }

        // Guardar metadatos en BD
        FotoRequerimiento foto = new FotoRequerimiento();
        foto.setRequerimiento(requerimiento);
        foto.setRuta(rutaArchivo.toString());
        foto.setNombreArchivo(nombreOriginal);
        foto.setTamanoBytes(tamanoBytes);
        foto.setContentType(contentType);
        foto.setMetadatos(metadatos);
        foto.setCreadoEn(java.time.Instant.now());
        fotoRepository.persist(foto);

        return toDto(foto);
    }

    /**
     * Lista todas las fotos de un requerimiento.
     */
    public List<FotoRequerimientoDto> listarFotos(Long requerimientoId) {
        // Validar que el requerimiento existe
        requerimientoRepository.findByIdOptional(requerimientoId)
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND,
                        "REQUERIMIENTO_NO_ENCONTRADO", "Requerimiento no encontrado"));

        return fotoRepository.findByRequerimientoId(requerimientoId).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    /**
     * Elimina una foto y su archivo físico en disco.
     */
    @Transactional
    public void eliminarFoto(Long requerimientoId, Long fotoId) {
        FotoRequerimiento foto = fotoRepository.findByIdOptional(fotoId)
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND,
                        "FOTO_NO_ENCONTRADA", "Foto no encontrada"));

        if (!foto.getRequerimiento().getId().equals(requerimientoId)) {
            throw new ApiException(Response.Status.BAD_REQUEST,
                    "FOTO_NO_PERTENECE", "La foto no pertenece a este requerimiento");
        }

        // Eliminar archivo físico (silenciar errores de IO — log implícito)
        try {
            Path ruta = Paths.get(foto.getRuta());
            Files.deleteIfExists(ruta);
        } catch (IOException e) {
            // No fallar si el archivo ya no existe en disco
        }

        fotoRepository.delete(foto);
    }

    /**
     * Retorna un InputStream del archivo de imagen en disco para servirlo
     * como contenido binario (endpoint GET /imagen).
     *
     * @return tupla [InputStream, contentType, tamanoBytes]
     */
    public FotoBinaria getFotoStream(Long requerimientoId, Long fotoId) {
        FotoRequerimiento foto = fotoRepository.findByIdOptional(fotoId)
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND,
                        "FOTO_NO_ENCONTRADA", "Foto no encontrada"));

        if (!foto.getRequerimiento().getId().equals(requerimientoId)) {
            throw new ApiException(Response.Status.BAD_REQUEST,
                    "FOTO_NO_PERTENECE", "La foto no pertenece a este requerimiento");
        }

        Path ruta = Paths.get(foto.getRuta());
        if (!Files.exists(ruta)) {
            throw new ApiException(Response.Status.NOT_FOUND,
                    "ARCHIVO_NO_ENCONTRADO", "El archivo de imagen no existe en el servidor");
        }

        try {
            return new FotoBinaria(
                    Files.newInputStream(ruta),
                    foto.getContentType(),
                    foto.getTamanoBytes(),
                    foto.getNombreArchivo());
        } catch (IOException e) {
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR,
                    "ERROR_LEER_ARCHIVO", "No se pudo leer el archivo de imagen");
        }
    }

    /**
     * Registro inmutable que encapsula el binario de una foto para servirlo.
     */
    public record FotoBinaria(
            java.io.InputStream contenido,
            String contentType,
            long tamanoBytes,
            String nombreArchivo) {}

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private FotoRequerimientoDto toDto(FotoRequerimiento foto) {
        FotoRequerimientoDto dto = new FotoRequerimientoDto();
        dto.setId(foto.getId());
        dto.setRequerimientoId(foto.getRequerimiento().getId());
        dto.setRuta("/api/v1/requerimientos/" + foto.getRequerimiento().getId() + "/fotos/" + foto.getId() + "/imagen");
        dto.setNombreArchivo(foto.getNombreArchivo());
        dto.setTamanoBytes(foto.getTamanoBytes());
        dto.setContentType(foto.getContentType());
        dto.setMetadatos(foto.getMetadatos());
        dto.setCreadoEn(foto.getCreadoEn());
        return dto;
    }
}
