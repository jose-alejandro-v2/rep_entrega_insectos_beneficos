package pe.sistema.insectosbeneficos;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
public class CumplimientoProgramacionResourceTest {

    @Test
    public void testListarCumplimientoSinDatos() {
        // Crear programación primero
        Integer programacionId = given()
            .auth().oauth2(TestSupport.seedToken())
            .contentType(ContentType.JSON)
            .body(Map.of(
                "anio", 2026,
                "mes", 9,
                "especieId", 1
            ))
            .when().post("/api/v1/programaciones")
            .then()
            .statusCode(201)
            .extract().path("id");

        // Listar cumplimiento (debe estar vacío)
        given()
            .auth().oauth2(TestSupport.seedToken())
            .when().get("/api/v1/programaciones/" + programacionId + "/cumplimiento")
            .then()
            .statusCode(200)
            .body("size()", is(0));
    }

    @Test
    public void testGuardarCumplimiento() {
        // Crear programación — mes 10 único en esta clase para evitar colisión con
        // testListarCumplimientoSinDatos (2026/9) al compartir BD Testcontainers.
        Integer programacionId = given()
            .auth().oauth2(TestSupport.seedToken())
            .contentType(ContentType.JSON)
            .body(Map.of(
                "anio", 2026,
                "mes", 10,
                "especieId", 1
            ))
            .when().post("/api/v1/programaciones")
            .then()
            .statusCode(201)
            .extract().path("id");

        // Obtener el primer detalle
        Integer detalleId = given()
            .auth().oauth2(TestSupport.seedToken())
            .when().get("/api/v1/programaciones/" + programacionId)
            .then()
            .statusCode(200)
            .extract().jsonPath().getInt("detalles[0].id");

        // Guardar cumplimiento
        given()
            .auth().oauth2(TestSupport.seedToken())
            .contentType(ContentType.JSON)
            .body(Map.of(
                "programacionDetalleId", detalleId,
                "semana", 1,
                "fecha", "2026-09-01",
                "papelReal", 2500,
                "sobreReal", 1800
            ))
            .when().put("/api/v1/programaciones/" + programacionId + "/cumplimiento")
            .then()
            .statusCode(200)
            .body("papelReal", is(2500))
            .body("sobreReal", is(1800))
            .body("totalReal", is(4300));
    }

    @Test
    public void testGuardarCumplimientoValidacionNegativo() {
        // Crear programación — mes 11 único en esta clase para evitar colisión.
        Integer programacionId = given()
            .auth().oauth2(TestSupport.seedToken())
            .contentType(ContentType.JSON)
            .body(Map.of(
                "anio", 2026,
                "mes", 11,
                "especieId", 1
            ))
            .when().post("/api/v1/programaciones")
            .then()
            .statusCode(201)
            .extract().path("id");

        Integer detalleId = given()
            .auth().oauth2(TestSupport.seedToken())
            .when().get("/api/v1/programaciones/" + programacionId)
            .then()
            .statusCode(200)
            .extract().jsonPath().getInt("detalles[0].id");

        // Intentar guardar con valores negativos
        given()
            .auth().oauth2(TestSupport.seedToken())
            .contentType(ContentType.JSON)
            .body(Map.of(
                "programacionDetalleId", detalleId,
                "semana", 1,
                "fecha", "2026-09-01",
                "papelReal", -100,
                "sobreReal", 500
            ))
            .when().put("/api/v1/programaciones/" + programacionId + "/cumplimiento")
            .then()
            .statusCode(400);
    }
}
