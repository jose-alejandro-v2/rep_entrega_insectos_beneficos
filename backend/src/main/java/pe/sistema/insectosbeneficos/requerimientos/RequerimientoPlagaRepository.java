package pe.sistema.insectosbeneficos.requerimientos;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

/**
 * Repositorio Panache de {@link RequerimientoPlaga} (V19).
 */
@ApplicationScoped
public class RequerimientoPlagaRepository implements PanacheRepository<RequerimientoPlaga> {

    public List<RequerimientoPlaga> findByRequerimientoId(Long requerimientoId) {
        return list("requerimiento.id = ?1", requerimientoId);
    }
}
