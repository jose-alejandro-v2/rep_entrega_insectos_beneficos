package pe.sistema.insectosbeneficos.programacion.dto;

import java.util.List;

public class UpdateProgramacionRequest {
    private Integer stockInicialBase;
    private List<UpdateDetalleRequest> detalles;
    /** true cuando el PUT es el volcado inicial tras POST /programaciones (flujo crear). */
    private Boolean esCreacionInicial = false;

    public Integer getStockInicialBase() { return stockInicialBase; }
    public void setStockInicialBase(Integer stockInicialBase) { this.stockInicialBase = stockInicialBase; }
    public List<UpdateDetalleRequest> getDetalles() { return detalles; }
    public void setDetalles(List<UpdateDetalleRequest> detalles) { this.detalles = detalles; }
    public Boolean getEsCreacionInicial() { return esCreacionInicial; }
    public void setEsCreacionInicial(Boolean esCreacionInicial) { this.esCreacionInicial = esCreacionInicial; }

    public static class UpdateDetalleRequest {
        private Long id;
        private String fecha;
        private Integer semana;
        private Integer papelConPostura;
        private Integer sobreConCascarilla;

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public String getFecha() { return fecha; }
        public void setFecha(String fecha) { this.fecha = fecha; }
        public Integer getSemana() { return semana; }
        public void setSemana(Integer semana) { this.semana = semana; }
        public Integer getPapelConPostura() { return papelConPostura; }
        public void setPapelConPostura(Integer papelConPostura) { this.papelConPostura = papelConPostura; }
        public Integer getSobreConCascarilla() { return sobreConCascarilla; }
        public void setSobreConCascarilla(Integer sobreConCascarilla) { this.sobreConCascarilla = sobreConCascarilla; }
    }
}
