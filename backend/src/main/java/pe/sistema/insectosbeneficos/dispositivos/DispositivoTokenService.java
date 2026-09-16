package pe.sistema.insectosbeneficos.dispositivos;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

import org.jboss.logging.Logger;

import pe.sistema.insectosbeneficos.dispositivos.dto.DispositivoTokenDto;
import pe.sistema.insectosbeneficos.dispositivos.dto.RegistrarTokenRequest;

/**
 * Service para gestionar tokens FCM de dispositivos (ADR-A004).
 */
@ApplicationScoped
public class DispositivoTokenService {

    private static final Logger LOG = Logger.getLogger(DispositivoTokenService.class);

    @Inject
    DispositivoTokenRepository repository;

    /**
     * Registra un token FCM para un usuario. Si el token ya existe y esta
     * inactivo, lo reactiva. Si ya esta activo, actualiza la fecha.
     */
    @Transactional
    public DispositivoTokenDto registrar(Long usuarioId, RegistrarTokenRequest req) {
        String token = req.getToken().trim();
        String platform = req.getPlatform() != null ? req.getPlatform().trim() : "android";

        var existente = repository.findByToken(token);
        if (existente.isPresent()) {
            DispositivoToken dt = existente.get();
            dt.activo = true;
            dt.platform = platform;
            dt.fechaActualizacion = Instant.now();
            LOG.infof("Token reactivado: usuarioId=%d, platform=%s", usuarioId, platform);
            return toDto(dt);
        }

        DispositivoToken dt = new DispositivoToken();
        dt.usuarioId = usuarioId;
        dt.fcmToken = token;
        dt.platform = platform;
        dt.activo = true;
        dt.fechaRegistro = Instant.now();
        dt.fechaActualizacion = Instant.now();
        repository.persist(dt);
        LOG.infof("Token registrado: usuarioId=%d, platform=%s", usuarioId, platform);
        return toDto(dt);
    }

    /** Soft delete de un token (desactivar). */
    @Transactional
    public void eliminar(String fcmToken) {
        repository.desactivar(fcmToken);
        LOG.infof("Token desactivado: %s", fcmToken.substring(0, Math.min(20, fcmToken.length())) + "...");
    }

    /** Elimina todos los tokens de un usuario (logout completo). */
    @Transactional
    public void eliminarTodosDeUsuario(Long usuarioId) {
        repository.desactivarTodosDeUsuario(usuarioId);
        LOG.infof("Todos los tokens desactivados para usuarioId=%d", usuarioId);
    }

    /** Lista los tokens activos de un usuario. */
    public List<DispositivoTokenDto> listarPorUsuario(Long usuarioId) {
        return repository.findActivosByUsuario(usuarioId).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    /** Retorna todos los tokens activos (para broadcast). */
    public List<String> obtenerTokensActivos() {
        return repository.findAllActivos().stream()
                .map(dt -> dt.fcmToken)
                .collect(Collectors.toList());
    }

    /** Retorna los tokens activos de un usuario específico (para envío dirigido). */
    public List<String> obtenerTokensDeUsuario(Long usuarioId) {
        return repository.findActivosByUsuario(usuarioId).stream()
                .map(dt -> dt.fcmToken)
                .collect(Collectors.toList());
    }

    private DispositivoTokenDto toDto(DispositivoToken dt) {
        return new DispositivoTokenDto(dt.id, dt.usuarioId, dt.platform, dt.activo, dt.fechaRegistro);
    }
}
