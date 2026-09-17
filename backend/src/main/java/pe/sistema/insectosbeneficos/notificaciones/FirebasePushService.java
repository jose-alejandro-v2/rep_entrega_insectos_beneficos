package pe.sistema.insectosbeneficos.notificaciones;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.BatchResponse;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.MulticastMessage;
import com.google.firebase.messaging.Notification;
import com.google.firebase.messaging.SendResponse;

import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import org.jboss.logging.Logger;

import io.quarkus.runtime.Startup;

/**
 * Servicio de notificaciones push via Firebase Cloud Messaging (ADR-A004).
 *
 * Patrón: fire-and-forget. Si FCM falla, se loguea y NUNCA rompe la
 * transacción del negocio (best-effort, igual que NotificacionService SMTP).
 *
 * Configuración:
 * - Variable de entorno GOOGLE_FIREBASE_CREDENTIALS: contenido JSON inline
 *   del service account, o path al archivo.
 * - En tests (%test profile): no se inicializa Firebase (se usa mock).
 * - En dev sin env var: se deshabilita silenciosamente (sin push).
 */
@Startup
@ApplicationScoped
public class FirebasePushService {

    private static final Logger LOG = Logger.getLogger(FirebasePushService.class);

    @Inject
    pe.sistema.insectosbeneficos.dispositivos.DispositivoTokenService dispositivoTokenService;

    private boolean initialized = false;

    @PostConstruct
    void init() {
        // No inicializar en tests.
        String profile = System.getProperty("quarkus.profile",
                System.getenv().getOrDefault("QUARKUS_PROFILE", "prod"));
        if ("test".equals(profile)) {
            LOG.info("FirebasePushService deshabilitado en perfil test");
            return;
        }

        String creds = System.getenv("GOOGLE_FIREBASE_CREDENTIALS");
        if (creds == null || creds.isBlank()) {
            LOG.warn("GOOGLE_FIREBASE_CREDENTIALS no configurado — push deshabilitado");
            return;
        }

        try {
            GoogleCredentials credentials;
            if (creds.startsWith("{")) {
                credentials = GoogleCredentials.fromStream(
                        new ByteArrayInputStream(creds.getBytes(StandardCharsets.UTF_8)));
            } else {
                // Ruta a un archivo en el filesystem (volumen Docker) o, si no
                // existe, un recurso en el classpath.
                java.nio.file.Path path = java.nio.file.Paths.get(creds);
                java.io.InputStream in = java.nio.file.Files.exists(path)
                        ? java.nio.file.Files.newInputStream(path)
                        : getClass().getResourceAsStream(creds);
                if (in == null) {
                    LOG.errorf("GOOGLE_FIREBASE_CREDENTIALS apunta a recurso inexistente: %s", creds);
                    return;
                }
                credentials = GoogleCredentials.fromStream(in);
            }

            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(credentials)
                    .build();

            if (FirebaseApp.getApps().isEmpty()) {
                FirebaseApp.initializeApp(options);
            }
            initialized = true;
            LOG.info("FirebasePushService inicializado correctamente");
        } catch (IOException e) {
            LOG.error("Error inicializando Firebase — push deshabilitado", e);
        }
    }

    /**
     * Envía notificación push a una lista de tokens FCM (multicast).
     * Best-effort: tokens inválidos se desactivan, errores se loguean.
     *
     * @param titulo     título de la notificación
     * @param mensaje    cuerpo del mensaje
     * @param tokens     lista de tokens FCM destino
     * @return cantidad de envíos exitosos
     */
    public int enviar(String titulo, String mensaje, List<String> tokens) {
        if (!initialized || tokens == null || tokens.isEmpty()) {
            return 0;
        }

        MulticastMessage message = MulticastMessage.builder()
                .setNotification(Notification.builder()
                        .setTitle(titulo)
                        .setBody(mensaje)
                        .build())
                .putAllData(java.util.Map.of(
                        "titulo", titulo,
                        "mensaje", mensaje))
                .addAllTokens(tokens)
                .build();

        try {
            BatchResponse response = FirebaseMessaging.getInstance().sendEachForMulticast(message);
            int successCount = response.getSuccessCount();
            int failCount = response.getFailureCount();

            LOG.infof("FCM: %d exitosos, %d fallidos de %d totales", successCount, failCount, tokens.size());

            // Desactivar tokens inválidos.
            if (failCount > 0) {
                List<SendResponse> responses = response.getResponses();
                for (int i = 0; i < responses.size(); i++) {
                    SendResponse sendResponse = responses.get(i);
                    if (!sendResponse.isSuccessful()) {
                        String error = sendResponse.getException() != null
                                ? sendResponse.getException().getErrorCode().name()
                                : "unknown";
                        if ("UNREGISTERED".equals(error) || "INVALID_ARGUMENT".equals(error)) {
                            String token = tokens.get(i);
                            dispositivoTokenService.eliminar(token);
                            LOG.infof("Token inválido desactivado: %s", error);
                        }
                    }
                }
            }

            return successCount;
        } catch (FirebaseMessagingException e) {
            LOG.errorf("Error enviando push FCM: %s", e.getMessage());
            return 0;
        }
    }

    /**
     * Convenience: envía a todos los tokens activos registrados.
     */
    public int enviarBroadcast(String titulo, String mensaje) {
        List<String> tokens = dispositivoTokenService.obtenerTokensActivos();
        return enviar(titulo, mensaje, tokens);
    }

    /**
     * Convenience: envía a todos los tokens activos EXCEPTO los de un usuario específico.
     * Útil para broadcast donde el remitente no debe recibir su propia notificación.
     */
    public int enviarBroadcastExcluding(String titulo, String mensaje, Long excludeUsuarioId) {
        List<String> tokens = dispositivoTokenService.obtenerTokensActivosExcluding(excludeUsuarioId);
        return enviar(titulo, mensaje, tokens);
    }

    /**
     * Convenience: envía a un usuario específico (sus tokens activos).
     */
    public void enviarAUsuario(Long usuarioId, String titulo, String mensaje) {
        List<String> tokens = dispositivoTokenService.obtenerTokensDeUsuario(usuarioId);
        enviar(titulo, mensaje, tokens);
    }
}
