package pe.sistema.insectosbeneficos.liberaciones;

import jakarta.persistence.*;
import org.hibernate.annotations.Fetch;
import org.hibernate.annotations.FetchMode;
import pe.sistema.insectosbeneficos.catalogos.Fundo;
import pe.sistema.insectosbeneficos.catalogos.Lote;
import pe.sistema.insectosbeneficos.catalogos.Plaga;
import pe.sistema.insectosbeneficos.requerimientos.Requerimiento;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Liberación en campo de insectos benéficos (HITO-015 / MOD-08).
 * Registra la liberación de productos recibidos en el fundo/lote destino.
 * Requiere al menos 1 foto como evidencia (RN-009).
 * Soporta liberación parcial y múltiples liberaciones por recepción (RF-085/089).
 */
@Entity
@Table(name = "liberaciones")
public class Liberacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @Fetch(FetchMode.JOIN)
    @JoinColumn(name = "requerimiento_id", nullable = false)
    private Requerimiento requerimiento;

    @ManyToOne(fetch = FetchType.EAGER)
    @Fetch(FetchMode.JOIN)
    @JoinColumn(name = "fundo_id", nullable = false)
    private Fundo fundo;

    @ManyToOne(fetch = FetchType.EAGER)
    @Fetch(FetchMode.JOIN)
    @JoinColumn(name = "lote_id", nullable = false)
    private Lote lote;

    @Column(name = "cantidad_liberada", nullable = false)
    private BigDecimal cantidadLiberada;

    @Column(columnDefinition = "text")
    private String observaciones;

    @Column(name = "papel_con_postura")
    private BigDecimal papelConPostura;

    @Column(name = "sobre_con_cascarilla")
    private BigDecimal sobreConCascarilla;

    @Column(name = "fecha_liberacion", nullable = false)
    private Instant fechaLiberacion = Instant.now();

    @Column(name = "hora_liberacion", nullable = false, length = 10)
    private String horaLiberacion;

    @Column(name = "creado_por", nullable = false)
    private Long creadoPor;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt = Instant.now();

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "liberacion_plagas",
        joinColumns = @JoinColumn(name = "liberacion_id"),
        inverseJoinColumns = @JoinColumn(name = "plaga_id")
    )
    private List<Plaga> plagas = new ArrayList<>();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Requerimiento getRequerimiento() { return requerimiento; }
    public void setRequerimiento(Requerimiento requerimiento) { this.requerimiento = requerimiento; }

    public Fundo getFundo() { return fundo; }
    public void setFundo(Fundo fundo) { this.fundo = fundo; }

    public Lote getLote() { return lote; }
    public void setLote(Lote lote) { this.lote = lote; }

    public BigDecimal getCantidadLiberada() { return cantidadLiberada; }
    public void setCantidadLiberada(BigDecimal cantidadLiberada) { this.cantidadLiberada = cantidadLiberada; }

    public String getObservaciones() { return observaciones; }
    public void setObservaciones(String observaciones) { this.observaciones = observaciones; }

    public BigDecimal getPapelConPostura() { return papelConPostura; }
    public void setPapelConPostura(BigDecimal papelConPostura) { this.papelConPostura = papelConPostura; }

    public BigDecimal getSobreConCascarilla() { return sobreConCascarilla; }
    public void setSobreConCascarilla(BigDecimal sobreConCascarilla) { this.sobreConCascarilla = sobreConCascarilla; }

    public Instant getFechaLiberacion() { return fechaLiberacion; }
    public void setFechaLiberacion(Instant fechaLiberacion) { this.fechaLiberacion = fechaLiberacion; }

    public String getHoraLiberacion() { return horaLiberacion; }
    public void setHoraLiberacion(String horaLiberacion) { this.horaLiberacion = horaLiberacion; }

    public Long getCreadoPor() { return creadoPor; }
    public void setCreadoPor(Long creadoPor) { this.creadoPor = creadoPor; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public List<Plaga> getPlagas() { return plagas; }
    public void setPlagas(List<Plaga> plagas) { this.plagas = plagas; }
}
