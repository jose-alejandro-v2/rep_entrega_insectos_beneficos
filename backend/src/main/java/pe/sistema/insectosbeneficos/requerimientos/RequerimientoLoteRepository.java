package pe.sistema.insectosbeneficos.requerimientos;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

/**
 * Repositorio Panache de {@link RequerimientoLote} (V19).
 */
@ApplicationScoped
public class RequerimientoLoteRepository implements PanacheRepository<RequerimientoLote> {

    public List<RequerimientoLote> findByRequerimientoId(Long requerimientoId) {
        return list("requerimiento.id = ?1", requerimientoId);
    }

    public long countByRequerimientoIdAndLiberadoFalse(Long requerimientoId) {
        return count("requerimiento.id = ?1 AND liberado = false", requerimientoId);
    }

    public long countByRequerimientoId(Long requerimientoId) {
        return count("requerimiento.id = ?1", requerimientoId);
    }
}
