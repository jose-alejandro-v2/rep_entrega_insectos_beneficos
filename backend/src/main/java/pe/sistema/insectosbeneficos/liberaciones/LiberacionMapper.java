package pe.sistema.insectosbeneficos.liberaciones;

import jakarta.enterprise.context.ApplicationScoped;
import pe.sistema.insectosbeneficos.liberaciones.dto.LiberacionDto;

import java.util.stream.Collectors;

@ApplicationScoped
public class LiberacionMapper {

    public LiberacionDto toDto(Liberacion l) {
        LiberacionDto dto = new LiberacionDto();
        dto.setId(l.getId());
        dto.setRequerimientoId(l.getRequerimiento() != null ? l.getRequerimiento().getId() : null);
        dto.setFundoId(l.getFundo() != null ? l.getFundo().getId() : null);
        dto.setFundoNombre(l.getFundo() != null ? l.getFundo().getNombre() : null);
        dto.setLoteId(l.getLote() != null ? l.getLote().getId() : null);
        dto.setLoteNombre(l.getLote() != null ? l.getLote().getNombre() : null);
        dto.setCantidadLiberada(l.getCantidadLiberada());
        dto.setObservaciones(l.getObservaciones());
        dto.setPapelConPostura(l.getPapelConPostura());
        dto.setSobreConCascarilla(l.getSobreConCascarilla());
        dto.setFechaLiberacion(l.getFechaLiberacion());
        dto.setHoraLiberacion(l.getHoraLiberacion());
        dto.setCreadoPor(l.getCreadoPor());
        dto.setCreatedAt(l.getCreatedAt());
        if (l.getPlagas() != null) {
            dto.setPlagas(l.getPlagas().stream()
                .map(p -> new LiberacionDto.PlagaDto(p.getId(), p.getNombre()))
                .collect(Collectors.toList()));
        }
        return dto;
    }
}
