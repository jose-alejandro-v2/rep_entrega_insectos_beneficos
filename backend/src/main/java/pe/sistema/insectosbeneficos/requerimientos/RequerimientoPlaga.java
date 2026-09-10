package pe.sistema.insectosbeneficos.requerimientos;

import jakarta.persistence.*;
import pe.sistema.insectosbeneficos.catalogos.Plaga;

/**
 * Tabla pivote: relación N:N entre requerimientos y plagas (V19).
 * Cada requerimiento puede tener múltiples plagas asociadas.
 */
@Entity
@Table(name = "requerimiento_plagas", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"requerimiento_id", "plaga_id"})
})
public class RequerimientoPlaga {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requerimiento_id", nullable = false)
    private Requerimiento requerimiento;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "plaga_id", nullable = false)
    private Plaga plaga;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Requerimiento getRequerimiento() { return requerimiento; }
    public void setRequerimiento(Requerimiento requerimiento) { this.requerimiento = requerimiento; }
    public Plaga getPlaga() { return plaga; }
    public void setPlaga(Plaga plaga) { this.plaga = plaga; }
}
