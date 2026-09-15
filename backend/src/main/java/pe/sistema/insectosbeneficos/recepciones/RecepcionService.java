package pe.sistema.insectosbeneficos.recepciones;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;
import pe.sistema.insectosbeneficos.recepciones.dto.ConfirmarRecepcionRequest;
import pe.sistema.insectosbeneficos.recepciones.dto.RecepcionDto;
import pe.sistema.insectosbeneficos.requerimientos.Requerimiento;
import pe.sistema.insectosbeneficos.requerimientos.RequerimientoRepository;
import pe.sistema.insectosbeneficos.seguridad.ActualUsuario;
import pe.sistema.insectosbeneficos.seguridad.ApiException;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Servicio de dominio del módulo de Recepciones (HITO-015 / MOD-07).
 * Reglas de negocio:
 *  - Solo se puede recibir un requerimiento en estado ENTREGADO (RF-076).
 *  - La fecha/hora de recepción se registra automáticamente (RF-073).
 *  - Soporta recepción conforme o con observaciones (RF-075).
 */
@ApplicationScoped
public class RecepcionService {

    @Inject
    RecepcionRepository recepcionRepository;

    @Inject
    RequerimientoRepository requerimientoRepository;

    @Inject
    RecepcionMapper mapper;

    @Inject
    ActualUsuario actualUsuario;

    public List<RecepcionDto> listarPorRequerimiento(Long requerimientoId) {
        return recepcionRepository.findByRequerimientoId(requerimientoId).stream()
                .map(mapper::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public RecepcionDto crear(Long requerimientoId, ConfirmarRecepcionRequest req) {
        Requerimiento r = requerimientoRepository.findByIdOptional(requerimientoId)
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND,
                        "REQUERIMIENTO_NO_ENCONTRADO", "Requerimiento no encontrado"));

        // RF-076: solo se puede recibir un requerimiento en estado ENTREGADO
        if (!"ENTREGADO".equals(r.getEstado())) {
            throw new ApiException(Response.Status.BAD_REQUEST,
                    "ESTADO_NO_VALIDO",
                    "Solo se pueden recibir requerimientos en estado ENTREGADO");
        }

        // Crear la recepción (RF-073: fecha automática)
        Recepcion rec = new Recepcion();
        rec.setRequerimiento(r);
        rec.setConforme(req.getConforme() != null ? req.getConforme() : true);
        rec.setObservaciones(req.getObservaciones());
        rec.setFechaRecepcion(Instant.now());
        rec.setCreadoPor(actualUsuario.getId());
        rec.setCreatedAt(Instant.now());
        recepcionRepository.persist(rec);

        // V22/Opción B: la recepción NO cambia el estado (queda ENTREGADO).
        // El estado pasa a LIBERADO directamente al liberar todos los lotes.
        r.setUpdatedAt(Instant.now());
        requerimientoRepository.persist(r);

        return mapper.toDto(rec);
    }
}
