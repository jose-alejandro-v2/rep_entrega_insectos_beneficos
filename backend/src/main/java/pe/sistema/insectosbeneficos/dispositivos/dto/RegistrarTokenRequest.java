package pe.sistema.insectosbeneficos.dispositivos.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Request para registrar un token FCM desde el mobile (ADR-A004 D-PUSH-3).
 */
public class RegistrarTokenRequest {

    @NotBlank(message = "El token FCM es requerido")
    private String token;

    private String platform;

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public String getPlatform() { return platform; }
    public void setPlatform(String platform) { this.platform = platform; }
}
