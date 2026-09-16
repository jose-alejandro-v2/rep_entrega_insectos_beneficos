package pe.sistema.insectosbeneficos.usuarios.dto;

import java.time.Instant;

import pe.sistema.insectosbeneficos.usuarios.EstadoUsuario;

/**
 * Respuesta de usuario del CRUD /api/v1/usuarios. JAMAS incluye contrasenaHash.
 * ADR-A003 D-AUTH2-1: expone `rol` (nombre literal con espacios) y `rolId`
 * (FK a la tabla roles) en lugar del enum `perfil` de la v1.
 */
public class UsuarioDto {

    public Long id;
    public String usuario;
    public String nombre;
    public Long rolId;
    /** Nombre literal del rol: "Super Admin" | "Admin" | "Usuario". */
    public String rol;
    public EstadoUsuario estado;
    public boolean debeCambiarPassword;
    public String dni;
    /** Correo para notificaciones (HITO-018); null si no cargado. */
    public String email;
    public Long creadoPor;
    public Instant createdAt;
    public Instant updatedAt;
    public Instant lastLoginAt;
}