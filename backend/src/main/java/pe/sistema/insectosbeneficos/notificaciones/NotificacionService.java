package pe.sistema.insectosbeneficos.notificaciones;

import io.quarkus.mailer.Mail;
import io.quarkus.mailer.reactive.ReactiveMailer;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import org.jboss.logging.Logger;

import pe.sistema.insectosbeneficos.programacion.CumplimientoProgramacion;
import pe.sistema.insectosbeneficos.programacion.Programacion;
import pe.sistema.insectosbeneficos.programacion.DetalleProgramacion;
import pe.sistema.insectosbeneficos.requerimientos.Requerimiento;
import pe.sistema.insectosbeneficos.usuarios.EstadoUsuario;
import pe.sistema.insectosbeneficos.usuarios.Usuario;

import java.util.List;

/**
 * Notificaciones multi-canal: correo SMTP (HITO-018) + push FCM (ADR-A004).
 *
 * Reglas de la capa:
 * - BEST-EFFORT: nunca lanza excepciones al llamador. Un fallo de SMTP o FCM
 *   se loguea y NO rompe la transaccion del negocio (Ley 4).
 * - Correo: destinatario es el email cargado en `usuarios.email`; si el usuario
 *   no tiene email, se omite.
 * - Push: destinatario son todos los tokens FCM activos (broadcast) o los de
 *   un usuario específico (dirigido).
 * - Envio ASINCRONO (reactive mailer + firebase async): no bloquea la transaccion.
 */
@ApplicationScoped
public class NotificacionService {

    private static final Logger LOG = Logger.getLogger(NotificacionService.class);

    @Inject
    ReactiveMailer mailer;

    @Inject
    FirebasePushService pushService;

    @Inject
    NotificacionRepository notificacionRepo;

    // ------------------------------------------------------------------
    // Evento 1: Programacion publicada (RF-137/RF-146, RN-018/RN-039)
    // ------------------------------------------------------------------

    /**
     * Notifica por correo + push a TODOS los usuarios ACTIVOS que tengan email cargado
     * que la programacion fue publicada (Admin + Usuario).
     * El push broadcast EXCLUYE al usuario que publicó (para que no reciba su propia notificación).
     */
    public void notificarProgramacionPublicada(Programacion p, Long excludeUsuarioId) {
        try {
            List<Usuario> destinatarios = Usuario.list(
                    "estado = ?1 and rol.nombre = ?2",
                    EstadoUsuario.ACTIVO, "Usuario");
            if (destinatarios.isEmpty()) {
                return;
            }
            String especie = p.getEspecie() != null && p.getEspecie().getNombre() != null
                    ? p.getEspecie().getNombre()
                    : "sin especie";
            String periodo = p.getMes() + "/" + p.getAnio();
            String tituloCorreo = "Programacion " + p.getAnio() + "-" + p.getMes() + " publicada";
            String tituloPush = "Nueva programación disponible";
            String mensajePush = "Se publicó la programación de " + especie + " para " + periodo;

            for (Usuario u : destinatarios) {
                // Persistir notificacion in-app
                persistir(u.id, tituloPush, mensajePush, "PROGRAMACION_PUBLICADA",
                        "PROGRAMACION", p.getId());

                // Correo (solo si tiene email)
                if (u.email != null && !u.email.isBlank()) {
                    String html = construirHtmlProgramacion(u.nombre, especie, periodo,
                            p.getStockInicialBase(), p.getDetalles());
                    enviarHtml(u.email, tituloCorreo, html);
                }
            }

            // Push broadcast excluyendo al que publicó
            pushService.enviarBroadcastExcluding(tituloPush, mensajePush, excludeUsuarioId);
        } catch (Exception e) {
            LOG.error("Fallo la notificacion de programacion publicada", e);
        }
    }

    /**
     * Arma el cuerpo HTML del aviso de publicacion con la tabla completa de
     * la proyeccion mensual (7 columnas).
     */
    private String construirHtmlProgramacion(String nombreUsuario, String especie, String periodo,
            Integer stockBase, List<pe.sistema.insectosbeneficos.programacion.DetalleProgramacion> detalles) {
        StringBuilder h = new StringBuilder();
        h.append("<!DOCTYPE html><html lang=\"es\"><head><meta charset=\"UTF-8\"></head><body>");
                h.append("<p>Este es solo un <b>Correo de Prueba de Aplicativo: Entrega de Insectos Benéficos...</b> </p>");

        h.append("<p>Hola ").append(escapeHtml(nombreUsuario)).append(",</p>");
        h.append("<p>Se public&oacute; la programaci&oacute;n de <strong>")
                .append(escapeHtml(especie)).append("</strong> para <strong>")
                .append(escapeHtml(periodo)).append("</strong> (stock base ")
                .append(stockBase != null ? stockBase : 0).append(" millares).</p>");
        if (detalles == null || detalles.isEmpty()) {
            h.append("<p>Sin detalle registrado para este periodo.</p>");
        } else {
            h.append("<table border=\"1\" cellpadding=\"6\" cellspacing=\"0\" ")
                    .append("style=\"border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;\">");
            h.append("<thead><tr style=\"background-color:#e8f5e9;\">")
                    .append("<th>Fecha</th><th>Semana</th><th>Stock Inicial</th>")
                    .append("<th>Papel con postura</th><th>Sobre con cascarilla</th>")
                    .append("<th>Total</th><th>Stock Final</th>")
                    .append("</tr></thead><tbody>");
            for (pe.sistema.insectosbeneficos.programacion.DetalleProgramacion d : detalles) {
                h.append("<tr>")
                        .append("<td>").append(d.getFecha() != null ? d.getFecha().toString() : "-").append("</td>")
                        .append("<td>").append(d.getSemana() != null ? d.getSemana() : 0).append("</td>")
                        .append("<td>").append(d.getStockInicial() != null ? d.getStockInicial() : 0).append("</td>")
                        .append("<td>").append(d.getPapelConPostura() != null ? d.getPapelConPostura() : 0).append("</td>")
                        .append("<td>").append(d.getSobreConCascarilla() != null ? d.getSobreConCascarilla() : 0).append("</td>")
                        .append("<td>").append(d.getTotal() != null ? d.getTotal() : 0).append("</td>")
                        .append("<td>").append(d.getStockFinal() != null ? d.getStockFinal() : 0).append("</td>")
                        .append("</tr>");
            }
            h.append("</tbody></table>");
            h.append("<p style=\"font-size:12px;color:#616161;\">Valores en millares.</p>");
        }
        h.append("<p>Revise el detalle en el aplicativo.</p>");
        h.append("</body></html>");
        return h.toString();
    }

    /** Escape minimo para interpolar nombres en el HTML. */
    private String escapeHtml(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;");
    }

    // ------------------------------------------------------------------
    // Evento 5: Cumplimiento de produccion registrado (v1.17.0)
    // ------------------------------------------------------------------

    /**
     * Notifica por in-app + push + correo a TODOS los usuarios activos EXCEPTO
     * al admin que guardo el registro (excludeUsuarioId), que se creo o
     * actualizo un cumplimiento de produccion.
     *
     * La exclusion aplica a los 3 canales (push, in-app y correo) — decision
     * aprobada. Best-effort: un fallo se loguea y NUNCA rompe la transaccion.
     */
    public void notificarCumplimientoRegistrado(CumplimientoProgramacion c, Long excludeUsuarioId) {
        try {
            if (c == null || c.getProgramacion() == null) {
                return;
            }
            Programacion p = c.getProgramacion();
            DetalleProgramacion d = c.getProgramacionDetalle();

            String especie = p.getEspecie() != null && p.getEspecie().getNombre() != null
                    ? p.getEspecie().getNombre()
                    : "sin especie";
            String periodo = p.getMes() + "/" + p.getAnio();
            String fecha = c.getFecha() != null ? c.getFecha().toString() : "-";
            String fechaCorta = c.getFecha() != null
                    ? String.format("%02d/%02d/%d",
                            c.getFecha().getDayOfMonth(), c.getFecha().getMonthValue(),
                            c.getFecha().getYear())
                    : "-";

            // Cumplimiento % (guardar contra division por cero)
            int totalProgramado = d != null && d.getTotal() != null ? d.getTotal() : 0;
            int pct = totalProgramado > 0
                    ? Math.round(c.getTotalReal() * 100f / totalProgramado)
                    : 0;

            // Quien registro (para el cuerpo del mensaje)
            String nombreActor = "Un administrador";
            if (excludeUsuarioId != null) {
                Usuario actor = Usuario.findById(excludeUsuarioId);
                if (actor != null && actor.nombre != null && !actor.nombre.isBlank()) {
                    nombreActor = actor.nombre;
                }
            }

            String tituloPush = "Producción registrada";
            String mensajePush = nombreActor + " registró " + c.getTotalReal()
                    + " millares (" + c.getPapelReal() + " papel / " + c.getSobreReal()
                    + " sobre) para " + fecha + " — programación " + especie + "/" + periodo
                    + ". Cumplimiento: " + pct + "%.";

            String tituloCorreo = "Producción registrada — programación " + periodo
                    + " (" + fechaCorta + ")";

            // Destinatarios: activos EXCEPTO el que guardo (exclusion en los 3 canales).
            // Null-safe: si excludeUsuarioId es null, notificar a todos los activos
            // (mismo patron que DispositivoTokenRepository.findAllActivosExcluding).
            List<Usuario> destinatarios;
            if (excludeUsuarioId != null) {
                destinatarios = Usuario.list(
                        "estado = ?1 and id != ?2", EstadoUsuario.ACTIVO, excludeUsuarioId);
            } else {
                destinatarios = Usuario.list("estado = ?1", EstadoUsuario.ACTIVO);
            }
            if (destinatarios.isEmpty()) {
                return;
            }

            for (Usuario u : destinatarios) {
                // In-app
                persistir(u.id, tituloPush, mensajePush, "CUMPLIMIENTO_REGISTRADO",
                        "PROGRAMACION", p.getId());

                // Correo (solo si tiene email; exclude ya aplicado en la query)
                if (u.email != null && !u.email.isBlank()) {
                    String html = construirHtmlCumplimiento(u.nombre, nombreActor, especie,
                            periodo, fechaCorta, c, d, pct);
                    enviarHtml(u.email, tituloCorreo, html);
                }
            }

            // Push broadcast excluyendo al que guardo
            pushService.enviarBroadcastExcluding(tituloPush, mensajePush, excludeUsuarioId);
        } catch (Exception e) {
            LOG.error("Fallo la notificacion de cumplimiento registrado", e);
        }
    }

    /**
     * Arma el cuerpo HTML del aviso de cumplimiento de produccion:
     * resumen de la programacion + tabla programado vs real + % cumplimiento.
     */
    private String construirHtmlCumplimiento(String nombreUsuario, String nombreActor,
            String especie, String periodo, String fechaCorta,
            CumplimientoProgramacion c, DetalleProgramacion d, int pct) {
        StringBuilder h = new StringBuilder();
        h.append("<!DOCTYPE html><html lang=\"es\"><head><meta charset=\"UTF-8\"></head><body>");
        h.append("<p>Este es solo un <b>Correo de Prueba de Aplicativo: Entrega de Insectos Benéficos...</b> </p>");

        h.append("<p>Hola ").append(escapeHtml(nombreUsuario)).append(",</p>");
        h.append("<p><strong>").append(escapeHtml(nombreActor))
                .append("</strong> registr&oacute; el cumplimiento de producci&oacute;n para:</p>");

        // Tabla resumen
        h.append("<table border=\"1\" cellpadding=\"6\" cellspacing=\"0\" ")
                .append("style=\"border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;\">");
        h.append("<thead><tr style=\"background-color:#e8f5e9;\">")
                .append("<th>Programación</th><th>Especie</th><th>Fecha</th><th>Semana</th>")
                .append("</tr></thead><tbody>");
        h.append("<tr>")
                .append("<td>").append(escapeHtml(periodo)).append("</td>")
                .append("<td>").append(escapeHtml(especie)).append("</td>")
                .append("<td>").append(escapeHtml(fechaCorta)).append("</td>")
                .append("<td>").append(c.getSemana()).append("</td>")
                .append("</tr>");
        h.append("</tbody></table>");

        h.append("<br/>");

        // Tabla programado vs real
        int progPapel = d != null && d.getPapelConPostura() != null ? d.getPapelConPostura() : 0;
        int progSobre = d != null && d.getSobreConCascarilla() != null ? d.getSobreConCascarilla() : 0;
        int progTotal = d != null && d.getTotal() != null ? d.getTotal() : 0;

        h.append("<table border=\"1\" cellpadding=\"6\" cellspacing=\"0\" ")
                .append("style=\"border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;\">");
        h.append("<thead><tr style=\"background-color:#e8f5e9;\">")
                .append("<th>Concepto</th><th>Programado</th><th>Real</th>")
                .append("</tr></thead><tbody>");
        h.append("<tr><td>Papel con postura</td><td>").append(progPapel)
                .append("</td><td>").append(c.getPapelReal()).append("</td></tr>");
        h.append("<tr><td>Sobre con cascarilla</td><td>").append(progSobre)
                .append("</td><td>").append(c.getSobreReal()).append("</td></tr>");
        h.append("<tr style=\"font-weight:bold;\"><td>Total</td><td>").append(progTotal)
                .append("</td><td>").append(c.getTotalReal()).append("</td></tr>");
        h.append("<tr><td>Cumplimiento</td><td>—</td><td>").append(pct).append("%</td></tr>");
        h.append("</tbody></table>");

        h.append("<p style=\"font-size:12px;color:#616161;\">Valores en millares.</p>");
        h.append("<p>Revise el detalle en el aplicativo.</p>");
        h.append("</body></html>");
        return h.toString();
    }

    // ------------------------------------------------------------------
    // Evento 2: Requerimiento entregado (RF-166, RN-027)
    // ------------------------------------------------------------------

    /**
     * Notifica al usuario SOLICITANTE (creadoPor) por correo + push que su
     * requerimiento fue marcado como ENTREGADO por I+D.
     */
    public void notificarRequerimientoEntregado(Requerimiento r) {
        try {
            if (r.getCreadoPor() == null) {
                return;
            }
            Usuario solicitante = Usuario.findById(r.getCreadoPor());
            if (solicitante == null) {
                return;
            }

            String tituloPush = "Requerimiento #" + r.getId() + " entregado";
            String mensajePush = "Su requerimiento de " + r.getCantidad() + " millares de "
                    + r.getEspecie().getNombre() + " fue marcado como ENTREGADO.";

            // Persistir notificacion in-app
            persistir(r.getCreadoPor(), tituloPush, mensajePush, "REQUERIMIENTO_ENTREGADO",
                    "REQUERIMIENTO", r.getId());

            // Correo (solo si tiene email)
            if (solicitante.email != null && !solicitante.email.isBlank()) {
                String tituloCorreo = "Requerimiento #" + r.getId() + " entregado";
                String cuerpo = "Su requerimiento de " + r.getCantidad() + " millares de "
                        + r.getEspecie().getNombre() + " fue marcado como ENTREGADO por I+D.\n"
                        + "Confirme la recepcion en el aplicativo.";
                enviar(solicitante.email, "Hola " + solicitante.nombre, tituloCorreo, cuerpo);
            }

            // Push dirigido al solicitante
            pushService.enviarAUsuario(r.getCreadoPor(), tituloPush, mensajePush);
        } catch (Exception e) {
            LOG.error("Fallo la notificacion de requerimiento entregado", e);
        }
    }

    // ------------------------------------------------------------------
    // Evento 3: Requerimiento creado (nuevo — ADR-A004)
    // ------------------------------------------------------------------

    /**
     * Notifica por push BROADCAST a todos los usuarios que un nuevo requerimiento
     * fue registrado por un usuario de Sanidad.
     * El push broadcast EXCLUYE al usuario que creó el requerimiento.
     */
    public void notificarRequerimientoCreado(Requerimiento r) {
        try {
            String nombreUsuario = "Usuario";
            if (r.getCreadoPor() != null) {
                Usuario creador = Usuario.findById(r.getCreadoPor());
                if (creador != null) {
                    nombreUsuario = creador.nombre;
                }
            }

            String especie = r.getEspecie() != null ? r.getEspecie().getNombre() : "insectos benéficos";
            String titulo = "Nuevo requerimiento registrado";
            String mensaje = nombreUsuario + " solicitó " + r.getCantidad() + " millares de " + especie;

            // Persistir notificacion in-app para todos los usuarios activos
            List<Usuario> todos = Usuario.list("estado = ?1", EstadoUsuario.ACTIVO);
            for (Usuario u : todos) {
                persistir(u.id, titulo, mensaje, "REQUERIMIENTO_CREADO",
                        "REQUERIMIENTO", r.getId());
            }

            // Push broadcast excluyendo al que creó el requerimiento
            pushService.enviarBroadcastExcluding(titulo, mensaje, r.getCreadoPor());
        } catch (Exception e) {
            LOG.error("Fallo la notificacion de requerimiento creado", e);
        }
    }

    // ------------------------------------------------------------------
    // Evento 4: Cambio de estado de requerimiento (ADR-A004)
    // ------------------------------------------------------------------

    /**
     * Notifica al solicitante por push cuando su requerimiento cambia de estado.
     */
    public void notificarCambioEstado(Requerimiento r, String estadoAnterior, String estadoNuevo) {
        try {
            if (r.getCreadoPor() == null) {
                return;
            }

            String titulo = "Estado actualizado";
            String mensaje = "Su requerimiento #" + r.getId() + " cambió de " + estadoAnterior
                    + " a " + estadoNuevo;

            // Persistir notificacion in-app
            persistir(r.getCreadoPor(), titulo, mensaje, "CAMBIO_ESTADO",
                    "REQUERIMIENTO", r.getId());

            pushService.enviarAUsuario(r.getCreadoPor(), titulo, mensaje);
        } catch (Exception e) {
            LOG.error("Fallo la notificacion de cambio de estado", e);
        }
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    /** Persiste una notificacion in-app (best-effort). */
    private void persistir(Long usuarioId, String titulo, String mensaje, String tipo,
                           String referenciaTipo, Long referenciaId) {
        try {
            Notificacion n = new Notificacion();
            n.usuarioId = usuarioId;
            n.titulo = titulo;
            n.mensaje = mensaje;
            n.tipo = tipo;
            n.referenciaTipo = referenciaTipo;
            n.referenciaId = referenciaId;
            notificacionRepo.persist(n);
        } catch (Exception e) {
            LOG.warnf("No se pudo persistir notificacion para usuario %d: %s", usuarioId, e.getMessage());
        }
    }

    /** Envio HTML async (fire-and-forget): no bloquea la transaccion. */
    private void enviarHtml(String to, String titulo, String html) {
        mailer.send(Mail.withHtml(to, titulo, html))
                .subscribe().with(
                        v -> LOG.infof("Correo enviado a %s: %s", to, titulo),
                        e -> LOG.warnf("No se pudo enviar el correo a %s (%s): %s", to, titulo, e.getMessage()));
    }

    /** Envio async (fire-and-forget): no bloquea la transaccion. */
    private void enviar(String to, String saludo, String titulo, String cuerpo) {
        mailer.send(Mail.withText(to, titulo, saludo + ",\n\n" + cuerpo))
                .subscribe().with(
                        v -> LOG.infof("Correo enviado a %s: %s", to, titulo),
                        e -> LOG.warnf("No se pudo enviar el correo a %s (%s): %s", to, titulo, e.getMessage()));
    }
}
