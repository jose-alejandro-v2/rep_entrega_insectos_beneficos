package pe.sistema.insectosbeneficos;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;

import java.util.HashMap;
import java.util.Map;

import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.response.Response;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

import pe.sistema.insectosbeneficos.usuarios.EstadoUsuario;
import pe.sistema.insectosbeneficos.usuarios.Usuario;

/**
 * Tests del CRUD /api/v1/usuarios v2 (ADR-A003): RBAC por literales de rol,
 * soft delete, filtros por rolId, y proteccion reforzada del seed id=1
 * (no se desactiva ni se elimina, D-AUTH2-6).
 * La BD (Testcontainer) se comparte entre clases; los fixtures usan nombres
 * unicos por test y los SUPER_ADMIN extra creados se desactivan al final del
 * propio test para dejar el estado consistente (solo el seed activo).
 */
@QuarkusTest
@QuarkusTestResource(PostgresTestResource.class)
class UsuarioResourceTest {

    // ------------------------------------------------------------------
    // Listado / RBAC
    // ------------------------------------------------------------------

    @Test
    void listar_conSuperAdminIncluyeRolSuperAdmin() {
        given().auth().oauth2(TestSupport.seedToken())
                .get("/api/v1/usuarios")
                .then().statusCode(200)
                .body("rol", hasItem("Super Admin"))               // seed visible para SA
                .body("rolId", hasItem((int) TestSupport.ROL_SUPER_ADMIN_ID))
                .body("usuario", hasItem(TestSupport.SEED_USUARIO));
    }

    @Test
    void listar_adminNoVeRolSuperAdmin() {
        long adminId = TestSupport.crearUsuarioComoSeed("admin_vis_v2", "Admin Visor V2", TestSupport.ROL_ADMIN_ID);
        String adminToken = TestSupport.localLoginToken(adminId, TestSupport.SEED_PASSWORD);

        given().auth().oauth2(adminToken)
                .get("/api/v1/usuarios")
                .then().statusCode(200)
                .body("rol", everyItem(not("Super Admin")));

        // Con filtro explicito rolId=Super Admin, el ADMIN no ve nada
        given().auth().oauth2(adminToken)
                .queryParam("rolId", TestSupport.ROL_SUPER_ADMIN_ID)
                .get("/api/v1/usuarios")
                .then().statusCode(200)
                .body("size()", is(0));
    }

    @Test
    void listar_filtrosEstadoYRol() {
        long id = TestSupport.crearUsuarioComoSeed("filtro_v2_1", "Filtro V2 Uno", TestSupport.ROL_USUARIO_ID);
        String token = TestSupport.seedToken();

        given().auth().oauth2(token).queryParam("estado", "ACTIVO").get("/api/v1/usuarios")
                .then().statusCode(200).body("usuario", hasItem("filtro_v2_1"));

        TestSupport.eliminarComoSeed(id).then().statusCode(200); // -> INACTIVO

        given().auth().oauth2(token).queryParam("estado", "ACTIVO").get("/api/v1/usuarios")
                .then().statusCode(200).body("usuario", not(hasItem("filtro_v2_1")));

        given().auth().oauth2(token).queryParam("estado", "INACTIVO").get("/api/v1/usuarios")
                .then().statusCode(200).body("usuario", hasItem("filtro_v2_1"));

        given().auth().oauth2(token).queryParam("rolId", TestSupport.ROL_USUARIO_ID).get("/api/v1/usuarios")
                .then().statusCode(200).body("rol", everyItem(is("Usuario")));

        // valor invalido -> 400
        given().auth().oauth2(token).queryParam("estado", "INVALIDO").get("/api/v1/usuarios")
                .then().statusCode(400).body("codigo", is("DATOS_INVALIDOS"));
    }

    @Test
    void obtener_sinToken401_y_conRolUsuario403() {
        given().get("/api/v1/usuarios").then().statusCode(401);
        given().get("/api/v1/usuarios/1").then().statusCode(401);

        long opId = TestSupport.crearUsuarioComoSeed("oper_v2_sin_permiso", "Oper V2 Sin Permiso", TestSupport.ROL_USUARIO_ID);
        String opToken = TestSupport.localLoginToken(opId, TestSupport.SEED_PASSWORD);

        given().auth().oauth2(opToken).get("/api/v1/usuarios").then().statusCode(403);
        given().auth().oauth2(opToken).get("/api/v1/usuarios/" + opId).then().statusCode(403);
        // POST con Content-Type correcto para que la seguridad se evalue (sin
        // Content-Type RESTEasy responde 415 antes del chequeo de roles)
        given().auth().oauth2(opToken).contentType(ContentType.JSON).body(Map.of()).post("/api/v1/usuarios")
                .then().statusCode(403);
    }

    // ------------------------------------------------------------------
    // Crear
    // ------------------------------------------------------------------

    @Test
    void crear_usuarioNaceConPasswordDefaultYDebeCambiar() {
        Response r = TestSupport.crearUsuario(TestSupport.seedToken(), "nuevo_v2_crud", "Nuevo V2 Usuario", TestSupport.ROL_USUARIO_ID);
        r.then().statusCode(201)
                .body("usuario", is("nuevo_v2_crud"))
                .body("rol", is("Usuario"))
                .body("rolId", is((int) TestSupport.ROL_USUARIO_ID))
                .body("estado", is("ACTIVO"))
                .body("debeCambiarPassword", is(true))
                .body("creadoPor", notNullValue());

        // password SIEMPRE 00000000 hasheado -> login funciona con el default
        long id = r.jsonPath().getLong("id");
        TestSupport.assertLoginOk(id, TestSupport.SEED_PASSWORD);
    }

    @Test
    void crear_duplicado_devuelve409() {
        TestSupport.crearUsuarioComoSeed("dup_v2", "Duplicado V2", TestSupport.ROL_USUARIO_ID);
        TestSupport.crearUsuario(TestSupport.seedToken(), "dup_v2", "Duplicado V2", TestSupport.ROL_USUARIO_ID)
                .then().statusCode(409).body("codigo", is("USUARIO_YA_EXISTE"));
    }

    @Test
    void crear_sinRol_devuelve400() {
        Map<String, Object> body = new HashMap<>();
        body.put("usuario", "sin_rol_v2");
        body.put("nombre", "Sin Rol V2");
        given().auth().oauth2(TestSupport.seedToken())
                .contentType(ContentType.JSON).body(body)
                .post("/api/v1/usuarios")
                .then().statusCode(400).body("codigo", is("DATOS_INVALIDOS"));
    }

    @Test
    void crear_rolInexistente_devuelve404() {
        TestSupport.crearUsuario(TestSupport.seedToken(), "rol_inex_v2", "Rol Inexistente", 999999L)
                .then().statusCode(404).body("codigo", is("ROL_NO_ENCONTRADO"));
    }

    @Test
    void crear_dniInvalido_devuelve400() {
        Map<String, Object> conDniInvalido = TestSupport.crearBody("dni_abc_v2", "Dni Abc V2", TestSupport.ROL_USUARIO_ID);
        conDniInvalido.put("dni", "abc");
        given().auth().oauth2(TestSupport.seedToken())
                .contentType(ContentType.JSON).body(conDniInvalido)
                .post("/api/v1/usuarios")
                .then().statusCode(400).body("codigo", is("DATOS_INVALIDOS"));

        Map<String, Object> conDniDefault = TestSupport.crearBody("dni_default_v2", "Dni Default V2", TestSupport.ROL_USUARIO_ID);
        conDniDefault.put("dni", "00000000");
        given().auth().oauth2(TestSupport.seedToken())
                .contentType(ContentType.JSON).body(conDniDefault)
                .post("/api/v1/usuarios")
                .then().statusCode(400).body("codigo", is("DATOS_INVALIDOS"));
    }

    // ------------------------------------------------------------------
    // Correo (HITO-018): crear con email (normaliza), duplicado e invalido
    // ------------------------------------------------------------------

    @Test
    void crear_conEmail_devuelveEmailNormalizadoEnMinusculas() {
        Map<String, Object> body = TestSupport.crearBody("correo_v2", "Correo V2", TestSupport.ROL_USUARIO_ID);
        body.put("email", "  Jose.Sanidad@VanguardFresh.PE  ");
        Response r = given().auth().oauth2(TestSupport.seedToken())
                .contentType(ContentType.JSON).body(body)
                .post("/api/v1/usuarios");
        r.then().statusCode(201)
                .body("email", is("jose.sanidad@vanguardfresh.pe"));

        // Limpieza: inactivar el usuario creado (estado consistente de la BD compartida)
        TestSupport.eliminarComoSeed(r.jsonPath().getLong("id")).then().statusCode(200);
    }

    @Test
    void crear_emailInvalido_devuelve400() {
        Map<String, Object> body = TestSupport.crearBody("correo_mal_v2", "Correo Mal V2", TestSupport.ROL_USUARIO_ID);
        body.put("email", "correo-sin-arroba");
        given().auth().oauth2(TestSupport.seedToken())
                .contentType(ContentType.JSON).body(body)
                .post("/api/v1/usuarios")
                .then().statusCode(400).body("codigo", is("CORREO_INVALIDO"));
    }

    @Test
    void crear_emailDuplicado_devuelve409() {
        Map<String, Object> body = TestSupport.crearBody("correo_dup_v2", "Correo Dup V2", TestSupport.ROL_USUARIO_ID);
        body.put("email", "repetido@vanguardfresh.pe");
        Response primero = given().auth().oauth2(TestSupport.seedToken())
                .contentType(ContentType.JSON).body(body)
                .post("/api/v1/usuarios");
        primero.then().statusCode(201);

        Map<String, Object> bodyDup = TestSupport.crearBody("correo_dup2_v2", "Correo Dup2 V2", TestSupport.ROL_USUARIO_ID);
        bodyDup.put("email", "REPETIDO@vanguardfresh.pe"); // case-insensitive -> 409
        given().auth().oauth2(TestSupport.seedToken())
                .contentType(ContentType.JSON).body(bodyDup)
                .post("/api/v1/usuarios")
                .then().statusCode(409).body("codigo", is("CORREO_YA_EXISTE"));

        TestSupport.eliminarComoSeed(primero.jsonPath().getLong("id")).then().statusCode(200);
    }

    @Test
    void crear_adminPuedeCrearAdminYUsuario_peroNoSuperAdmin() {
        long adminId = TestSupport.crearUsuarioComoSeed("admin_crea_v2", "Admin Creador V2", TestSupport.ROL_ADMIN_ID);
        String adminToken = TestSupport.localLoginToken(adminId, TestSupport.SEED_PASSWORD);

        TestSupport.crearUsuario(adminToken, "admin_hijo_v2", "Admin Hijo V2", TestSupport.ROL_ADMIN_ID).then().statusCode(201);
        TestSupport.crearUsuario(adminToken, "usr_hijo_v2", "Usr Hijo V2", TestSupport.ROL_USUARIO_ID).then().statusCode(201);

        TestSupport.crearUsuario(adminToken, "super_no_v2", "Super No V2", TestSupport.ROL_SUPER_ADMIN_ID)
                .then().statusCode(403).body("codigo", is("SIN_PERMISOS"));
    }

    // ------------------------------------------------------------------
    // Actualizar
    // ------------------------------------------------------------------

    @Test
    void actualizar_cambiaDatosNoPassword() {
        long id = TestSupport.crearUsuarioComoSeed("actualiza_v2", "Antes V2", TestSupport.ROL_USUARIO_ID);

        Map<String, Object> body = new HashMap<>();
        body.put("usuario", "actualiza_v2");
        body.put("nombre", "Después V2");
        body.put("rolId", TestSupport.ROL_ADMIN_ID);
        body.put("estado", "ACTIVO");

        given().auth().oauth2(TestSupport.seedToken())
                .contentType(ContentType.JSON).body(body)
                .put("/api/v1/usuarios/" + id)
                .then().statusCode(200)
                .body("nombre", is("Después V2"))
                .body("rol", is("Admin"))
                .body("rolId", is((int) TestSupport.ROL_ADMIN_ID))
                .body("debeCambiarPassword", is(true)); // el password NO se toca

        // Duplicado de usuario por PUT -> 409
        long otroId = TestSupport.crearUsuarioComoSeed("actualiza_otro_v2", "Otro V2", TestSupport.ROL_USUARIO_ID);
        Map<String, Object> dup = new HashMap<>();
        dup.put("usuario", "actualiza_v2");
        dup.put("nombre", "Otro V2");
        dup.put("rolId", TestSupport.ROL_USUARIO_ID);
        dup.put("estado", "ACTIVO");
        given().auth().oauth2(TestSupport.seedToken())
                .contentType(ContentType.JSON).body(dup)
                .put("/api/v1/usuarios/" + otroId)
                .then().statusCode(409);
    }

    @Test
    void actualizar_adminNoPuedeTocarSuperAdmin() {
        long adminId = TestSupport.crearUsuarioComoSeed("admin_upd_v2", "Admin Updater V2", TestSupport.ROL_ADMIN_ID);
        String adminToken = TestSupport.localLoginToken(adminId, TestSupport.SEED_PASSWORD);

        Map<String, Object> body = new HashMap<>();
        body.put("usuario", "Admin PowerApps");
        body.put("nombre", "Admin PowerApps");
        body.put("rolId", TestSupport.ROL_SUPER_ADMIN_ID);
        body.put("estado", "ACTIVO");
        given().auth().oauth2(adminToken).contentType(ContentType.JSON).body(body)
                .put("/api/v1/usuarios/" + TestSupport.SEED_ID)
                .then().statusCode(403).body("codigo", is("SIN_PERMISOS"));

        // Subir a SUPER_ADMIN desde ADMIN -> 403
        Map<String, Object> up = new HashMap<>();
        up.put("usuario", "admin_upd_v2");
        up.put("nombre", "Admin Updater V2");
        up.put("rolId", TestSupport.ROL_SUPER_ADMIN_ID);
        up.put("estado", "ACTIVO");
        given().auth().oauth2(adminToken).contentType(ContentType.JSON).body(up)
                .put("/api/v1/usuarios/" + adminId)
                .then().statusCode(403);
    }

    @Test
    void actualizar_seedNoPuedeDesactivarse() {
        Map<String, Object> body = new HashMap<>();
        body.put("usuario", "Admin PowerApps");
        body.put("nombre", "Admin PowerApps");
        body.put("rolId", TestSupport.ROL_SUPER_ADMIN_ID);
        body.put("estado", "INACTIVO");
        given().auth().oauth2(TestSupport.seedToken()).contentType(ContentType.JSON).body(body)
                .put("/api/v1/usuarios/" + TestSupport.SEED_ID)
                .then().statusCode(400).body("codigo", is("SEED_SUPER_ADMIN_INMUNE"));
    }

    // ------------------------------------------------------------------
    // Correo (HITO-018): actualizar email (asignar, cambiar y limpiar)
    // ------------------------------------------------------------------

    @Test
    void actualizar_cambiaYLimpiaEmail_preservandoCuandoNull() throws Exception {
        long id = TestSupport.crearUsuarioComoSeed("correo_upd_v2", "Correo Upd V2", TestSupport.ROL_USUARIO_ID);

        // PUT null (campo ausente) -> preserva (null actual no cambia nada)
        Map<String, Object> sinEmail = new HashMap<>();
        sinEmail.put("usuario", "correo_upd_v2");
        sinEmail.put("nombre", "Correo Upd V2");
        sinEmail.put("rolId", TestSupport.ROL_USUARIO_ID);
        sinEmail.put("estado", "ACTIVO");
        given().auth().oauth2(TestSupport.seedToken()).contentType(ContentType.JSON).body(sinEmail)
                .put("/api/v1/usuarios/" + id)
                .then().statusCode(200).body("email", nullValue());

        // PUT con email -> lo asigna normalizado
        Map<String, Object> conEmail = new HashMap<>();
        conEmail.put("usuario", "correo_upd_v2");
        conEmail.put("nombre", "Correo Upd V2");
        conEmail.put("rolId", TestSupport.ROL_USUARIO_ID);
        conEmail.put("estado", "ACTIVO");
        conEmail.put("email", "  Usuario@VanguardFresh.pe  ");
        given().auth().oauth2(TestSupport.seedToken()).contentType(ContentType.JSON).body(conEmail)
                .put("/api/v1/usuarios/" + id)
                .then().statusCode(200).body("email", is("usuario@vanguardfresh.pe"));

        // PUT email vacio -> limpia (null)
        Map<String, Object> emailVacio = new HashMap<>();
        emailVacio.put("usuario", "correo_upd_v2");
        emailVacio.put("nombre", "Correo Upd V2");
        emailVacio.put("rolId", TestSupport.ROL_USUARIO_ID);
        emailVacio.put("estado", "ACTIVO");
        emailVacio.put("email", "  ");
        given().auth().oauth2(TestSupport.seedToken()).contentType(ContentType.JSON).body(emailVacio)
                .put("/api/v1/usuarios/" + id)
                .then().statusCode(200).body("email", nullValue());

        TestSupport.eliminarComoSeed(id).then().statusCode(200);
    }

    // ------------------------------------------------------------------
    // Soft delete e integridad
    // ------------------------------------------------------------------

    @Test
    void eliminar_softDelete_mantieneElRegistroEnBD() {
        long id = TestSupport.crearUsuarioComoSeed("borrar_soft_v2", "Borrar Soft V2", TestSupport.ROL_USUARIO_ID);

        given().auth().oauth2(TestSupport.seedToken())
                .delete("/api/v1/usuarios/" + id)
                .then().statusCode(200).body("mensaje", notNullValue());

        // Consulta directa a BD: el registro SIGUE existiendo, solo cambio estado
        Usuario persistido = Usuario.findById(id);
        Assertions.assertNotNull(persistido, "El registro no debe borrarse físicamente");
        Assertions.assertEquals(EstadoUsuario.INACTIVO, persistido.estado);

        // eliminar de nuevo -> 400 (ya inactivo)
        given().auth().oauth2(TestSupport.seedToken())
                .delete("/api/v1/usuarios/" + id)
                .then().statusCode(400).body("codigo", is("USUARIO_YA_INACTIVO"));
    }

    @Test
    void eliminar_noExiste_devuelve404() {
        given().auth().oauth2(TestSupport.seedToken())
                .delete("/api/v1/usuarios/999999")
                .then().statusCode(404).body("codigo", is("USUARIO_NO_ENCONTRADO"));
    }

    @Test
    void eliminar_adminPuedeDesactivarAdminYUsuario_peroNoSuperAdmin() {
        long adminId = TestSupport.crearUsuarioComoSeed("admin_borra_v2", "Admin Borrador V2", TestSupport.ROL_ADMIN_ID);
        long admin2Id = TestSupport.crearUsuarioComoSeed("admin_borra2_v2", "Admin Borrador 2 V2", TestSupport.ROL_ADMIN_ID);
        long victimaId = TestSupport.crearUsuarioComoSeed("victima_v2", "Víctima V2", TestSupport.ROL_USUARIO_ID);
        String adminToken = TestSupport.localLoginToken(adminId, TestSupport.SEED_PASSWORD);

        given().auth().oauth2(adminToken).delete("/api/v1/usuarios/" + victimaId).then().statusCode(200);
        // a OTRO ADMIN si (self-delete daria NO_AUTO_DESACTIVACION, regla aparte)
        given().auth().oauth2(adminToken).delete("/api/v1/usuarios/" + admin2Id).then().statusCode(200);

        // pero a un SUPER_ADMIN -> 403 SIN_PERMISOS (ADMIN nunca gestiona SUPER_ADMIN)
        given().auth().oauth2(adminToken).delete("/api/v1/usuarios/" + TestSupport.SEED_ID)
                .then().statusCode(403).body("codigo", is("SIN_PERMISOS"));
    }

    @Test
    void eliminar_seedSuperAdminInmune_niSeEliminaNiLoEliminan() {
        // El propio seed no puede eliminarse
        given().auth().oauth2(TestSupport.seedToken())
                .delete("/api/v1/usuarios/" + TestSupport.SEED_ID)
                .then().statusCode(400).body("codigo", is("SEED_SUPER_ADMIN_INMUNE"));

        // Otro SUPER_ADMIN tampoco puede eliminar al seed
        long saExtraId = TestSupport.crearUsuarioComoSeed("sa_extra_v2", "SA Extra V2", TestSupport.ROL_SUPER_ADMIN_ID);
        String saExtraToken = TestSupport.localLoginToken(saExtraId, TestSupport.SEED_PASSWORD);
        given().auth().oauth2(saExtraToken).delete("/api/v1/usuarios/" + TestSupport.SEED_ID)
                .then().statusCode(400).body("codigo", is("SEED_SUPER_ADMIN_INMUNE"));

        // Restaura el estado: el seed desactiva al SA extra (deja solo al seed activo)
        TestSupport.eliminarComoSeed(saExtraId).then().statusCode(200);
    }

    @Test
    void eliminar_noSelfDelete_adminNoSeDesactiva() {
        long adminId = TestSupport.crearUsuarioComoSeed("admin_self_v2", "Admin Self V2", TestSupport.ROL_ADMIN_ID);
        String adminToken = TestSupport.localLoginToken(adminId, TestSupport.SEED_PASSWORD);

        given().auth().oauth2(adminToken).delete("/api/v1/usuarios/" + adminId)
                .then().statusCode(400).body("codigo", is("NO_AUTO_DESACTIVACION"));
    }

    @Test
    void eliminar_noSelfDelete_superAdminExtra() {
        long saExtraId = TestSupport.crearUsuarioComoSeed("sa_self_v2", "SA Self V2", TestSupport.ROL_SUPER_ADMIN_ID);
        String saExtraToken = TestSupport.localLoginToken(saExtraId, TestSupport.SEED_PASSWORD);

        // Con el seed activo + el SA extra, la auto-desactivacion -> 400 NO_AUTO_DESACTIVACION
        given().auth().oauth2(saExtraToken).delete("/api/v1/usuarios/" + saExtraId)
                .then().statusCode(400).body("codigo", is("NO_AUTO_DESACTIVACION"));

        // Restaura el estado
        TestSupport.eliminarComoSeed(saExtraId).then().statusCode(200);
    }
}