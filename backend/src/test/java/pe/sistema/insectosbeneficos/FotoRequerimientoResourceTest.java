package pe.sistema.insectosbeneficos;

import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.response.Response;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

/**
 * Tests de los endpoints del módulo de fotos de requerimientos (HITO-010):
 *   POST   /api/v1/requerimientos/{requerimientoId}/fotos  (multipart/form-data)
 *   GET    /api/v1/requerimientos/{requerimientoId}/fotos
 *   DELETE /api/v1/requerimientos/{requerimientoId}/fotos/{fotoId}
 *
 * El seed (TestSupport) autentica con el Super Admin id=1. Testcontainers aplica
 * V1..V11. Cada test es autosuficiente: crea su propio requerimiento con stock.
 */
@QuarkusTest
@QuarkusTestResource(PostgresTestResource.class)
public class FotoRequerimientoResourceTest {

    private static final long FUNDO_ID = 1L;
    private static final long LOTE_ID = 1L;
    private static final long ESPECIE_ID = 1L;
    private static final long ETAPA_ID = 1L;
    private static final long PLAGA_ID = 1L;
    private static final String FECHA = "2026-08-25";

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    /** Calcula fecha de corte (mismo algoritmo que el backend). */
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

    /**
     * Crea programación del mes actual + cumplimiento con totalReal=5000
     * en la fecha de corte (L o J) para que getStockDisponible retorne 5000.
     */
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

        @SuppressWarnings("unchecked")
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
        body.put("etapaFenologicaId", ETAPA_ID);
        body.put("cantidad", cantidad);
        body.put("plagaId", PLAGA_ID);
        body.put("observaciones", "Requerimiento de prueba para fotos");
        return body;
    }

    /** Crea un requerimiento y devuelve su id (asume 201). */
    private long crearRequerimientoId(BigDecimal cantidad) {
        return given()
          .auth().oauth2(TestSupport.seedToken())
          .contentType(ContentType.JSON)
          .body(crearBody(cantidad))
          .when().post("/api/v1/requerimientos")
          .then().statusCode(201)
          .extract().jsonPath().getLong("id");
    }

    /** Genera bytes simulando un archivo JPEG válido. */
    private byte[] generarFotoJpeg(int sizeBytes) {
        // JPEG magic bytes: 0xFF 0xD8 0xFF 0xE0 seguido de relleno
        byte[] data = new byte[sizeBytes];
        data[0] = (byte) 0xFF;
        data[1] = (byte) 0xD8;
        data[2] = (byte) 0xFF;
        data[3] = (byte) 0xE0;
        return data;
    }

    // ------------------------------------------------------------------
    // 1. Subir foto -> 201
    // ------------------------------------------------------------------

    @Test
    public void testSubirFoto() {
        asegurarStockEspecie();
        long reqId = crearRequerimientoId(new BigDecimal("10"));
        byte[] fotoBytes = generarFotoJpeg(1024);

        given()
          .auth().oauth2(TestSupport.seedToken())
          .multiPart("archivo", "foto1.jpg", fotoBytes, "image/jpeg")
          .formParam("metadatos", "Foto de campo - prueba")
          .when().post("/api/v1/requerimientos/" + reqId + "/fotos")
          .then()
             .statusCode(201)
             .body("id", notNullValue())
             .body("requerimientoId", is((int) reqId))
             .body("nombreArchivo", is("foto1.jpg"))
             .body("contentType", is("image/jpeg"))
             .body("tamanoBytes", is(1024))
             .body("metadatos", is("Foto de campo - prueba"))
             .body("creadoEn", notNullValue());
    }

    // ------------------------------------------------------------------
    // 2. Subir foto > 5MB -> 400
    // ------------------------------------------------------------------

    @Test
    public void testSubirFotoExcede5MB() {
        asegurarStockEspecie();
        long reqId = crearRequerimientoId(new BigDecimal("10"));
        byte[] fotoGrande = generarFotoJpeg(5 * 1024 * 1024 + 1); // 5 MB + 1 byte

        given()
          .auth().oauth2(TestSupport.seedToken())
          .multiPart("archivo", "foto-grande.jpg", fotoGrande, "image/jpeg")
          .formParam("metadatos", "Foto muy grande")
          .when().post("/api/v1/requerimientos/" + reqId + "/fotos")
          .then()
             .statusCode(400)
             .body("codigo", is("ARCHIVO_MUY_GRANDE"));
    }

    // ------------------------------------------------------------------
    // 3. Subir formato no válido -> 400
    // ------------------------------------------------------------------

    @Test
    public void testSubirFotoFormatoNoValido() {
        asegurarStockEspecie();
        long reqId = crearRequerimientoId(new BigDecimal("10"));
        byte[] videoBytes = "fake video content".getBytes(StandardCharsets.UTF_8);

        given()
          .auth().oauth2(TestSupport.seedToken())
          .multiPart("archivo", "video.mp4", videoBytes, "video/mp4")
          .formParam("metadatos", "Video no permitido")
          .when().post("/api/v1/requerimientos/" + reqId + "/fotos")
          .then()
             .statusCode(400)
             .body("codigo", is("FORMATO_NO_VALIDO"));
    }

    // ------------------------------------------------------------------
    // 4. Exceder máximo de fotos (3ra) -> 400
    // ------------------------------------------------------------------

    @Test
    public void testExcederMaxFotos() {
        asegurarStockEspecie();
        long reqId = crearRequerimientoId(new BigDecimal("10"));
        byte[] foto1 = generarFotoJpeg(100);
        byte[] foto2 = generarFotoJpeg(200);
        byte[] foto3 = generarFotoJpeg(300);

        // Subir primera foto -> 201
        given()
          .auth().oauth2(TestSupport.seedToken())
          .multiPart("archivo", "foto1.jpg", foto1, "image/jpeg")
          .formParam("metadatos", "Foto 1")
          .when().post("/api/v1/requerimientos/" + reqId + "/fotos")
          .then().statusCode(201);

        // Subir segunda foto -> 201
        given()
          .auth().oauth2(TestSupport.seedToken())
          .multiPart("archivo", "foto2.jpg", foto2, "image/jpeg")
          .formParam("metadatos", "Foto 2")
          .when().post("/api/v1/requerimientos/" + reqId + "/fotos")
          .then().statusCode(201);

        // Subir tercera foto -> 400
        given()
          .auth().oauth2(TestSupport.seedToken())
          .multiPart("archivo", "foto3.jpg", foto3, "image/jpeg")
          .formParam("metadatos", "Foto 3")
          .when().post("/api/v1/requerimientos/" + reqId + "/fotos")
          .then()
             .statusCode(400)
             .body("codigo", is("MAX_FOTOS_ALCANZADO"));
    }

    // ------------------------------------------------------------------
    // 5. Listar fotos -> 200
    // ------------------------------------------------------------------

    @Test
    public void testListarFotos() {
        asegurarStockEspecie();
        long reqId = crearRequerimientoId(new BigDecimal("10"));
        byte[] fotoBytes = generarFotoJpeg(512);

        // Subir una foto primero
        given()
          .auth().oauth2(TestSupport.seedToken())
          .multiPart("archivo", "foto-listar.jpg", fotoBytes, "image/jpeg")
          .formParam("metadatos", "Para listar")
          .when().post("/api/v1/requerimientos/" + reqId + "/fotos")
          .then().statusCode(201);

        // Listar fotos
        given()
          .auth().oauth2(TestSupport.seedToken())
          .when().get("/api/v1/requerimientos/" + reqId + "/fotos")
          .then()
             .statusCode(200)
             .body("size()", is(1))
             .body("[0].nombreArchivo", is("foto-listar.jpg"));
    }

    // ------------------------------------------------------------------
    // 6. Eliminar foto -> 204
    // ------------------------------------------------------------------

    @Test
    public void testEliminarFoto() {
        asegurarStockEspecie();
        long reqId = crearRequerimientoId(new BigDecimal("10"));
        byte[] fotoBytes = generarFotoJpeg(512);

        // Subir foto
        long fotoId = given()
          .auth().oauth2(TestSupport.seedToken())
          .multiPart("archivo", "foto-eliminar.jpg", fotoBytes, "image/jpeg")
          .formParam("metadatos", "Para eliminar")
          .when().post("/api/v1/requerimientos/" + reqId + "/fotos")
          .then().statusCode(201)
          .extract().jsonPath().getLong("id");

        // Eliminar foto
        given()
          .auth().oauth2(TestSupport.seedToken())
          .when().delete("/api/v1/requerimientos/" + reqId + "/fotos/" + fotoId)
          .then()
             .statusCode(204);

        // Verificar que ya no existe
        given()
          .auth().oauth2(TestSupport.seedToken())
          .when().get("/api/v1/requerimientos/" + reqId + "/fotos")
          .then()
             .statusCode(200)
             .body("size()", is(0));
    }

    // ------------------------------------------------------------------
    // 7. Listar fotos de requerimiento inexistente -> 404
    // ------------------------------------------------------------------

    @Test
    public void testListarFotosRequerimientoInexistente() {
        given()
          .auth().oauth2(TestSupport.seedToken())
          .when().get("/api/v1/requerimientos/999999/fotos")
          .then()
             .statusCode(404)
             .body("codigo", is("REQUERIMIENTO_NO_ENCONTRADO"));
    }

    // ------------------------------------------------------------------
    // 8. Eliminar foto inexistente -> 404
    // ------------------------------------------------------------------

    @Test
    public void testEliminarFotoInexistente() {
        asegurarStockEspecie();
        long reqId = crearRequerimientoId(new BigDecimal("10"));

        given()
          .auth().oauth2(TestSupport.seedToken())
          .when().delete("/api/v1/requerimientos/" + reqId + "/fotos/999999")
          .then()
             .statusCode(404)
             .body("codigo", is("FOTO_NO_ENCONTRADA"));
    }

    // ------------------------------------------------------------------
    // 9. Subir foto PNG -> 201
    // ------------------------------------------------------------------

    @Test
    public void testSubirFotoPng() {
        asegurarStockEspecie();
        long reqId = crearRequerimientoId(new BigDecimal("10"));
        // PNG magic bytes
        byte[] pngBytes = new byte[1024];
        pngBytes[0] = (byte) 0x89;
        pngBytes[1] = (byte) 0x50; // P
        pngBytes[2] = (byte) 0x4E; // N
        pngBytes[3] = (byte) 0x47; // G

        given()
          .auth().oauth2(TestSupport.seedToken())
          .multiPart("archivo", "foto.png", pngBytes, "image/png")
          .formParam("metadatos", "Foto PNG")
          .when().post("/api/v1/requerimientos/" + reqId + "/fotos")
          .then()
             .statusCode(201)
             .body("contentType", is("image/png"))
             .body("nombreArchivo", is("foto.png"));
    }

    // ------------------------------------------------------------------
    // 10. Eliminar foto de OTRO requerimiento (IDOR) -> 400
    // ------------------------------------------------------------------

    @Test
    public void testEliminarFotoDeOtroRequerimientoRetorna400() {
        asegurarStockEspecie();
        long reqId1 = crearRequerimientoId(new BigDecimal("10"));
        long reqId2 = crearRequerimientoId(new BigDecimal("20"));
        byte[] fotoBytes = generarFotoJpeg(512);

        // Subir foto al requerimiento 1
        long fotoId = given()
          .auth().oauth2(TestSupport.seedToken())
          .multiPart("archivo", "foto-idor.jpg", fotoBytes, "image/jpeg")
          .formParam("metadatos", "Foto para prueba IDOR")
          .when().post("/api/v1/requerimientos/" + reqId1 + "/fotos")
          .then().statusCode(201)
          .extract().jsonPath().getLong("id");

        // Intentar eliminar la foto usando el requerimiento 2 (IDOR) -> 400
        given()
          .auth().oauth2(TestSupport.seedToken())
          .when().delete("/api/v1/requerimientos/" + reqId2 + "/fotos/" + fotoId)
          .then()
             .statusCode(400)
             .body("codigo", is("FOTO_NO_PERTENECE"));
    }

    // ------------------------------------------------------------------
    // 11. Subir foto a requerimiento inexistente -> 404
    // ------------------------------------------------------------------

    @Test
    public void testSubirFotoARequerimientoInexistenteRetorna404() {
        byte[] fotoBytes = generarFotoJpeg(512);

        given()
          .auth().oauth2(TestSupport.seedToken())
          .multiPart("archivo", "foto-404.jpg", fotoBytes, "image/jpeg")
          .formParam("metadatos", "Foto a requerimiento inexistente")
          .when().post("/api/v1/requerimientos/999999/fotos")
          .then()
             .statusCode(404)
             .body("codigo", is("REQUERIMIENTO_NO_ENCONTRADO"));
    }

    // ------------------------------------------------------------------
    // 12. Descargar imagen -> 200 con image/jpeg
    // ------------------------------------------------------------------

    @Test
    public void testDescargarImagen() {
        asegurarStockEspecie();
        long reqId = crearRequerimientoId(new BigDecimal("10"));
        byte[] fotoBytes = generarFotoJpeg(512);

        // Subir foto primero
        long fotoId = given()
          .auth().oauth2(TestSupport.seedToken())
          .multiPart("archivo", "foto-descargar.jpg", fotoBytes, "image/jpeg")
          .formParam("metadatos", "Para descargar")
          .when().post("/api/v1/requerimientos/" + reqId + "/fotos")
          .then().statusCode(201)
          .extract().jsonPath().getLong("id");

        // Descargar imagen
        given()
          .auth().oauth2(TestSupport.seedToken())
          .when().get("/api/v1/requerimientos/" + reqId + "/fotos/" + fotoId + "/imagen")
          .then()
             .statusCode(200)
             .contentType("image/jpeg");
    }

    // ------------------------------------------------------------------
    // 13. Descargar imagen de foto inexistente -> 404
    // ------------------------------------------------------------------

    @Test
    public void testDescargarImagenInexistente() {
        asegurarStockEspecie();
        long reqId = crearRequerimientoId(new BigDecimal("10"));

        given()
          .auth().oauth2(TestSupport.seedToken())
          .when().get("/api/v1/requerimientos/" + reqId + "/fotos/999999/imagen")
          .then()
             .statusCode(404);
    }
}
