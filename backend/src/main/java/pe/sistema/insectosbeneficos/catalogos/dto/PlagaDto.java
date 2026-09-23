package pe.sistema.insectosbeneficos.catalogos.dto;

public class PlagaDto {
    private Long id;
    private String nombre;
    private String estado;
    /** False si tiene requerimientos/liberaciones o esta INACTIVA (v1.16.0). */
    private boolean puedeEliminar;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public String getEstado() { return estado; }
    public void setEstado(String estado) { this.estado = estado; }
    public boolean isPuedeEliminar() { return puedeEliminar; }
    public void setPuedeEliminar(boolean puedeEliminar) { this.puedeEliminar = puedeEliminar; }
}
