package pe.sistema.insectosbeneficos.liberaciones.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * DTO de respuesta para liberaciones (HITO-015).
 */
public class LiberacionDto {

    private Long id;
    private Long requerimientoId;
    private Long fundoId;
    private String fundoNombre;
    private Long loteId;
    private String loteNombre;
    private BigDecimal cantidadLiberada;
    private String observaciones;
    private BigDecimal papelConPostura;
    private BigDecimal sobreConCascarilla;
    private Instant fechaLiberacion;
    private String horaLiberacion;
    private Long creadoPor;
    private String creadoPorNombre;
    private Instant createdAt;

    private List<PlagaDto> plagas;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getRequerimientoId() { return requerimientoId; }
    public void setRequerimientoId(Long requerimientoId) { this.requerimientoId = requerimientoId; }

    public Long getFundoId() { return fundoId; }
    public void setFundoId(Long fundoId) { this.fundoId = fundoId; }

    public String getFundoNombre() { return fundoNombre; }
    public void setFundoNombre(String fundoNombre) { this.fundoNombre = fundoNombre; }

    public Long getLoteId() { return loteId; }
    public void setLoteId(Long loteId) { this.loteId = loteId; }

    public String getLoteNombre() { return loteNombre; }
    public void setLoteNombre(String loteNombre) { this.loteNombre = loteNombre; }

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

    public String getCreadoPorNombre() { return creadoPorNombre; }
    public void setCreadoPorNombre(String creadoPorNombre) { this.creadoPorNombre = creadoPorNombre; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public List<PlagaDto> getPlagas() { return plagas; }
    public void setPlagas(List<PlagaDto> plagas) { this.plagas = plagas; }

    public static class PlagaDto {
        private Long id;
        private String nombre;
        public PlagaDto() {}
        public PlagaDto(Long id, String nombre) { this.id = id; this.nombre = nombre; }
        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public String getNombre() { return nombre; }
        public void setNombre(String nombre) { this.nombre = nombre; }
    }
}
