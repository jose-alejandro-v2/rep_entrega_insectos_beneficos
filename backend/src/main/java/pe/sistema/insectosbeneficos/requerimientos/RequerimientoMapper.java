package pe.sistema.insectosbeneficos.requerimientos;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import pe.sistema.insectosbeneficos.requerimientos.dto.RequerimientoDto;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Mapper entidad → DTO del módulo de requerimientos.
 * Resuelve los nombres de las FKs (fundo/lote/especie/etapaFenologica/plaga)
 * a partir de las relaciones EAGER de {@link Requerimiento}, igual que hace
 * {@code CatalogoMapper.toLoteDto} en catalogos.
 *
 * V19: pobla las listas {@code lotes} y {@code plagas} desde las tablas pivote
 * requerimiento_lotes / requerimiento_plagas.
 */
@ApplicationScoped
public class RequerimientoMapper {

    @Inject
    RequerimientoLoteRepository requerimientoLoteRepository;

    @Inject
    RequerimientoPlagaRepository requerimientoPlagaRepository;

    public RequerimientoDto toDto(Requerimiento r) {
        RequerimientoDto dto = new RequerimientoDto();
        dto.setId(r.getId());
        dto.setFecha(r.getFecha());

        dto.setFundoId(r.getFundo().getId());
        dto.setFundo(r.getFundo().getNombre());

        // Legacy: primer lote (backward compatible)
        dto.setLoteId(r.getLote().getId());
        dto.setLote(r.getLote().getNombre());

        dto.setEspecieId(r.getEspecie().getId());
        dto.setEspecie(r.getEspecie().getNombre());

        if (r.getEtapaFenologica() != null) {
            dto.setEtapaFenologicaId(r.getEtapaFenologica().getId());
            dto.setEtapaFenologica(r.getEtapaFenologica().getNombre());
        }

        dto.setCantidad(r.getCantidad());

        // Legacy: primera plaga (backward compatible)
        if (r.getPlaga() != null) {
            dto.setPlagaId(r.getPlaga().getId());
            dto.setPlaga(r.getPlaga().getNombre());
        }

        dto.setEstado(r.getEstado());
        dto.setStockDisponible(r.getStockDisponible());
        dto.setFechaLiberacion(r.getFechaLiberacion());
        dto.setHoraLiberacion(r.getHoraLiberacion());
        dto.setObservaciones(r.getObservaciones());
        dto.setPapelConPostura(r.getPapelConPostura());
        dto.setSobreConCascarilla(r.getSobreConCascarilla());
        dto.setCreadoPor(r.getCreadoPor());
        dto.setCreatedAt(r.getCreatedAt());
        dto.setUpdatedAt(r.getUpdatedAt());

        // V19: poblar listas desde tablas pivote
        dto.setLotes(obtenerLotes(r.getId()));
        dto.setPlagas(obtenerPlagas(r.getId()));

        return dto;
    }

    /** Obtiene la lista de lotes desde la tabla pivote requerimiento_lotes. */
    private List<RequerimientoDto.LoteInfo> obtenerLotes(Long requerimientoId) {
        return requerimientoLoteRepository.findByRequerimientoId(requerimientoId).stream()
                .map(rl -> new RequerimientoDto.LoteInfo(rl.getLote().getId(), rl.getLote().getNombre()))
                .collect(Collectors.toList());
    }

    /** Obtiene la lista de plagas desde la tabla pivote requerimiento_plagas. */
    private List<RequerimientoDto.PlagaInfo> obtenerPlagas(Long requerimientoId) {
        return requerimientoPlagaRepository.findByRequerimientoId(requerimientoId).stream()
                .map(rp -> new RequerimientoDto.PlagaInfo(rp.getPlaga().getId(), rp.getPlaga().getNombre()))
                .collect(Collectors.toList());
    }
}
