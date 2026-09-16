package pe.sistema.insectosbeneficos.notificaciones;

import java.time.LocalDateTime;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Notificacion in-app persistida para el centro de notificaciones del mobile.
 * Cada evento de push/email también crea una fila aquí.
 *
 * REGLA: no se ejecuta DELETE fisico; se usa leido = true.
 */
@Entity
@Table(name = "notificaciones")
public class Notificacion extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    /** Usuario destinatario de la notificacion. */
    public Long usuarioId;

    /** Titulo corto de la notificacion. */
    public String titulo;

    /** Mensaje descriptivo. */
    public String mensaje;

    /** Tipo de notificacion: PROGRAMACION_PUBLICADA, REQUERIMIENTO_CREADO, CAMBIO_ESTADO, REQUERIMIENTO_ENTREGADO. */
    public String tipo;

    /** true = usuario ya la vio. */
    public boolean leido = false;

    /** Tabla de origen: PROGRAMACION, REQUERIMIENTO, etc. */
    public String referenciaTipo;

    /** ID del registro de origen. */
    public Long referenciaId;

    /** Fecha de creacion automatica. */
    public LocalDateTime fechaCreacion = LocalDateTime.now();
}
