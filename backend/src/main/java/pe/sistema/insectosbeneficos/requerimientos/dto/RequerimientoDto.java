package pe.sistema.insectosbeneficos.requerimientos.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * DTO de respuesta de un requerimiento. Los campos respetan EXACTAMENTE el
 * contrato del cliente mobile ({@code mobile/src/services/ApiClient.ts}):
 * los catálogos se exponen como nombre (fundo/lote/especie/etapaFenologica/plaga)
 * además de sus ids; stockDisponible/fechaLiberacion/horaLiberacion/
 * observaciones/papelConPostura/sobreConCascarilla/creadoPor/createdAt/updatedAt.
 *
 * V19: se agregan listas {@code lotes} y {@code plagas} para selección múltiple.
 * Los campos legacy (loteId/lote/plagaId/plaga) se mantienen por compatibilidad
 * (contienen el primer elemento de la lista).
 */
public class RequerimientoDto {

    private Long id;
    private LocalDate fecha;
    private Long fundoId;
    private String fundo;

    /** @deprecated Usar {@code lotes}. Se mantiene por compatibilidad (primer lote). */
    @Deprecated
    private Long loteId;
    /** @deprecated Usar {@code lotes}. Se mantiene por compatibilidad (primer lote). */
    @Deprecated
    private String lote;

    private Long especieId;
    private String especie;
    private Long etapaFenologicaId;
    private String etapaFenologica;
    private BigDecimal cantidad;

    /** @deprecated Usar {@code plagas}. Se mantiene por compatibilidad (primera plaga). */
    @Deprecated
    private Long plagaId;
    /** @deprecated Usar {@code plagas}. Se mantiene por compatibilidad (primera plaga). */
    @Deprecated
    private String plaga;

    /** Selección múltiple de lotes (V19). */
    private List<LoteInfo> lotes;

    /** Selección múltiple de plagas (V19). */
    private List<PlagaInfo> plagas;

    private String estado;
    private BigDecimal stockDisponible;
    private Instant fechaLiberacion;
    private String horaLiberacion;
    private String observaciones;
    private BigDecimal papelConPostura;
    private BigDecimal sobreConCascarilla;
    private Long creadoPor;
    private Instant createdAt;
    private Instant updatedAt;

    // ------------------------------------------------------------------
    // Inner classes para listas de lotes y plagas (V19)
    // ------------------------------------------------------------------

    public static class LoteInfo {
        private Long id;
        private String nombre;

        public LoteInfo() {}
        public LoteInfo(Long id, String nombre) { this.id = id; this.nombre = nombre; }

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public String getNombre() { return nombre; }
        public void setNombre(String nombre) { this.nombre = nombre; }
    }

    public static class PlagaInfo {
        private Long id;
        private String nombre;

        public PlagaInfo() {}
        public PlagaInfo(Long id, String nombre) { this.id = id; this.nombre = nombre; }

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public String getNombre() { return nombre; }
        public void setNombre(String nombre) { this.nombre = nombre; }
    }

    // ------------------------------------------------------------------
    // Getters / Setters
    // ------------------------------------------------------------------

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public LocalDate getFecha() { return fecha; }
    public void setFecha(LocalDate fecha) { this.fecha = fecha; }
    public Long getFundoId() { return fundoId; }
    public void setFundoId(Long fundoId) { this.fundoId = fundoId; }
    public String getFundo() { return fundo; }
    public void setFundo(String fundo) { this.fundo = fundo; }
    /** @deprecated Usar {@code lotes}. */
    @Deprecated
    public Long getLoteId() { return loteId; }
    /** @deprecated Usar {@code lotes}. */
    @Deprecated
    public void setLoteId(Long loteId) { this.loteId = loteId; }
    /** @deprecated Usar {@code lotes}. */
    @Deprecated
    public String getLote() { return lote; }
    /** @deprecated Usar {@code lotes}. */
    @Deprecated
    public void setLote(String lote) { this.lote = lote; }
    public Long getEspecieId() { return especieId; }
    public void setEspecieId(Long especieId) { this.especieId = especieId; }
    public String getEspecie() { return especie; }
    public void setEspecie(String especie) { this.especie = especie; }
    public Long getEtapaFenologicaId() { return etapaFenologicaId; }
    public void setEtapaFenologicaId(Long etapaFenologicaId) { this.etapaFenologicaId = etapaFenologicaId; }
    public String getEtapaFenologica() { return etapaFenologica; }
    public void setEtapaFenologica(String etapaFenologica) { this.etapaFenologica = etapaFenologica; }
    public BigDecimal getCantidad() { return cantidad; }
    public void setCantidad(BigDecimal cantidad) { this.cantidad = cantidad; }
    /** @deprecated Usar {@code plagas}. */
    @Deprecated
    public Long getPlagaId() { return plagaId; }
    /** @deprecated Usar {@code plagas}. */
    @Deprecated
    public void setPlagaId(Long plagaId) { this.plagaId = plagaId; }
    /** @deprecated Usar {@code plagas}. */
    @Deprecated
    public String getPlaga() { return plaga; }
    /** @deprecated Usar {@code plagas}. */
    @Deprecated
    public void setPlaga(String plaga) { this.plaga = plaga; }
    public List<LoteInfo> getLotes() { return lotes; }
    public void setLotes(List<LoteInfo> lotes) { this.lotes = lotes; }
    public List<PlagaInfo> getPlagas() { return plagas; }
    public void setPlagas(List<PlagaInfo> plagas) { this.plagas = plagas; }
    public String getEstado() { return estado; }
    public void setEstado(String estado) { this.estado = estado; }
    public BigDecimal getStockDisponible() { return stockDisponible; }
    public void setStockDisponible(BigDecimal stockDisponible) { this.stockDisponible = stockDisponible; }
    public Instant getFechaLiberacion() { return fechaLiberacion; }
    public void setFechaLiberacion(Instant fechaLiberacion) { this.fechaLiberacion = fechaLiberacion; }
    public String getHoraLiberacion() { return horaLiberacion; }
    public void setHoraLiberacion(String horaLiberacion) { this.horaLiberacion = horaLiberacion; }
    public String getObservaciones() { return observaciones; }
    public void setObservaciones(String observaciones) { this.observaciones = observaciones; }
    public BigDecimal getPapelConPostura() { return papelConPostura; }
    public void setPapelConPostura(BigDecimal papelConPostura) { this.papelConPostura = papelConPostura; }
    public BigDecimal getSobreConCascarilla() { return sobreConCascarilla; }
    public void setSobreConCascarilla(BigDecimal sobreConCascarilla) { this.sobreConCascarilla = sobreConCascarilla; }
    public Long getCreadoPor() { return creadoPor; }
    public void setCreadoPor(Long creadoPor) { this.creadoPor = creadoPor; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
