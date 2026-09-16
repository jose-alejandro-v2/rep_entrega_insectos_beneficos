package pe.sistema.insectosbeneficos;

import io.quarkus.mailer.Mail;
import io.quarkus.mailer.MockMailbox;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;

/**
 * HITO-018 - Notificaciones por correo SMTP.
 *
 * Cubre el EVENTO 1 (RF-137/146, RN-018/039): al publicar una programacion
 * se envia un correo a TODOS los usuarios del rol "Usuario" ACTIVOS con
 * `email` cargado (la BD la comparte PostgresTestResource: anio/mes unicos).
 *
 * El EVENTO 2 (RF-166: requerimiento ENTREGADO -> correo al solicitante) se
 * cubre end-to-end en RequerimientoResourceTest (reutiliza su helper de stock).
 *
 * El mailer corre con `%test.quarkus.mailer.mock=true` (MockMailbox, sin SMTP):
 * cada test arranca con la bandeja limpia (Ley 5, sin red).
 */
@QuarkusTest
@QuarkusTestResource(PostgresTestResource.class)
public class NotificacionMailerTest {

    @Inject
    MockMailbox mailbox;

    @BeforeEach
    void limpiarBandeja() {
        mailbox.clear();
    }

    private Map<String, Object> crearUsuarioConEmail(String usuario, String email, long rolId) {
        Map<String, Object> body = TestSupport.crearBody(usuario, usuario, rolId);
        body.put("email", email);
        return body;
    }

    @Test
    public void publicarProgramacion_enviaCorreoASanidadConEmail() {
        // Usuario de Sanidad (rol Usuario) con email cargado.
        Map<String, Object> sanidad = crearUsuarioConEmail("sanidad_mail_v2", "sanidad@vanguardfresh.pe", TestSupport.ROL_USUARIO_ID);
        given().auth().oauth2(TestSupport.seedToken()).contentType(ContentType.JSON).body(sanidad)
                .post("/api/v1/usuarios").then().statusCode(201);

        // Admin tambien con email -> NO debe recibir (solo rol Usuario).
        Map<String, Object> admin = crearUsuarioConEmail("admin_mail_v2", "admin@vanguardfresh.pe", TestSupport.ROL_ADMIN_ID);
        given().auth().oauth2(TestSupport.seedToken()).contentType(ContentType.JSON).body(admin)
                .post("/api/v1/usuarios").then().statusCode(201);

        int anio = 2094;
        int mes = 2;
        given().auth().oauth2(TestSupport.seedToken()).contentType(ContentType.JSON)
                .body(Map.of("anio", anio, "mes", mes, "especieId", 1))
                .post("/api/v1/programaciones").then().statusCode(201);

        long progId = given().auth().oauth2(TestSupport.seedToken())
                .get("/api/v1/programaciones?anio=" + anio + "&mes=" + mes)
                .then().statusCode(200)
                .extract().jsonPath().getLong("[0].id");
        given().auth().oauth2(TestSupport.seedToken()).contentType(ContentType.JSON)
                .post("/api/v1/programaciones/" + progId + "/publicar")
                .then().statusCode(200);

        // Sanidad (rol Usuario con email) SI recibio el correo.
        List<Mail> mailsSanidad = mailbox.getMessagesSentTo("sanidad@vanguardfresh.pe");
        assertThat(mailsSanidad, not(empty()));
        assertThat(mailsSanidad.get(0).getSubject(), containsString("Programacion"));
        // Tabla COMPLETA en HTML: 7 columnas (Fecha/Semana/Stock Inicial/
        // Papel/Sobre/Total/Stock Final) + nota de millares.
        String html = mailsSanidad.get(0).getHtml();
        assertThat(html, containsString("<table"));
        assertThat(html, containsString("Stock Inicial"));
        assertThat(html, containsString("Papel con postura"));
        assertThat(html, containsString("Sobre con cascarilla"));
        assertThat(html, containsString("Stock Final"));
        assertThat(html, containsString("Valores en millares"));

        // El Admin (rol Admin) aun con email NO recibio el de publicacion.
        assertThat(mailbox.getMessagesSentTo("admin@vanguardfresh.pe"), empty());
    }

    @Test
    public void publicarProgramacion_sinUsuariosConEmail_noFalla() {
        // Usuario rol Sanidad SIN email cargado (email null).
        Map<String, Object> sinEmail = TestSupport.crearBody("sanidad_sin_mail_v2", "Sin Mail V2", TestSupport.ROL_USUARIO_ID);
        given().auth().oauth2(TestSupport.seedToken()).contentType(ContentType.JSON).body(sinEmail)
                .post("/api/v1/usuarios").then().statusCode(201);

        int anio = 2093;
        int mes = 3;
        given().auth().oauth2(TestSupport.seedToken()).contentType(ContentType.JSON)
                .body(Map.of("anio", anio, "mes", mes, "especieId", 1))
                .post("/api/v1/programaciones").then().statusCode(201);

        long progId = given().auth().oauth2(TestSupport.seedToken())
                .get("/api/v1/programaciones?anio=" + anio + "&mes=" + mes)
                .then().statusCode(200)
                .extract().jsonPath().getLong("[0].id");
        // Publicar NO debe fallar aunque nadie tenga email (best-effort).
        given().auth().oauth2(TestSupport.seedToken()).contentType(ContentType.JSON)
                .post("/api/v1/programaciones/" + progId + "/publicar")
                .then().statusCode(200)
                .body("estado", is("PUBLICADO"));

        assertThat(mailbox.getTotalMessagesSent(), is(0));
    }
}