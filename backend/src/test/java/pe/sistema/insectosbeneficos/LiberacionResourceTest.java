package pe.sistema.insectosbeneficos;

import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.response.Response;
import org.junit.jupiter.api.*;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

/**
 * Tests de los endpoints de liberaciones (HITO-015 / MOD-08 / V22):
 *   GET  /api/v1/requerimientos/{id}/liberaciones
 *   POST /api/v1/requerimientos/{id}/liberaciones
 *
 * RBAC: Liberaciones admin/usuario.
 * El seed (TestSupport) autentica con el Super Admin id=1.
 *
 * V22: fechaLiberacion editable + plagas por liberación.
 */
@QuarkusTest
@QuarkusTestResource(PostgresTestResource.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class LiberacionResourceTest {

    private static final long FUNDO_ID = 1L;
    private static final long LOTE_ID = 1L;
    private static final long ESPECIE_ID = 1L;
    private static final long PLAGA_ID = 1L;
    private static final String FECHA = "2026-09-14";

    private LocalDate calcularFechaCorte() {
        LocalDate hoy = LocalDate.now();
        DayOfWeek dow = hoy.getDayOfWeek();
        int diasDesdeLunes = dow.getValue() - 1;
        if (dow.getValue() <= 3) {
            return hoy.minusDays(diasDesdeLunes);
        } else {
            int diasDesdeJueves = (dow.getValue() - 4 + 7) % 7;
            return hoy.minusDays(diasDesdeJueves);
        }
    }

    @SuppressWarnings("unchecked")
    private void asegurarStockEspecie() {
        LocalDate hoy = LocalDate.now();
        int anio = hoy.getYear();
        int mes = hoy.getMonthValue();
        LocalDate fechaCorte = calcularFechaCorte();

        String progBody = "{\"anio\":" + anio + ",\"mes\":" + mes + ",\"especieId\":" + ESPECIE_ID + "}";
        long programacionId;
        Response postResp = given()
          .auth().oauth2(TestSupport.seedToken())
          .contentType(ContentType.JSON)
          .body(progBody)
          .when().post("/api/v1/programaciones")
          .then().extract().response();

        int statusCode = postResp.getStatusCode();
        if (statusCode == 409) {
            programacionId = given()
              .auth().oauth2(TestSupport.seedToken())
              .when().get("/api/v1/programaciones?anio=" + anio + "&mes=" + mes)
              .then().extract().jsonPath().getLong("[0].id");
        } else {
            programacionId = postResp.jsonPath().getLong("id");
        }

        List<Map<String, Object>> detalles = (List<Map<String, Object>>) (List<?>) given()
          .auth().oauth2(TestSupport.seedToken())
          .when().get("/api/v1/programaciones/" + programacionId)
          .then().extract().jsonPath().getList("detalles");

        for (Map<String, Object> d : detalles) {
            if (fechaCorte.toString().equals(d.get("fecha"))) {
                long detalleId = ((Number) d.get("id")).longValue();
                int semana = ((Number) d.get("semana")).intValue();
                String cumpleBody = "{\"programacionDetalleId\":" + detalleId
                    + ",\"semana\":" + semana
                    + ",\"fecha\":\"" + fechaCorte + "\""
                    + ",\"papelReal\":2500,\"sobreReal\":2500}";
                given()
                  .auth().oauth2(TestSupport.seedToken())
                  .contentType(ContentType.JSON)
                  .body(cumpleBody)
                  .when().put("/api/v1/programaciones/" + programacionId + "/cumplimiento")
                  .then().statusCode(anyOf(is(200), is(201)));
                return;
            }
        }
    }

    private Map<String, Object> crearBody(BigDecimal cantidad) {
        Map<String, Object> body = new HashMap<>();
        body.put("fecha", FECHA);
        body.put("fundoId", FUNDO_ID);
        body.put("loteId", LOTE_ID);
        body.put("especieId", ESPECIE_ID);
        body.put("cantidad", cantidad);
        body.put("plagaId", PLAGA_ID);
        body.put("observaciones", "Requerimiento de prueba");
        return body;
    }

    private long crearRequerimientoId(BigDecimal cantidad) {
        return given()
          .auth().oauth2(TestSupport.seedToken())
          .contentType(ContentType.JSON)
          .body(crearBody(cantidad))
          .when().post("/api/v1/requerimientos")
          .then().statusCode(201)
          .extract().jsonPath().getLong("id");
    }

    private void actualizarAEstado(long requerimientoId, String estado) {
        Map<String, Object> body = crearBody(new BigDecimal("10"));
        body.put("estado", estado);
        if ("ENTREGADO".equals(estado)) {
            body.put("papelConPostura", 5);
            body.put("sobreConCascarilla", 5);
        }
        given()
          .auth().oauth2(TestSupport.seedToken())
          .contentType(ContentType.JSON)
          .body(body)
          .when().put("/api/v1/requerimientos/" + requerimientoId)
          .then().statusCode(200);
    }

    private long crearRequerimientoEntregado() {
        asegurarStockEspecie();
        long id = crearRequerimientoId(new BigDecimal("10"));
        actualizarAEstado(id, "ENTREGADO");
        return id;
    }

    // ------------------------------------------------------------------
    // 1. Listar liberaciones de requerimiento inexistente -> 200 []
    // ------------------------------------------------------------------

    @Test
    @Order(1)
    void testListarLiberacionesRequerimientoInexistente() {
        given()
            .auth().oauth2(TestSupport.seedToken())
        .when()
            .get("/api/v1/requerimientos/99999/liberaciones")
        .then()
            .statusCode(200)
            .body("$", hasSize(0));
    }

    // ------------------------------------------------------------------
    // 2. Crear sin auth -> 401
    // ------------------------------------------------------------------

    @Test
    @Order(2)
    void testCrearLiberacionSinAuth() {
        given()
            .contentType(ContentType.JSON)
            .body("{\"cantidadLiberada\":100}")
        .when()
            .post("/api/v1/requerimientos/1/liberaciones")
        .then()
            .statusCode(401);
    }

    // ------------------------------------------------------------------
    // 3. Crear requerimiento inexistente -> 404
    // ------------------------------------------------------------------

    @Test
    @Order(3)
    void testCrearLiberacionRequerimientoInexistente() {
        given()
            .auth().oauth2(TestSupport.seedToken())
            .contentType(ContentType.JSON)
            .body("{\"cantidadLiberada\":100,\"fundoId\":1,\"loteId\":1,\"horaLiberacion\":\"08:00\"}")
        .when()
            .post("/api/v1/requerimientos/99999/liberaciones")
        .then()
            .statusCode(404)
            .body("codigo", equalTo("REQUERIMIENTO_NO_ENCONTRADO"));
    }

    // ------------------------------------------------------------------
    // 4. Body vacío -> 400
    // ------------------------------------------------------------------

    @Test
    @Order(4)
    void testCrearLiberacionBodyVacio() {
        given()
            .auth().oauth2(TestSupport.seedToken())
            .contentType(ContentType.JSON)
            .body("{}")
        .when()
            .post("/api/v1/requerimientos/1/liberaciones")
        .then()
            .statusCode(400);
    }

    // ------------------------------------------------------------------
    // 5. Crear liberación básica -> 201
    // ------------------------------------------------------------------

    @Test
    @Order(5)
    void testCrearLiberacionBasica() {
        long reqId = crearRequerimientoEntregado();
        String body = "{\"fundoId\":" + FUNDO_ID
            + ",\"loteId\":" + LOTE_ID
            + ",\"cantidadLiberada\":10"
            + ",\"horaLiberacion\":\"10:00\"}";

        given()
            .auth().oauth2(TestSupport.seedToken())
            .contentType(ContentType.JSON)
            .body(body)
        .when()
            .post("/api/v1/requerimientos/" + reqId + "/liberaciones")
        .then()
            .statusCode(201)
            .body("id", notNullValue())
            .body("loteId", is((int) LOTE_ID))
            .body("cantidadLiberada", is(10))
            .body("horaLiberacion", is("10:00"));
    }

    // ------------------------------------------------------------------
    // 6. Crear liberación con fechaLiberacion -> 201
    // ------------------------------------------------------------------

    @Test
    @Order(6)
    void testCrearLiberacionConFecha() {
        long reqId = crearRequerimientoEntregado();
        String body = "{\"fundoId\":" + FUNDO_ID
            + ",\"loteId\":" + LOTE_ID
            + ",\"cantidadLiberada\":10"
            + ",\"horaLiberacion\":\"14:30\""
            + ",\"fechaLiberacion\":\"2026-09-20\"}";

        long liberacionId = given()
            .auth().oauth2(TestSupport.seedToken())
            .contentType(ContentType.JSON)
            .body(body)
        .when()
            .post("/api/v1/requerimientos/" + reqId + "/liberaciones")
        .then()
            .statusCode(201)
            .body("id", notNullValue())
            .body("horaLiberacion", is("14:30"))
        .extract().jsonPath().getLong("id");

        // Verificar en listado
        given()
            .auth().oauth2(TestSupport.seedToken())
        .when()
            .get("/api/v1/requerimientos/" + reqId + "/liberaciones")
        .then()
            .statusCode(200)
            .body("size()", is(1))
            .body("[0].id", is((int) liberacionId))
            .body("[0].horaLiberacion", is("14:30"));
    }

    // ------------------------------------------------------------------
    // 7. Crear liberación con plagas -> 201
    // ------------------------------------------------------------------

    @Test
    @Order(7)
    void testCrearLiberacionConPlagas() {
        long reqId = crearRequerimientoEntregado();
        String body = "{\"fundoId\":" + FUNDO_ID
            + ",\"loteId\":" + LOTE_ID
            + ",\"cantidadLiberada\":10"
            + ",\"horaLiberacion\":\"09:00\""
            + ",\"plagas\":[" + PLAGA_ID + "]}";

        long liberacionId = given()
            .auth().oauth2(TestSupport.seedToken())
            .contentType(ContentType.JSON)
            .body(body)
        .when()
            .post("/api/v1/requerimientos/" + reqId + "/liberaciones")
        .then()
            .statusCode(201)
            .body("id", notNullValue())
        .extract().jsonPath().getLong("id");

        // Verificar plagas en listado
        given()
            .auth().oauth2(TestSupport.seedToken())
        .when()
            .get("/api/v1/requerimientos/" + reqId + "/liberaciones")
        .then()
            .statusCode(200)
            .body("size()", is(1))
            .body("[0].id", is((int) liberacionId))
            .body("[0].plagas", hasSize(1))
            .body("[0].plagas[0].id", is((int) PLAGA_ID));
    }

    // ------------------------------------------------------------------
    // 8. Crear liberación con fecha + plagas + papel/sobre -> 201
    // ------------------------------------------------------------------

    @Test
    @Order(8)
    void testCrearLiberacionConFechaYPlagas() {
        long reqId = crearRequerimientoEntregado();
        String body = "{\"fundoId\":" + FUNDO_ID
            + ",\"loteId\":" + LOTE_ID
            + ",\"cantidadLiberada\":10"
            + ",\"horaLiberacion\":\"11:00\""
            + ",\"fechaLiberacion\":\"2026-09-21\""
            + ",\"plagas\":[" + PLAGA_ID + "]"
            + ",\"papelConPostura\":3"
            + ",\"sobreConCascarilla\":7}";

        given()
            .auth().oauth2(TestSupport.seedToken())
            .contentType(ContentType.JSON)
            .body(body)
        .when()
            .post("/api/v1/requerimientos/" + reqId + "/liberaciones")
        .then()
            .statusCode(201)
            .body("id", notNullValue())
            .body("horaLiberacion", is("11:00"))
            .body("papelConPostura", is(3))
            .body("sobreConCascarilla", is(7))
            .body("plagas", hasSize(1))
            .body("plagas[0].id", is((int) PLAGA_ID));
    }

    // ------------------------------------------------------------------
    // 9. Plaga inexistente -> 404 PLAGA_NO_ENCONTRADA
    // ------------------------------------------------------------------

    @Test
    @Order(9)
    void testCrearLiberacionPlagaInexistente() {
        long reqId = crearRequerimientoEntregado();
        String body = "{\"fundoId\":" + FUNDO_ID
            + ",\"loteId\":" + LOTE_ID
            + ",\"cantidadLiberada\":10"
            + ",\"horaLiberacion\":\"09:00\""
            + ",\"plagas\":[999999]}";

        given()
            .auth().oauth2(TestSupport.seedToken())
            .contentType(ContentType.JSON)
            .body(body)
        .when()
            .post("/api/v1/requerimientos/" + reqId + "/liberaciones")
        .then()
            .statusCode(404)
            .body("codigo", equalTo("PLAGA_NO_ENCONTRADA"));
    }

    // ------------------------------------------------------------------
    // 10. Crear liberación en estado LIBERADO (ya con 1 lote liberado) -> 201
    // ------------------------------------------------------------------

    @Test
    @Order(10)
    void testCrearLiberacionEnEstadoLiberado() {
        long reqId = crearRequerimientoEntregado();
        String body1 = "{\"fundoId\":" + FUNDO_ID
            + ",\"loteId\":" + LOTE_ID
            + ",\"cantidadLiberada\":10"
            + ",\"horaLiberacion\":\"08:00\"}";

        // Primera liberación -> estado pasa a LIBERADO
        given()
            .auth().oauth2(TestSupport.seedToken())
            .contentType(ContentType.JSON)
            .body(body1)
        .when()
            .post("/api/v1/requerimientos/" + reqId + "/liberaciones")
        .then()
            .statusCode(201);

        // Segunda liberación en estado LIBERADO -> LOTE_YA_LIBERADO
        String body2 = "{\"fundoId\":" + FUNDO_ID
            + ",\"loteId\":" + LOTE_ID
            + ",\"cantidadLiberada\":10"
            + ",\"horaLiberacion\":\"09:00\"}";

        given()
            .auth().oauth2(TestSupport.seedToken())
            .contentType(ContentType.JSON)
            .body(body2)
        .when()
            .post("/api/v1/requerimientos/" + reqId + "/liberaciones")
        .then()
            .statusCode(400)
            .body("codigo", equalTo("LOTE_YA_LIBERADO"));
    }
}
