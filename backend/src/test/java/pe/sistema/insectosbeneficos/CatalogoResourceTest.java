package pe.sistema.insectosbeneficos;

import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.response.Response;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.is;

/**
 * Tests de los endpoints de catalogo agricola (HITO-006):
 *   GET /api/v1/fundos      -> FundoDto[]
 *   GET /api/v1/variedades  -> VariedadDto[]
 *   GET /api/v1/lotes       -> LoteDto[]
 *   GET /api/v1/lotes?fundoId=X -> LoteDto[] filtrado por fundo
 *
 * El seed (V7) inserta 6 fundos, 11 variedades (Adora = Roja, Sugra 60 = Verde)
 * y 157 lotes (Challapampa = 31). Testcontainers (PostgresTestResource) aplica
 * las migraciones V1-V7 de forma automatica.
 */
@QuarkusTest
@QuarkusTestResource(PostgresTestResource.class)
public class CatalogoResourceTest {

    @Test
    public void testGetFundos() {
        given()
          .when().get("/api/v1/fundos")
          .then()
             .statusCode(200)
             .body("size()", is(6));
    }

    @Test
    public void testGetVariedades() {
        given()
          .when().get("/api/v1/variedades")
          .then()
             .statusCode(200)
             .body("size()", is(11))
             .body("find { it.nombre == 'Adora' }.color", is("Roja"))
             .body("find { it.nombre == 'Sugra 60' }.color", is("Verde"));
    }

    @Test
    public void testGetLotes() {
        given()
          .when().get("/api/v1/lotes")
          .then()
             .statusCode(200)
             .body("size()", is(191));
    }

    @Test
    public void testGetLotesPorFundo() {
        // Resuelve el id de Challapampa dinamicamente desde GET /fundos.
        Response fundos = given().when().get("/api/v1/fundos");
        fundos.then().statusCode(200);
        int challapampaId = fundos.jsonPath().getInt("find { it.nombre == 'Challapampa' }.id");

        given()
          .when().get("/api/v1/lotes?fundoId=" + challapampaId)
          .then()
             .statusCode(200)
             .body("size()", is(31));
    }
}
