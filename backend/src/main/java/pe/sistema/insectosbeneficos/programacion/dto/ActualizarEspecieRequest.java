package pe.sistema.insectosbeneficos.programacion.dto;

public class ActualizarEspecieRequest {
    private String nombre;
    private String estado;

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public String getEstado() { return estado; }
    public void setEstado(String estado) { this.estado = estado; }
}