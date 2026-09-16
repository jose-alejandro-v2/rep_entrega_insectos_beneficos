package pe.sistema.insectosbeneficos.usuarios;

import jakarta.enterprise.context.ApplicationScoped;

import pe.sistema.insectosbeneficos.usuarios.dto.UsuarioDto;
import pe.sistema.insectosbeneficos.usuarios.dto.UsuarioResumenDto;

/**
 * Convierte Usuario -> DTOs de salida (nunca expone contrasenaHash).
 * - toDto: CRUD /api/v1/usuarios (rol = nombre literal, rolId = FK).
 * - toResumen: Paso B del login 3 pasos (solo campos de autocompletado).
 */
@ApplicationScoped
public class UsuarioMapper {

    public UsuarioDto toDto(Usuario u) {
        UsuarioDto d = new UsuarioDto();
        d.id = u.id;
        d.usuario = u.usuario;
        d.nombre = u.nombre;
        d.rolId = u.rol != null ? u.rol.id : null;
        d.rol = u.rol != null ? u.rol.nombre : null;
        d.estado = u.estado;
        d.debeCambiarPassword = u.debeCambiarPassword;
        d.dni = u.dni;
        d.email = u.email;
        d.creadoPor = u.creadoPor;
        d.createdAt = u.createdAt;
        d.updatedAt = u.updatedAt;
        d.lastLoginAt = u.lastLoginAt;
        return d;
    }

    public UsuarioResumenDto toResumen(Usuario u) {
        return new UsuarioResumenDto(
                u.id,
                u.usuario,
                u.nombre,
                u.rol != null ? u.rol.id : null,
                u.debeCambiarPassword);
    }
}