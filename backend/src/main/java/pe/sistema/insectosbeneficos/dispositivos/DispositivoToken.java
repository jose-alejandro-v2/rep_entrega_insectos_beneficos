package pe.sistema.insectosbeneficos.dispositivos;

import java.time.Instant;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Token FCM registrado por un dispositivo movil (ADR-A004).
 * Patron Panache active-record. Un usuario puede tener multiples
 * dispositivos; cada token es unico (UNIQUE en BD).
 *
 * REGLA: no se ejecuta DELETE fisico; se usa activo = false (soft delete).
 */
@Entity
@Table(name = "dispositivos_tokens")
public class DispositivoToken extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    /** FK al usuario que posee este dispositivo. */
    public Long usuarioId;

    /** Token FCM unico por dispositivo. Texto largo ( hasta ~512 chars). */
    public String fcmToken;

    /** Plataforma: android, ios, web. */
    public String platform = "android";

    /** Soft delete: false = token invalido/expirado. */
    public boolean activo = true;

    public Instant fechaRegistro = Instant.now();

    public Instant fechaActualizacion = Instant.now();
}
