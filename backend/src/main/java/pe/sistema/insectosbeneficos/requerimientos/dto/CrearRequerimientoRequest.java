package pe.sistema.insectosbeneficos.requerimientos.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.time.LocalDate;
import java.util.List;

/**
 * Body de POST /api/v1/requerimientos (crear, Screen 10 del mobile).
 * Coincide con {@code CrearRequerimientoRequest} de ApiClient.ts.
 * Validación con Bean Validation (@Valid en el Resource); un body inválido
 * produce 400 DATOS_INVALIDOS (ManejadorErrores).
 *
 * V19: soporte selección múltiple de lotes y plagas via listas.
 * Los campos loteId/plagaId se mantienen por compatibilidad (deprecated).
 */
public class CrearRequerimientoRequest {

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
    private java.math.BigDecimal cantidad;

    /** @deprecated Usar {@code plagas} para selección múltiple. Se mantiene por compatibilidad. */
    @Deprecated
    private Long plagaId;

    /** Selección múltiple de plagas (V19). Si se envía, tiene prioridad sobre plagaId. */
    private List<Long> plagas;

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
    public void setEspecieId(Long especiaId) { this.especieId = especiaId; }
    public Long getEtapaFenologicaId() { return etapaFenologicaId; }
    public void setEtapaFenologicaId(Long etapaFenologicaId) { this.etapaFenologicaId = etapaFenologicaId; }
    public java.math.BigDecimal getCantidad() { return cantidad; }
    public void setCantidad(java.math.BigDecimal cantidad) { this.cantidad = cantidad; }
    /** @deprecated Usar {@code plagas}. */
    @Deprecated
    public Long getPlagaId() { return plagaId; }
    /** @deprecated Usar {@code plagas}. */
    @Deprecated
    public void setPlagaId(Long plagaId) { this.plagaId = plagaId; }
    public List<Long> getPlagas() { return plagas; }
    public void setPlagas(List<Long> plagas) { this.plagas = plagas; }
    public String getObservaciones() { return observaciones; }
    public void setObservaciones(String observaciones) { this.observaciones = observaciones; }
}
