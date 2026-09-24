package pe.sistema.insectosbeneficos.programacion;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;
import pe.sistema.insectosbeneficos.notificaciones.NotificacionService;
import pe.sistema.insectosbeneficos.programacion.dto.CumplimientoProgramacionDto;
import pe.sistema.insectosbeneficos.programacion.dto.GuardarCumplimientoRequest;
import pe.sistema.insectosbeneficos.seguridad.ActualUsuario;
import pe.sistema.insectosbeneficos.seguridad.ApiException;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@ApplicationScoped
public class CumplimientoProgramacionService {

    @Inject CumplimientoProgramacionRepository cumplimientoRepository;
    @Inject ProgramacionRepository programacionRepository;
    @Inject DetalleProgramacionRepository detalleProgramacionRepository;
    @Inject ActualUsuario actualUsuario;
    @Inject NotificacionService notificacionService;

    public List<CumplimientoProgramacionDto> listarPorProgramacion(Long programacionId) {
        // Verificar que la programación existe
        programacionRepository.findByIdOptional(programacionId)
            .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND,
                "PROGRAMACION_NO_EXISTE", "Programación no encontrada"));

        return cumplimientoRepository.findByProgramacionId(programacionId)
            .stream()
            .map(this::toDto)
            .collect(Collectors.toList());
    }

    public CumplimientoProgramacionDto obtenerPorDetalle(Long detalleId) {
        return cumplimientoRepository.findByDetalleId(detalleId)
            .map(this::toDto)
            .orElse(null);
    }

    @Transactional
    public CumplimientoProgramacionDto guardar(GuardarCumplimientoRequest req) {
        // Validar que el detalle existe
        DetalleProgramacion detalle = detalleProgramacionRepository.findByIdOptional(req.getProgramacionDetalleId())
            .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND,
                "DETALLE_NO_EXISTE", "Detalle de programación no encontrado"));

        // Validar que la programación existe y está publicada
        Programacion programacion = programacionRepository.findByIdOptional(detalle.getProgramacion().getId())
            .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND,
                "PROGRAMACION_NO_EXISTE", "Programación no encontrada"));

        // Calcular total real
        int totalReal = req.getPapelReal() + req.getSobreReal();

        // Buscar si ya existe cumplimiento para este detalle (upsert)
        CumplimientoProgramacion existente = cumplimientoRepository.findByDetalleId(req.getProgramacionDetalleId()).orElse(null);

        if (existente != null) {
            // Actualizar
            existente.setPapelReal(req.getPapelReal());
            existente.setSobreReal(req.getSobreReal());
            existente.setTotalReal(totalReal);
            existente.setUpdatedAt(Instant.now());
            // Notificar update (ambos create y update notifican — decision aprobada)
            notificacionService.notificarCumplimientoRegistrado(existente, actualUsuario.getId());
            return toDto(existente);
        } else {
            // Crear nuevo
            CumplimientoProgramacion entity = new CumplimientoProgramacion();
            entity.setProgramacionDetalle(detalle);
            entity.setProgramacion(programacion);
            entity.setSemana(req.getSemana());
            entity.setFecha(LocalDate.parse(req.getFecha()));
            entity.setPapelReal(req.getPapelReal());
            entity.setSobreReal(req.getSobreReal());
            entity.setTotalReal(totalReal);
            entity.setCreadoPor(actualUsuario.getId());
            entity.setCreatedAt(Instant.now());
            entity.setUpdatedAt(Instant.now());
            cumplimientoRepository.persist(entity);
            // Notificar create (ambos create y update notifican — decision aprobada)
            notificacionService.notificarCumplimientoRegistrado(entity, actualUsuario.getId());
            return toDto(entity);
        }
    }

    private CumplimientoProgramacionDto toDto(CumplimientoProgramacion entity) {
        CumplimientoProgramacionDto dto = new CumplimientoProgramacionDto();
        dto.setId(entity.getId());
        dto.setProgramacionDetalleId(entity.getProgramacionDetalle().getId());
        dto.setProgramacionId(entity.getProgramacion().getId());
        dto.setSemana(entity.getSemana());
        dto.setFecha(entity.getFecha());
        dto.setPapelReal(entity.getPapelReal());
        dto.setSobreReal(entity.getSobreReal());
        dto.setTotalReal(entity.getTotalReal());
        dto.setCreadoPor(entity.getCreadoPor());
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setUpdatedAt(entity.getUpdatedAt());
        return dto;
    }
}
