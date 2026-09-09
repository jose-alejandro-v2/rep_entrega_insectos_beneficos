package pe.sistema.insectosbeneficos;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;
import pe.sistema.insectosbeneficos.programacion.dto.UpdateProgramacionRequest;
import java.util.Collections;
import java.util.Map;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;
import pe.sistema.insectosbeneficos.programacion.ProgramacionService;
import pe.sistema.insectosbeneficos.programacion.dto.ProgramacionDto;
import java.util.List;
import java.util.ArrayList;
import java.time.ZonedDateTime;
import io.quarkus.test.common.QuarkusTestResource;

@QuarkusTest
@QuarkusTestResource(PostgresTestResource.class)
public class ProgramacionResourceTest {

    @Test
    public void testGetEspecies() {
        given()
          .when().get("/api/v1/especies")
          .then()
             .statusCode(200)
             .body("size()", greaterThanOrEqualTo(2));
    }

    @Test
    public void testListProgramacionesReturnsMobileContractFields() {
        // anio/mes UNICOS (2095/2): evita colision con
        // testCrearProgramacion_duplicadoMesAnioEspecie (2098/5) al compartir la
        // misma BD Testcontainers dentro de la clase (independiente del orden).
        final Integer anio = 2095;
        final Integer mes = 2;
        // Crear una programacion primero (POST ya no autogenera en el GET).
        given()
          .auth().oauth2(TestSupport.seedToken())
          .contentType(ContentType.JSON)
          .body(Map.of("anio", anio, "mes", mes, "especieId", 1))
          .when().post("/api/v1/programaciones")
          .then()
             .statusCode(201);
        given()
          .when().get("/api/v1/programaciones?anio=" + anio + "&mes=" + mes)
          .then()
             .statusCode(200)
             .body("size()", greaterThanOrEqualTo(1))
             .body("[0].especie", notNullValue())
             .body("[0].totalMes", greaterThanOrEqualTo(0));
    }

    // ------------------------------------------------------------------
    // POST /api/v1/programaciones — crear programacion (H3 G-TEST-BE)
    // ------------------------------------------------------------------

    @Test
    public void testCrearProgramacion_conTokenSuperAdmin_devuelve201() {
        given()
          .auth().oauth2(TestSupport.seedToken())
          .contentType(ContentType.JSON)
          .body(Map.of("anio", 2099, "mes", 6, "especieId", 1))
          .when().post("/api/v1/programaciones")
          .then()
             .statusCode(201)
             .body("id", notNullValue())
             .body("anio", is(2099))
             .body("mes", is(6))
             .body("especieId", is(1))
             .body("estado", is("EN_PROCESO"))
             .body("stockInicialBase", is(5000));
    }

    @Test
    public void testCrearProgramacion_duplicadoMesAnioEspecie_devuelve409() {
        Map<String, Object> body = Map.of("anio", 2098, "mes", 5, "especieId", 1);

        // Primera creacion -> 201
        given().auth().oauth2(TestSupport.seedToken())
          .contentType(ContentType.JSON).body(body)
          .when().post("/api/v1/programaciones")
          .then().statusCode(201);

        // Segunda con el mismo mes+año+especie -> 409 PROGRAMACION_YA_EXISTE
        given().auth().oauth2(TestSupport.seedToken())
          .contentType(ContentType.JSON).body(body)
          .when().post("/api/v1/programaciones")
          .then().statusCode(409).body("codigo", is("PROGRAMACION_YA_EXISTE"));
    }

    @Test
    public void testCrearProgramacion_especieInexistente_devuelve404() {
        given()
          .auth().oauth2(TestSupport.seedToken())
          .contentType(ContentType.JSON)
          .body(Map.of("anio", 2097, "mes", 4, "especieId", 999999))
          .when().post("/api/v1/programaciones")
          .then().statusCode(404).body("codigo", is("ESPECIE_NO_ENCONTRADA"));
    }

    @Test
    public void testCrearProgramacion_sinToken_devuelve401() {
        given()
          .contentType(ContentType.JSON)
          .body(Map.of("anio", 2097, "mes", 4, "especieId", 1))
          .when().post("/api/v1/programaciones")
          .then().statusCode(401);
    }

    @Test
    public void testCrearProgramacion_bodyVacio_devuelve400() {
        // H1: input invalido ya NO da 500. El 400 lo emite la validacion de
        // hibernate-validator (via RESTEasy Reactive), cuyo body es el JSON de
        // violacion estandar, no el {codigo,mensaje} del ManejadorErrores.
        given()
          .auth().oauth2(TestSupport.seedToken())
          .contentType(ContentType.JSON)
          .body(Map.of())
          .when().post("/api/v1/programaciones")
          .then().statusCode(400);
    }

    @Test
    public void testPutConEsCreacionInicial_permiteVolcadoInicialCualquierDia() {
        // HITO-016: el flujo crear del mobile hace POST → PUT (volcado inicial).
        // Ese PUT NO debe caer en la restriccion L/J (solo aplica a la edicion).
        // Deterministico: independiente del dia en que corra el test.
        final Integer anio = 2096;
        final Integer mes = 3;
        Integer id = given()
          .auth().oauth2(TestSupport.seedToken())
          .contentType(ContentType.JSON)
          .body(Map.of("anio", anio, "mes", mes, "especieId", 1))
          .when().post("/api/v1/programaciones")
          .then().statusCode(201)
          .extract().path("id");

        given()
          .auth().oauth2(TestSupport.seedToken())
          .contentType(ContentType.JSON)
          .body(Map.of(
              "stockInicialBase", 5000,
              "esCreacionInicial", true,
              "detalles", List.of()))
          .when().put("/api/v1/programaciones/" + id)
          .then().statusCode(200);
    }
}
