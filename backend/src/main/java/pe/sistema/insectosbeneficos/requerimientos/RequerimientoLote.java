package pe.sistema.insectosbeneficos.requerimientos;

import jakarta.persistence.*;
import pe.sistema.insectosbeneficos.catalogos.Lote;

/**
 * Tabla pivote: relación N:N entre requerimientos y lotes (V19).
 * Cada requerimiento puede tener múltiples lotes asociados.
 */
@Entity
@Table(name = "requerimiento_lotes", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"requerimiento_id", "lote_id"})
})
public class RequerimientoLote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requerimiento_id", nullable = false)
    private Requerimiento requerimiento;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "lote_id", nullable = false)
    private Lote lote;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Requerimiento getRequerimiento() { return requerimiento; }
    public void setRequerimiento(Requerimiento requerimiento) { this.requerimiento = requerimiento; }
    public Lote getLote() { return lote; }
    public void setLote(Lote lote) { this.lote = lote; }
}
