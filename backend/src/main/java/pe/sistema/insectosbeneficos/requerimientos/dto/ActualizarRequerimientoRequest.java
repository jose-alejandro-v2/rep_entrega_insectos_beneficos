package pe.sistema.insectosbeneficos.requerimientos.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Body de PUT /api/v1/requerimientos/{id} (editar, Screen 8/13 del mobile).
 * Coincide con {@code ActualizarRequerimientoRequest} de ApiClient.ts.
 * El estado es obligatorio; los campos de entrega (papel/sobre/fechaLiberacion/
 * horaLiberacion/observaciones) son opcionales y solo aplican a ENTREGADO.
 *
 * V19: soporte selección múltiple de lotes y plagas via listas.
 * Los campos loteId/plagaId se mantienen por compatibilidad (deprecated).
 */
public class ActualizarRequerimientoRequest {

    @NotNull
    private LocalDate fecha;

    @NotNull
    @Positive
    private Long fundoId;

    /** @deprecated Usar {@code lotes} para selección múltiple. Se mantiene por compatibilidad. */
    @Deprecated
    private Long loteId;

    /** Selección múltiple de lotes (V19). Si se envía, tiene prioridad sobre loteId. */
    private List<Long> lotes;

    @NotNull
    @Positive
    private Long especieId;

    private Long etapaFenologicaId;

    @NotNull
    @Positive
    private BigDecimal cantidad;

    /** @deprecated Usar {@code plagas} para selección múltiple. Se mantiene por compatibilidad. */
    @Deprecated
    private Long plagaId;

    /** Selección múltiple de plagas (V19). Si se envía, tiene prioridad sobre plagaId. */
    private List<Long> plagas;

    @NotNull
    private String estado;

    private BigDecimal papelConPostura;
    private BigDecimal sobreConCascarilla;
    private Instant fechaLiberacion;
    private String horaLiberacion;
    private String observaciones;

    public LocalDate getFecha() { return fecha; }
    public void setFecha(LocalDate fecha) { this.fecha = fecha; }
    public Long getFundoId() { return fundoId; }
    public void setFundoId(Long fundoId) { this.fundoId = fundoId; }
    /** @deprecated Usar {@code lotes}. */
    @Deprecated
    public Long getLoteId() { return loteId; }
    /** @deprecated Usar {@code lotes}. */
    @Deprecated
    public void setLoteId(Long loteId) { this.loteId = loteId; }
    public List<Long> getLotes() { return lotes; }
    public void setLotes(List<Long> lotes) { this.lotes = lotes; }
    public Long getEspecieId() { return especieId; }
    public void setEspecieId(Long especieId) { this.especieId = especieId; }
    public Long getEtapaFenologicaId() { return etapaFenologicaId; }
    public void setEtapaFenologicaId(Long etapaFenologicaId) { this.etapaFenologicaId = etapaFenologicaId; }
    public BigDecimal getCantidad() { return cantidad; }
    public void setCantidad(BigDecimal cantidad) { this.cantidad = cantidad; }
    /** @deprecated Usar {@code plagas}. */
    @Deprecated
    public Long getPlagaId() { return plagaId; }
    /** @deprecated Usar {@code plagas}. */
    @Deprecated
    public void setPlagaId(Long plagaId) { this.plagaId = plagaId; }
    public List<Long> getPlagas() { return plagas; }
    public void setPlagas(List<Long> plagas) { this.plagas = plagas; }
    public String getEstado() { return estado; }
    public void setEstado(String estado) { this.estado = estado; }
    public BigDecimal getPapelConPostura() { return papelConPostura; }
    public void setPapelConPostura(BigDecimal papelConPostura) { this.papelConPostura = papelConPostura; }
    public BigDecimal getSobreConCascarilla() { return sobreConCascarilla; }
    public void setSobreConCascarilla(BigDecimal sobreConCascarilla) { this.sobreConCascarilla = sobreConCascarilla; }
    public Instant getFechaLiberacion() { return fechaLiberacion; }
    public void setFechaLiberacion(Instant fechaLiberacion) { this.fechaLiberacion = fechaLiberacion; }
    public String getHoraLiberacion() { return horaLiberacion; }
    public void setHoraLiberacion(String horaLiberacion) { this.horaLiberacion = horaLiberacion; }
    public String getObservaciones() { return observaciones; }
    public void setObservaciones(String observaciones) { this.observaciones = observaciones; }
}
