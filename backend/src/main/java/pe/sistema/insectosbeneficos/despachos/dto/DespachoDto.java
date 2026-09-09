package pe.sistema.insectosbeneficos.despachos.dto;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * DTO de respuesta para despachos (HITO-015).
 * Shape coherente con el patrón de otros DTOs del proyecto.
 */
public class DespachoDto {

    private Long id;
    private Long requerimientoId;
    private BigDecimal cantidadDespachada;
    private BigDecimal papelConPostura;
    private BigDecimal sobreConCascarilla;
    private String observaciones;
    private Long creadoPor;
    private String creadoPorNombre;
    private Instant createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getRequerimientoId() { return requerimientoId; }
    public void setRequerimientoId(Long requerimientoId) { this.requerimientoId = requerimientoId; }

    public BigDecimal getCantidadDespachada() { return cantidadDespachada; }
    public void setCantidadDespachada(BigDecimal cantidadDespachada) { this.cantidadDespachada = cantidadDespachada; }

    public BigDecimal getPapelConPostura() { return papelConPostura; }
    public void setPapelConPostura(BigDecimal papelConPostura) { this.papelConPostura = papelConPostura; }

    public BigDecimal getSobreConCascarilla() { return sobreConCascarilla; }
    public void setSobreConCascarilla(BigDecimal sobreConCascarilla) { this.sobreConCascarilla = sobreConCascarilla; }

    public String getObservaciones() { return observaciones; }
    public void setObservaciones(String observaciones) { this.observaciones = observaciones; }

    public Long getCreadoPor() { return creadoPor; }
    public void setCreadoPor(Long creadoPor) { this.creadoPor = creadoPor; }

    public String getCreadoPorNombre() { return creadoPorNombre; }
    public void setCreadoPorNombre(String creadoPorNombre) { this.creadoPorNombre = creadoPorNombre; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
