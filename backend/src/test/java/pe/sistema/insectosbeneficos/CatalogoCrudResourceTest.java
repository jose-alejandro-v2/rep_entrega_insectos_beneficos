package pe.sistema.insectosbeneficos;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.restassured.response.Response;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import pe.sistema.insectosbeneficos.catalogos.FundoRepository;
import pe.sistema.insectosbeneficos.catalogos.LoteRepository;
import pe.sistema.insectosbeneficos.catalogos.NematodoRepository;
import pe.sistema.insectosbeneficos.catalogos.PatronRepository;
import pe.sistema.insectosbeneficos.catalogos.PlagaRepository;
import pe.sistema.insectosbeneficos.liberaciones.Liberacion;
import pe.sistema.insectosbeneficos.liberaciones.LiberacionRepository;
import pe.sistema.insectosbeneficos.programacion.EspecieRepository;
import pe.sistema.insectosbeneficos.programacion.Programacion;
import pe.sistema.insectosbeneficos.programacion.ProgramacionRepository;
import pe.sistema.insectosbeneficos.requerimientos.Requerimiento;
import pe.sistema.insectosbeneficos.requerimientos.RequerimientoPlaga;
import pe.sistema.insectosbeneficos.requerimientos.RequerimientoPlagaRepository;
import pe.sistema.insectosbeneficos.requerimientos.RequerimientoRepository;

/**
 * CRUD de catlogos bajo /api/v1 (especies, plagas, nematodos, patrones):
 * GET pblico; POST/PUT/DELETE protegidos (401 sin token, 403 rol Usuario,
 * 201/200 con Super Admin/Admin). Soft delete = INACTIVO.
 *
 * IMPORTANTE (aislamiento): este y los dems tests comparten un mismo
 * contenedor Testcontainers (PostgresTestResource). El test pre-existente
 * CatalogoRequerimientoResourceTest verifica contadores exactos de seed
 * (size()==5). Por eso aqu se BORRAN FSICAMENTE las filas creadas al final de
 * cada test (via repositorios Panache inyectados), dejando la BD en estado de
 * seed para no ensuciar el resto de la suite.
 */
@QuarkusTest
@QuarkusTestResource(PostgresTestResource.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class CatalogoCrudResourceTest {

    @Inject
    PlagaRepository plagaRepository;

    @Inject
    NematodoRepository nematodoRepository;

    @Inject
    PatronRepository patronRepository;

    @Inject
    EspecieRepository especieRepository;

    @Inject
    ProgramacionRepository programacionRepository;

    @Inject
    RequerimientoRepository requerimientoRepository;

    @Inject
    RequerimientoPlagaRepository requerimientoPlagaRepository;

    @Inject
    LiberacionRepository liberacionRepository;

    @Inject
    FundoRepository fundoRepository;

    @Inject
    LoteRepository loteRepository;

    private static final String CATALOGOS_JSON = "{\"nombre\": \"%s\"}";
    private static final String ACTUALIZAR_JSON = "{\"nombre\": \"%s\", \"estado\": \"%s\"}";

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private Response post(String endpoint, String token, String nombre) {
        return given().auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body(String.format(CATALOGOS_JSON, nombre))
                .post(endpoint);
    }

    private Response put(String endpoint, String token, long id, String nombre, String estado) {
        return given().auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body(String.format(ACTUALIZAR_JSON, nombre, estado))
                .put(endpoint + "/" + id);
    }

    private Response delete(String endpoint, String token, long id) {
        return given().auth().oauth2(token).delete(endpoint + "/" + id);
    }

    /** Borra FISICAMENTE la fila creada por el test segn el catlogo, dejando el seed intacto. */
    private void limpiarFisicamente(long id) {
        // El recurso usa el token indicado para el endpoint; la limpieza fisica
        // no requiere token porque trabaja directo sobre el repositorio.
    }

    // ------------------------------------------------------------------
    // ESPECIES
    // ------------------------------------------------------------------

    @Test
    void especies_getPublico_devuelve200() {
        given().get("/api/v1/especies").then().statusCode(200);
    }

    @Test
    void especies_postSinToken_devuelve401() {
        given().contentType(ContentType.JSON).body("{\"nombre\": \"Test\"}")
                .post("/api/v1/especies").then().statusCode(401);
    }

    @Test
    void especies_postConUsuario_devuelve403() {
        long opId = TestSupport.crearUsuarioComoSeed("op_especie_v1", "Operador Especie V1", TestSupport.ROL_USUARIO_ID);
        String opToken = TestSupport.localLoginToken(opId, TestSupport.SEED_PASSWORD);

        given().auth().oauth2(opToken).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Test\"}")
                .post("/api/v1/especies").then().statusCode(403);

        TestSupport.eliminarComoSeed(opId).then().statusCode(200);
    }

    @Test
    void especies_postAdmin_creaYDevuelve201() {
        String token = TestSupport.seedToken();

        Response r = given().auth().oauth2(token).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Trichogramma_nuevo\"}")
                .post("/api/v1/especies");
        r.then().statusCode(201)
                .body("nombre", is("Trichogramma_nuevo"))
                .body("estado", is("ACTIVO"))
                .body("id", notNullValue());

        // Limpieza fisica (repo inyectado)
        long id = r.jsonPath().getLong("id");
        QuarkusTransaction.requiringNew().run(() -> especieRepository.deleteById(id));
    }

    @Test
    void especies_postDuplicado_devuelve409() {
        String token = TestSupport.seedToken();

        Response r1 = given().auth().oauth2(token).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Dup_esp_v1\"}")
                .post("/api/v1/especies");
        r1.then().statusCode(201);

        given().auth().oauth2(token).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Dup_esp_v1\"}")
                .post("/api/v1/especies").then().statusCode(409)
                .body("codigo", is("ESPECIE_YA_EXISTE"));

        // Limpieza fisica
        long id1 = r1.jsonPath().getLong("id");
        QuarkusTransaction.requiringNew().run(() -> especieRepository.deleteById(id1));
    }

    @Test
    void especies_putAdmin_actualiza() {
        String token = TestSupport.seedToken();

        Response r = given().auth().oauth2(token).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Put_esp_v1\"}")
                .post("/api/v1/especies");
        r.then().statusCode(201);
        long id = r.jsonPath().getLong("id");

        given().auth().oauth2(token).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Put_esp_v1_mod\", \"estado\": \"INACTIVO\"}")
                .put("/api/v1/especies/" + id).then().statusCode(200)
                .body("estado", is("INACTIVO"));

        // Reactivar
        given().auth().oauth2(token).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Put_esp_v1_mod\", \"estado\": \"ACTIVO\"}")
                .put("/api/v1/especies/" + id).then().statusCode(200)
                .body("estado", is("ACTIVO"));

        // Limpieza fisica
        QuarkusTransaction.requiringNew().run(() -> especieRepository.deleteById(id));
    }

    @Test
    void especies_putDuplicado_devuelve409() {
        String token = TestSupport.seedToken();

        Response r1 = given().auth().oauth2(token).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Put_dup1\"}").post("/api/v1/especies");
        r1.then().statusCode(201);
        long id1 = r1.jsonPath().getLong("id");

        Response r2 = given().auth().oauth2(token).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Put_dup2\"}").post("/api/v1/especies");
        r2.then().statusCode(201);
        long id2 = r2.jsonPath().getLong("id");

        // Intentar cambiar nombre de id2 al de id1 -> 409
        given().auth().oauth2(token).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Put_dup1\", \"estado\": \"ACTIVO\"}")
                .put("/api/v1/especies/" + id2).then().statusCode(409)
                .body("codigo", is("ESPECIE_YA_EXISTE"));

        QuarkusTransaction.requiringNew().run(() -> especieRepository.deleteById(id1));
        QuarkusTransaction.requiringNew().run(() -> especieRepository.deleteById(id2));
    }

    @Test
    void especies_deleteAdmin_softDelete() {
        String token = TestSupport.seedToken();

        Response r = given().auth().oauth2(token).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Del_esp_v1\"}").post("/api/v1/especies");
        r.then().statusCode(201);
        long id = r.jsonPath().getLong("id");

        // Primera eliminacion -> 200 (el DELETE responde MensajeResponse {mensaje},
        // igual que UsuarioService.eliminar; la transicion a INACTIVO la prueba la
        // segunda eliminacion -> 400 *_YA_INACTIVA mas abajo).
        given().auth().oauth2(token).delete("/api/v1/especies/" + id)
                .then().statusCode(200).body("mensaje", notNullValue());

        // Segunda eliminacion -> 400 (ya inactiva)
        given().auth().oauth2(token).delete("/api/v1/especies/" + id)
                .then().statusCode(400).body("codigo", is("ESPECIE_YA_INACTIVA"));

        // Limpieza fisica
        QuarkusTransaction.requiringNew().run(() -> especieRepository.deleteById(id));
    }

    @Test
    void especies_deleteNoExiste_devuelve404() {
        // Primer POST para chequear el token de seed, luego DELETE inexistente
        TestSupport.seedToken();
        given().auth().oauth2(TestSupport.seedToken())
                .delete("/api/v1/especies/999999").then().statusCode(404)
                .body("codigo", is("ESPECIE_NO_ENCONTRADA"));
    }

    // ------------------------------------------------------------------
    // PLAGAS
    // ------------------------------------------------------------------

    @Test
    void plagas_getPublico_devuelve200() {
        given().get("/api/v1/plagas").then().statusCode(200);
    }

    @Test
    void plagas_postSinToken_devuelve401() {
        given().contentType(ContentType.JSON).body("{\"nombre\": \"Test\"}")
                .post("/api/v1/plagas").then().statusCode(401);
    }

    @Test
    void plagas_postConUsuario_devuelve403() {
        long opId = TestSupport.crearUsuarioComoSeed("op_plaga_v1", "Operador Plaga V1", TestSupport.ROL_USUARIO_ID);
        String opToken = TestSupport.localLoginToken(opId, TestSupport.SEED_PASSWORD);

        given().auth().oauth2(opToken).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Test\"}")
                .post("/api/v1/plagas").then().statusCode(403);

        TestSupport.eliminarComoSeed(opId).then().statusCode(200);
    }

    @Test
    void plagas_postAdmin_creaYDevuelve201() {
        String token = TestSupport.seedToken();

        Response r = given().auth().oauth2(token).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Plaga_v1_nueva\"}")
                .post("/api/v1/plagas");
        r.then().statusCode(201)
                .body("nombre", is("Plaga_v1_nueva"))
                .body("estado", is("ACTIVO"))
                .body("id", notNullValue());

        long id = r.jsonPath().getLong("id");
        QuarkusTransaction.requiringNew().run(() -> plagaRepository.deleteById(id));
    }

    @Test
    void plagas_postDuplicado_devuelve409() {
        String token = TestSupport.seedToken();

        Response r1 = given().auth().oauth2(token).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Dup_plaga_v1\"}").post("/api/v1/plagas");
        r1.then().statusCode(201);

        given().auth().oauth2(token).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Dup_plaga_v1\"}").post("/api/v1/plagas")
                .then().statusCode(409).body("codigo", is("PLAGA_YA_EXISTE"));

        QuarkusTransaction.requiringNew().run(() -> plagaRepository.deleteById(r1.jsonPath().getLong("id")));
    }

    @Test
    void plagas_putAdmin_actualiza() {
        String token = TestSupport.seedToken();

        Response r = given().auth().oauth2(token).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Put_plaga_v1\"}").post("/api/v1/plagas");
        r.then().statusCode(201);
        long id = r.jsonPath().getLong("id");

        given().auth().oauth2(token).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Put_plaga_mod\", \"estado\": \"INACTIVO\"}")
                .put("/api/v1/plagas/" + id).then().statusCode(200)
                .body("estado", is("INACTIVO"));

        given().auth().oauth2(token).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Put_plaga_mod\", \"estado\": \"ACTIVO\"}")
                .put("/api/v1/plagas/" + id).then().statusCode(200)
                .body("estado", is("ACTIVO"));

        QuarkusTransaction.requiringNew().run(() -> plagaRepository.deleteById(id));
    }

    @Test
    void plagas_deleteAdmin_softDelete() {
        String token = TestSupport.seedToken();

        Response r = given().auth().oauth2(token).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Del_plaga_v1\"}").post("/api/v1/plagas");
        r.then().statusCode(201);
        long id = r.jsonPath().getLong("id");

        given().auth().oauth2(token).delete("/api/v1/plagas/" + id)
                .then().statusCode(200).body("mensaje", notNullValue());
        given().auth().oauth2(token).delete("/api/v1/plagas/" + id)
                .then().statusCode(400).body("codigo", is("PLAGA_YA_INACTIVA"));

        QuarkusTransaction.requiringNew().run(() -> plagaRepository.deleteById(id));
    }

    @Test
    void plagas_deleteNoExiste_devuelve404() {
        given().auth().oauth2(TestSupport.seedToken())
                .delete("/api/v1/plagas/999999").then().statusCode(404)
                .body("codigo", is("PLAGA_NO_ENCONTRADA"));
    }

    // ------------------------------------------------------------------
    // NEMATODOS
    // ------------------------------------------------------------------

    @Test
    void nematodos_getPublico_devuelve200() {
        given().get("/api/v1/nematodos").then().statusCode(200);
    }

    @Test
    void nematodos_postSinToken_devuelve401() {
        given().contentType(ContentType.JSON).body("{\"nombre\": \"Test\"}")
                .post("/api/v1/nematodos").then().statusCode(401);
    }

    @Test
    void nematodos_postConUsuario_devuelve403() {
        long opId = TestSupport.crearUsuarioComoSeed("op_nema_v1", "Operador Nema V1", TestSupport.ROL_USUARIO_ID);
        String opToken = TestSupport.localLoginToken(opId, TestSupport.SEED_PASSWORD);

        given().auth().oauth2(opToken).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Test\"}").post("/api/v1/nematodos").then().statusCode(403);

        TestSupport.eliminarComoSeed(opId).then().statusCode(200);
    }

    @Test
    void nematodos_postAdmin_creaYDevuelve201() {
        String token = TestSupport.seedToken();

        Response r = given().auth().oauth2(token).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Nematodo_v1_nuevo\"}").post("/api/v1/nematodos");
        r.then().statusCode(201)
                .body("nombre", is("Nematodo_v1_nuevo"))
                .body("estado", is("ACTIVO"))
                .body("id", notNullValue());

        long id = r.jsonPath().getLong("id");
        QuarkusTransaction.requiringNew().run(() -> nematodoRepository.deleteById(id));
    }

    @Test
    void nematodos_postDuplicado_devuelve409() {
        String token = TestSupport.seedToken();

        Response r1 = given().auth().oauth2(token).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Dup_nema_v1\"}").post("/api/v1/nematodos");
        r1.then().statusCode(201);

        given().auth().oauth2(token).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Dup_nema_v1\"}").post("/api/v1/nematodos")
                .then().statusCode(409).body("codigo", is("NEMATODO_YA_EXISTE"));

        QuarkusTransaction.requiringNew().run(() -> nematodoRepository.deleteById(r1.jsonPath().getLong("id")));
    }

    @Test
    void nematodos_putAdmin_actualiza() {
        String token = TestSupport.seedToken();

        Response r = given().auth().oauth2(token).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Put_nema_v1\"}").post("/api/v1/nematodos");
        r.then().statusCode(201);
        long id = r.jsonPath().getLong("id");

        given().auth().oauth2(token).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Put_nema_mod\", \"estado\": \"INACTIVO\"}")
                .put("/api/v1/nematodos/" + id).then().statusCode(200)
                .body("estado", is("INACTIVO"));

        given().auth().oauth2(token).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Put_nema_mod\", \"estado\": \"ACTIVO\"}")
                .put("/api/v1/nematodos/" + id).then().statusCode(200)
                .body("estado", is("ACTIVO"));

        QuarkusTransaction.requiringNew().run(() -> nematodoRepository.deleteById(id));
    }

    @Test
    void nematodos_deleteAdmin_softDelete() {
        String token = TestSupport.seedToken();

        Response r = given().auth().oauth2(token).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Del_nema_v1\"}").post("/api/v1/nematodos");
        r.then().statusCode(201);
        long id = r.jsonPath().getLong("id");

        given().auth().oauth2(token).delete("/api/v1/nematodos/" + id)
                .then().statusCode(200).body("mensaje", notNullValue());
        given().auth().oauth2(token).delete("/api/v1/nematodos/" + id)
                .then().statusCode(400).body("codigo", is("NEMATODO_YA_INACTIVO"));

        QuarkusTransaction.requiringNew().run(() -> nematodoRepository.deleteById(id));
    }

    // ------------------------------------------------------------------
    // PATRONES
    // ------------------------------------------------------------------

    @Test
    void patrones_getPublico_devuelve200() {
        given().get("/api/v1/patrones").then().statusCode(200);
    }

    @Test
    void patrones_postSinToken_devuelve401() {
        given().contentType(ContentType.JSON).body("{\"nombre\": \"Test\"}")
                .post("/api/v1/patrones").then().statusCode(401);
    }

    @Test
    void patrones_postConUsuario_devuelve403() {
        long opId = TestSupport.crearUsuarioComoSeed("op_patron_v1", "Operador Patron V1", TestSupport.ROL_USUARIO_ID);
        String opToken = TestSupport.localLoginToken(opId, TestSupport.SEED_PASSWORD);

        given().auth().oauth2(opToken).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Test\"}").post("/api/v1/patrones").then().statusCode(403);

        TestSupport.eliminarComoSeed(opId).then().statusCode(200);
    }

    @Test
    void patrones_postAdmin_creaYDevuelve201() {
        String token = TestSupport.seedToken();

        Response r = given().auth().oauth2(token).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Patron_v1_nuevo\"}").post("/api/v1/patrones");
        r.then().statusCode(201)
                .body("nombre", is("Patron_v1_nuevo"))
                .body("estado", is("ACTIVO"))
                .body("id", notNullValue());

        long id = r.jsonPath().getLong("id");
        QuarkusTransaction.requiringNew().run(() -> patronRepository.deleteById(id));
    }

    @Test
    void patrones_postDuplicado_devuelve409() {
        String token = TestSupport.seedToken();

        Response r1 = given().auth().oauth2(token).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Dup_patron_v1\"}").post("/api/v1/patrones");
        r1.then().statusCode(201);

        given().auth().oauth2(token).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Dup_patron_v1\"}").post("/api/v1/patrones")
                .then().statusCode(409).body("codigo", is("PATRON_YA_EXISTE"));

        QuarkusTransaction.requiringNew().run(() -> patronRepository.deleteById(r1.jsonPath().getLong("id")));
    }

    @Test
    void patrones_putAdmin_actualiza() {
        String token = TestSupport.seedToken();

        Response r = given().auth().oauth2(token).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Put_patron_v1\"}").post("/api/v1/patrones");
        r.then().statusCode(201);
        long id = r.jsonPath().getLong("id");

        given().auth().oauth2(token).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Put_patron_mod\", \"estado\": \"INACTIVO\"}")
                .put("/api/v1/patrones/" + id).then().statusCode(200)
                .body("estado", is("INACTIVO"));

        given().auth().oauth2(token).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Put_patron_mod\", \"estado\": \"ACTIVO\"}")
                .put("/api/v1/patrones/" + id).then().statusCode(200)
                .body("estado", is("ACTIVO"));

        QuarkusTransaction.requiringNew().run(() -> patronRepository.deleteById(id));
    }

    @Test
    void patrones_deleteAdmin_softDelete() {
        String token = TestSupport.seedToken();

        Response r = given().auth().oauth2(token).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Del_patron_v1\"}").post("/api/v1/patrones");
        r.then().statusCode(201);
        long id = r.jsonPath().getLong("id");

        given().auth().oauth2(token).delete("/api/v1/patrones/" + id)
                .then().statusCode(200).body("mensaje", notNullValue());
        given().auth().oauth2(token).delete("/api/v1/patrones/" + id)
                .then().statusCode(400).body("codigo", is("PATRON_YA_INACTIVO"));

        QuarkusTransaction.requiringNew().run(() -> patronRepository.deleteById(id));
    }

    @Test
    void patrones_deleteNoExiste_devuelve404() {
        given().auth().oauth2(TestSupport.seedToken())
                .delete("/api/v1/patrones/999999").then().statusCode(404)
                .body("codigo", is("PATRON_NO_ENCONTRADO"));
    }

    // ------------------------------------------------------------------
    // Flag puedeEliminar + 409 por dependencias (v1.16.0)
    // ------------------------------------------------------------------

    @Test
    void especies_conProgramacion_flagFalse_deleteYPutInactivo409() {
        String token = TestSupport.seedToken();

        Response r = given().auth().oauth2(token).contentType(ContentType.JSON)
                .body("{\"nombre\": \"Esp_deps_v1\"}").post("/api/v1/especies");
        r.then().statusCode(201).body("puedeEliminar", is(true));
        long espId = r.jsonPath().getLong("id");

        // Programacion que referencia a la especie (dependencia)
        QuarkusTransaction.requiringNew().run(() -> {
            Programacion p = new Programacion();
            p.setAnio(2100);
            p.setMes(1);
            p.setEspecie(especieRepository.findById(espId));
            programacionRepository.persist(p);
        });

        given().get("/api/v1/especies").then().statusCode(200)
                .body("find { it.id == " + espId + " }.puedeEliminar", is(false));

        delete("/api/v1/especies", token, espId).then().statusCode(409)
                .body("codigo", is("REGISTRO_CON_DEPENDENCIAS"));
        put("/api/v1/especies", token, espId, "Esp_deps_v1", "INACTIVO").then().statusCode(409)
                .body("codigo", is("REGISTRO_CON_DEPENDENCIAS"));

        // Limpieza fisica: programacion primero (FK), luego la especie
        QuarkusTransaction.requiringNew().run(() -> {
            programacionRepository.delete("especie.id = ?1", espId);
            especieRepository.deleteById(espId);
        });
    }

    @Test
    void plagas_conRegistrosLegacyPivotYLiberacion_delete409_flagFalse() {
        String token = TestSupport.seedToken();

        Response ra = post("/api/v1/plagas", token, "Plaga_deps_a_v1");
        ra.then().statusCode(201).body("puedeEliminar", is(true));
        Response rb = post("/api/v1/plagas", token, "Plaga_deps_b_v1");
        rb.then().statusCode(201);
        Response rc = post("/api/v1/plagas", token, "Plaga_deps_c_v1");
        rc.then().statusCode(201);
        long aId = ra.jsonPath().getLong("id");
        long bId = rb.jsonPath().getLong("id");
        long cId = rc.jsonPath().getLong("id");

        // Un requerimiento con los 3 caminos de dependencia de plaga:
        // legacy plaga_id (a), pivote requerimiento_plagas (b), liberacion_plagas (c)
        final long[] ids = new long[3];
        QuarkusTransaction.requiringNew().run(() -> {
            Requerimiento req = new Requerimiento();
            req.setFecha(LocalDate.of(2026, 8, 24));
            req.setFundo(fundoRepository.findById(1L));
            req.setLote(loteRepository.findById(1L));
            req.setEspecie(especieRepository.findById(1L));
            req.setCantidad(BigDecimal.TEN);
            req.setEstado("REGISTRADO");
            req.setPlaga(plagaRepository.findById(aId));
            requerimientoRepository.persist(req);
            ids[0] = req.getId();

            RequerimientoPlaga rp = new RequerimientoPlaga();
            rp.setRequerimiento(req);
            rp.setPlaga(plagaRepository.findById(bId));
            requerimientoPlagaRepository.persist(rp);
            ids[1] = rp.getId();

            Liberacion lib = new Liberacion();
            lib.setRequerimiento(req);
            lib.setFundo(fundoRepository.findById(1L));
            lib.setLote(loteRepository.findById(1L));
            lib.setCantidadLiberada(BigDecimal.ONE);
            lib.setHoraLiberacion("10:00");
            lib.setCreadoPor(TestSupport.SEED_ID);
            lib.getPlagas().add(plagaRepository.findById(cId));
            liberacionRepository.persist(lib);
            ids[2] = lib.getId();
        });

        given().get("/api/v1/plagas").then().statusCode(200)
                .body("find { it.id == " + aId + " }.puedeEliminar", is(false))
                .body("find { it.id == " + bId + " }.puedeEliminar", is(false))
                .body("find { it.id == " + cId + " }.puedeEliminar", is(false));

        delete("/api/v1/plagas", token, aId).then().statusCode(409)
                .body("codigo", is("REGISTRO_CON_DEPENDENCIAS"));
        delete("/api/v1/plagas", token, bId).then().statusCode(409)
                .body("codigo", is("REGISTRO_CON_DEPENDENCIAS"));
        delete("/api/v1/plagas", token, cId).then().statusCode(409)
                .body("codigo", is("REGISTRO_CON_DEPENDENCIAS"));
        put("/api/v1/plagas", token, aId, "Plaga_deps_a_v1", "INACTIVO").then().statusCode(409)
                .body("codigo", is("REGISTRO_CON_DEPENDENCIAS"));

        // Limpieza: liberacion (+ limpia join) -> pivote -> requerimiento
        QuarkusTransaction.requiringNew().run(() -> {
            Liberacion lib = liberacionRepository.findById(ids[2]);
            lib.getPlagas().clear();
            liberacionRepository.persist(lib);
            liberacionRepository.deleteById(ids[2]);
            requerimientoPlagaRepository.deleteById(ids[1]);
            requerimientoRepository.deleteById(ids[0]);
        });

        // Sin dependencias: la transicion a INACTIVO ya procede (flag false)
        put("/api/v1/plagas", token, aId, "Plaga_deps_a_v1", "INACTIVO").then().statusCode(200)
                .body("puedeEliminar", is(false));

        QuarkusTransaction.requiringNew().run(() -> {
            plagaRepository.deleteById(aId);
            plagaRepository.deleteById(bId);
            plagaRepository.deleteById(cId);
        });
    }

    @Test
    void nematodos_puedeEliminar_reflejaEstado() {
        String token = TestSupport.seedToken();

        Response r = post("/api/v1/nematodos", token, "Nema_flag_v1");
        r.then().statusCode(201).body("puedeEliminar", is(true));
        long id = r.jsonPath().getLong("id");

        put("/api/v1/nematodos", token, id, "Nema_flag_v1", "INACTIVO").then().statusCode(200)
                .body("puedeEliminar", is(false));
        given().get("/api/v1/nematodos").then().statusCode(200)
                .body("find { it.id == " + id + " }.puedeEliminar", is(false));

        QuarkusTransaction.requiringNew().run(() -> nematodoRepository.deleteById(id));
    }

    @Test
    void patrones_puedeEliminar_reflejaEstado() {
        String token = TestSupport.seedToken();

        Response r = post("/api/v1/patrones", token, "Patron_flag_v1");
        r.then().statusCode(201).body("puedeEliminar", is(true));
        long id = r.jsonPath().getLong("id");

        put("/api/v1/patrones", token, id, "Patron_flag_v1", "INACTIVO").then().statusCode(200)
                .body("puedeEliminar", is(false));
        given().get("/api/v1/patrones").then().statusCode(200)
                .body("find { it.id == " + id + " }.puedeEliminar", is(false));

        QuarkusTransaction.requiringNew().run(() -> patronRepository.deleteById(id));
    }
}