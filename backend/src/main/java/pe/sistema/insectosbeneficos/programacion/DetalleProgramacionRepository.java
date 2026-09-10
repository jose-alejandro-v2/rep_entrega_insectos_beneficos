package pe.sistema.insectosbeneficos.programacion;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;

import java.time.LocalDate;
import java.util.Optional;

@ApplicationScoped
public class DetalleProgramacionRepository implements PanacheRepository<DetalleProgramacion> {

    /**
     * Busca el stockFinal del detalle más reciente para una especie dada,
     * con fecha <= fechaCorte. Se usa para el stock del último Lunes o Jueves
     * según la lógica de fechaCorte del servicio de requerimientos.
     *
     * @param especieId  ID de la especie
     * @param fechaCorte fecha límite (inclusive) para buscar el detalle
     * @return el Optional con el DetalleProgramacion más reciente, o empty si no existe
     */
    public Optional<DetalleProgramacion> findStockFinalByEspecieAndFechaCorte(Long especieId, LocalDate fechaCorte) {
        return find("programacion.especie.id = ?1 AND fecha <= ?2 ORDER BY fecha DESC",
                especieId, fechaCorte).firstResultOptional();
    }
}
