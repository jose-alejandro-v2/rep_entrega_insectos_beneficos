package pe.sistema.insectosbeneficos;

import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;

/**
 * Tests de los endpoints de catálogos del módulo de requerimientos (HITO-007):
 *   GET /api/v1/etapas-fenologicas -> EtapaFenologicaDto[]
 *   GET /api/v1/plagas             -> PlagaDto[]
 *   GET /api/v1/nematodos          -> NematodoDto[]
 *   GET /api/v1/patrones           -> PatronDto[]
 *
 * El seed (V9) inserta 7 etapas, 5 plagas, 5 nematodos y 5 patrones.
 * Testcontainers (PostgresTestResource) aplica las migraciones V1-V9 de forma
 * automática. Se verifican las correcciones del usuario: "FLORACIÓN Y CUAJA",
 * "CRECIMIENTO DE BAYAS" y "LEPIDÓPTEROS LARVA".
 */
@QuarkusTest
@QuarkusTestResource(PostgresTestResource.class)
public class CatalogoRequerimientoResourceTest {

    @Test
    public void testGetEtapasFenologicas() {
        given()
          .when().get("/api/v1/etapas-fenologicas")
          .then()
             .statusCode(200)
             .body("size()", is(7))
             .body("find { it.nombre == 'Floración y Cuaja' }", notNullValue())
             .body("find { it.nombre == 'Crecimiento de Bayas' }", notNullValue())
             .body("find { it.estado == 'ACTIVO' }", notNullValue());
    }

    @Test
    public void testGetPlagas() {
        given()
          .when().get("/api/v1/plagas")
          .then()
             .statusCode(200)
             .body("size()", is(5))
             .body("find { it.nombre == 'Lepidópteros Larva' }", notNullValue())
             .body("find { it.estado == 'ACTIVO' }", notNullValue());
    }

    @Test
    public void testGetNematodos() {
        given()
          .when().get("/api/v1/nematodos")
          .then()
             .statusCode(200)
             .body("size()", is(5))
             .body("find { it.estado == 'ACTIVO' }", notNullValue());
    }

    @Test
    public void testGetPatrones() {
        given()
          .when().get("/api/v1/patrones")
          .then()
             .statusCode(200)
             .body("size()", is(5))
             .body("find { it.estado == 'ACTIVO' }", notNullValue());
    }
}
