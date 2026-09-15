package pe.sistema.insectosbeneficos.liberaciones;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;
import pe.sistema.insectosbeneficos.catalogos.Fundo;
import pe.sistema.insectosbeneficos.catalogos.FundoRepository;
import pe.sistema.insectosbeneficos.catalogos.Lote;
import pe.sistema.insectosbeneficos.catalogos.LoteRepository;
import pe.sistema.insectosbeneficos.catalogos.Plaga;
import pe.sistema.insectosbeneficos.catalogos.PlagaRepository;
import pe.sistema.insectosbeneficos.liberaciones.dto.CrearLiberacionRequest;
import pe.sistema.insectosbeneficos.liberaciones.dto.LiberacionDto;
import pe.sistema.insectosbeneficos.requerimientos.Requerimiento;
import pe.sistema.insectosbeneficos.requerimientos.RequerimientoRepository;
import pe.sistema.insectosbeneficos.requerimientos.RequerimientoLote;
import pe.sistema.insectosbeneficos.requerimientos.RequerimientoLoteRepository;
import pe.sistema.insectosbeneficos.seguridad.ActualUsuario;
import pe.sistema.insectosbeneficos.seguridad.ApiException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Servicio de dominio del módulo de Liberaciones (HITO-015 / MOD-08).
 * Reglas de negocio:
 *  - Solo se puede liberar un requerimiento en estado ENTREGADO (V21).
 *  - Cada liberación marca un lote como liberado en requerimiento_lotes.
 *  - Cuando todos los lotes están liberados, el estado pasa a LIBERADO.
 *  - La cantidad liberada no puede superar la cantidad del requerimiento (RN-011).
 *  - Se requiere al menos 1 foto como evidencia (RN-009) — validación en mobile.
 *  - La fecha/hora se registra automáticamente (RN-010, RF-083).
 *  - Soporta liberación parcial y múltiples liberaciones (RF-085/089).
 */
@ApplicationScoped
public class LiberacionService {

    @Inject
    LiberacionRepository liberacionRepository;

    @Inject
    RequerimientoRepository requerimientoRepository;

    @Inject
    RequerimientoLoteRepository requerimientoLoteRepository;

    @Inject
    FundoRepository fundoRepository;

    @Inject
    LoteRepository loteRepository;

    @Inject
    PlagaRepository plagaRepository;

    @Inject
    LiberacionMapper mapper;

    @Inject
    ActualUsuario actualUsuario;

    public List<LiberacionDto> listarPorRequerimiento(Long requerimientoId) {
        return liberacionRepository.findByRequerimientoId(requerimientoId).stream()
                .map(mapper::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public LiberacionDto crear(Long requerimientoId, CrearLiberacionRequest req) {
        Requerimiento r = requerimientoRepository.findByIdOptional(requerimientoId)
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND,
                        "REQUERIMIENTO_NO_ENCONTRADO", "Requerimiento no encontrado"));

        // V21/V22/Opción B: solo se puede liberar un requerimiento en estado ENTREGADO o LIBERADO
        // (la recepción NO cambia el estado; la liberación pasa directo de ENTREGADO a LIBERADO)
        if (!"ENTREGADO".equals(r.getEstado()) && !"LIBERADO".equals(r.getEstado())) {
            throw new ApiException(Response.Status.BAD_REQUEST,
                    "ESTADO_NO_VALIDO",
                    "Solo se pueden liberar requerimientos en estado ENTREGADO o LIBERADO");
        }

        // RN-011: la cantidad liberada no puede superar la cantidad del requerimiento
        if (req.getCantidadLiberada().compareTo(r.getCantidad()) > 0) {
            throw new ApiException(Response.Status.BAD_REQUEST,
                    "CANTIDAD_LIBERACION_INVALIDA",
                    "La cantidad liberada no puede superar la cantidad del requerimiento");
        }

        Fundo fundo = fundoRepository.findByIdOptional(req.getFundoId())
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND,
                        "FUNDO_NO_EXISTE", "Fundo no encontrado"));
        Lote lote = loteRepository.findByIdOptional(req.getLoteId())
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND,
                        "LOTE_NO_EXISTE", "Lote no encontrado"));

        // V21: verificar que el lote no haya sido ya liberado
        List<RequerimientoLote> rlList = requerimientoLoteRepository.findByRequerimientoId(requerimientoId);
        boolean loteYaLiberado = rlList.stream()
                .anyMatch(rl -> lote.getId().equals(rl.getLote().getId()) && Boolean.TRUE.equals(rl.getLiberado()));
        if (loteYaLiberado) {
            throw new ApiException(Response.Status.BAD_REQUEST,
                    "LOTE_YA_LIBERADO",
                    "Este lote ya fue liberado anteriormente");
        }

        // Crear la liberación (RN-010, RF-083: fecha/hora automática o del request)
        Liberacion lib = new Liberacion();
        lib.setRequerimiento(r);
        lib.setFundo(fundo);
        lib.setLote(lote);
        lib.setCantidadLiberada(req.getCantidadLiberada());
        lib.setObservaciones(req.getObservaciones());
        lib.setPapelConPostura(req.getPapelConPostura());
        lib.setSobreConCascarilla(req.getSobreConCascarilla());

        // V22: fecha de liberación del request o automática
        if (req.getFechaLiberacion() != null && req.getFechaLiberacion().length() >= 10) {
            LocalDate fecha = LocalDate.parse(req.getFechaLiberacion().substring(0, 10));
            LocalTime hora = LocalTime.parse(req.getHoraLiberacion());
            lib.setFechaLiberacion(fecha.atTime(hora)
                    .atZone(ZoneId.of("America/Lima"))
                    .toInstant());
        } else {
            lib.setFechaLiberacion(Instant.now());
        }

        lib.setHoraLiberacion(req.getHoraLiberacion());
        lib.setCreadoPor(actualUsuario.getId());
        lib.setCreatedAt(Instant.now());

        // V22: persistir plagas asociadas a la liberación
        if (req.getPlagas() != null && !req.getPlagas().isEmpty()) {
            List<Plaga> plagas = req.getPlagas().stream()
                    .map(pid -> plagaRepository.findByIdOptional(pid)
                            .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND,
                                    "PLAGA_NO_ENCONTRADA", "Plaga no encontrada: " + pid)))
                    .collect(Collectors.toList());
            lib.setPlagas(plagas);
        }

        liberacionRepository.persist(lib);

        // V21: marcar el lote como liberado en la tabla pivote
        for (RequerimientoLote rl : rlList) {
            if (lote.getId().equals(rl.getLote().getId())) {
                rl.setLiberado(true);
                requerimientoLoteRepository.persist(rl);
                break;
            }
        }

        // V21: si todos los lotes están liberados, cambiar estado a LIBERADO
        boolean todosLiberados = rlList.stream()
                .allMatch(rl -> Boolean.TRUE.equals(rl.getLiberado()));
        if (todosLiberados) {
            r.setEstado("LIBERADO");
        }
        r.setFechaLiberacion(lib.getFechaLiberacion());
        r.setHoraLiberacion(req.getHoraLiberacion());
        r.setUpdatedAt(Instant.now());
        requerimientoRepository.persist(r);

        return mapper.toDto(lib);
    }
}
