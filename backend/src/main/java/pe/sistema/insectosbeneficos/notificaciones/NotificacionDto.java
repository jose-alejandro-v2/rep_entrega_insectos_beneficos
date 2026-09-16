package pe.sistema.insectosbeneficos.notificaciones;

import java.time.format.DateTimeFormatter;

/**
 * DTO de respuesta para notificaciones in-app.
 * Alineado con la interfaz {@code Notificacion} en NotificacionesScreen.tsx.
 */
public class NotificacionDto {

    private Long id;
    private String titulo;
    private String mensaje;
    private String tipo;
    private boolean leido;
    private String fechaCreacion;

    public static NotificacionDto from(Notificacion n) {
        NotificacionDto dto = new NotificacionDto();
        dto.id = n.id;
        dto.titulo = n.titulo;
        dto.mensaje = n.mensaje;
        dto.tipo = n.tipo;
        dto.leido = n.leido;
        dto.fechaCreacion = n.fechaCreacion != null
                ? n.fechaCreacion.format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"))
                : null;
        return dto;
    }

    public Long getId() { return id; }
    public String getTitulo() { return titulo; }
    public String getMensaje() { return mensaje; }
    public String getTipo() { return tipo; }
    public boolean isLeido() { return leido; }
    public String getFechaCreacion() { return fechaCreacion; }
}
