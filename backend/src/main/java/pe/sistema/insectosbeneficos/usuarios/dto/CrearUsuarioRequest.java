package pe.sistema.insectosbeneficos.usuarios.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Cuerpo de POST /api/v1/usuarios.
 * La contrasena SIEMPRE nace como 00000000 hasheada con
 * debeCambiarPassword = true (ADR-A002 D-AUTH-3 / ADR-A003 D-AUTH2-1):
 * no se acepta contrasena en la creacion.
 */
public class CrearUsuarioRequest {

    @NotBlank(message = "El usuario es obligatorio")
    @Size(max = 150, message = "El usuario no puede superar 150 caracteres")
    public String usuario;

    @NotBlank(message = "El nombre es obligatorio")
    @Size(max = 150, message = "El nombre no puede superar 150 caracteres")
    public String nombre;

    @NotNull(message = "El rol es obligatorio")
    public Long rolId;

    /** DNI opcional; si se indica debe ser numerico (0-9) y de hasta 8 digitos. */
    @Pattern(regexp = "[0-9]+", message = "El DNI debe ser numérico (solo dígitos 0-9)")
    @Size(max = 8, message = "El DNI no puede superar 8 dígitos")
    public String dni;

    /** Correo opcional para notificaciones (HITO-018). El service lo normaliza
     *  (trim + lowercase), valida formato y unicidad; vacio/null = sin correo. */
    public String email;
}