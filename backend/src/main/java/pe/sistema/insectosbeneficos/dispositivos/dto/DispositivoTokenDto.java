package pe.sistema.insectosbeneficos.dispositivos.dto;

import java.time.Instant;

/**
 * DTO de respuesta para dispositivos registrados.
 */
public class DispositivoTokenDto {

    private Long id;
    private Long usuarioId;
    private String platform;
    private boolean activo;
    private Instant fechaRegistro;

    public DispositivoTokenDto(Long id, Long usuarioId, String platform, boolean activo, Instant fechaRegistro) {
        this.id = id;
        this.usuarioId = usuarioId;
        this.platform = platform;
        this.activo = activo;
        this.fechaRegistro = fechaRegistro;
    }

    public Long getId() { return id; }
    public Long getUsuarioId() { return usuarioId; }
    public String getPlatform() { return platform; }
    public boolean isActivo() { return activo; }
    public Instant getFechaRegistro() { return fechaRegistro; }
}
