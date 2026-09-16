package pe.sistema.insectosbeneficos.usuarios.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import pe.sistema.insectosbeneficos.usuarios.EstadoUsuario;

/**
 * Cuerpo de PUT /api/v1/usuarios/{id}.
 * No permite cambiar password, dni ni debe_cambiar_password (reglas de la task
 * BE-004): esos campos no existen en este DTO.
 */
public class ActualizarUsuarioRequest {

    @NotBlank(message = "El usuario es obligatorio")
    @Size(max = 150, message = "El usuario no puede superar 150 caracteres")
    public String usuario;

    @NotBlank(message = "El nombre es obligatorio")
    @Size(max = 150, message = "El nombre no puede superar 150 caracteres")
    public String nombre;

    @NotNull(message = "El rol es obligatorio")
    public Long rolId;

    @NotNull(message = "El estado es obligatorio")
    public EstadoUsuario estado;

    /** Correo para notificaciones (HITO-018). null o vacio limpia el correo. */
    public String email;
}