package pe.sistema.insectosbeneficos.integridad;

import java.util.HashSet;
import java.util.Set;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;

/**
 * Integridad referencial para el flag `puedeEliminar` (v1.16.0).
 * Si un registro tiene filas dependientes, su eliminacion (soft delete) se
 * rechaza con 409 REGISTRO_CON_DEPENDENCIAS y el flag sale en false en los DTO.
 *
 * USUARIO (creado_por) — SOLO tablas operativas:
 *   requerimientos, despachos, recepciones, liberaciones, cumplimiento_programacion.
 *   EXCLUIDOS: notificaciones, dispositivos_tokens, usuarios.creado_por (auditoria).
 * ESPECIE: programaciones, requerimientos.
 * PLAGA: requerimientos.plaga_id (legacy), requerimiento_plagas, liberacion_plagas.
 * NEMATODOS / PATRONES: sin FKs entrantes -> sin check (Ley 4).
 *
 * Patron anti N+1: batch (Set de ids) para listados; count unitario para
 * eliminar/actualizar/crear/obtener.
 */
@ApplicationScoped
public class DependenciasService {

    @Inject
    EntityManager em;

    // ------------------------------------------------------------------
    // Usuarios
    // ------------------------------------------------------------------

    public Set<Long> usuariosConDependencias() {
        Set<Long> ids = new HashSet<>();
        ids.addAll(longQuery("select distinct r.creadoPor from Requerimiento r where r.creadoPor is not null"));
        ids.addAll(longQuery("select distinct d.creadoPor from Despacho d where d.creadoPor is not null"));
        ids.addAll(longQuery("select distinct rc.creadoPor from Recepcion rc where rc.creadoPor is not null"));
        ids.addAll(longQuery("select distinct l.creadoPor from Liberacion l where l.creadoPor is not null"));
        ids.addAll(longQuery("select distinct c.creadoPor from CumplimientoProgramacion c where c.creadoPor is not null"));
        return ids;
    }

    public boolean usuarioTieneDependencias(Long id) {
        return existe("select count(r) from Requerimiento r where r.creadoPor = :id", id)
                || existe("select count(d) from Despacho d where d.creadoPor = :id", id)
                || existe("select count(rc) from Recepcion rc where rc.creadoPor = :id", id)
                || existe("select count(l) from Liberacion l where l.creadoPor = :id", id)
                || existe("select count(c) from CumplimientoProgramacion c where c.creadoPor = :id", id);
    }

    // ------------------------------------------------------------------
    // Especies
    // ------------------------------------------------------------------

    public Set<Long> especiesConDependencias() {
        Set<Long> ids = new HashSet<>();
        ids.addAll(longQuery("select distinct p.especie.id from Programacion p"));
        ids.addAll(longQuery("select distinct r.especie.id from Requerimiento r"));
        return ids;
    }

    public boolean especieTieneDependencias(Long id) {
        return existe("select count(p) from Programacion p where p.especie.id = :id", id)
                || existe("select count(r) from Requerimiento r where r.especie.id = :id", id);
    }

    // ------------------------------------------------------------------
    // Plagas
    // ------------------------------------------------------------------

    public Set<Long> plagasConDependencias() {
        Set<Long> ids = new HashSet<>();
        ids.addAll(longQuery("select distinct r.plaga.id from Requerimiento r where r.plaga is not null"));
        ids.addAll(longQuery("select distinct rp.plaga.id from RequerimientoPlaga rp"));
        ids.addAll(longQuery("select distinct p.id from Liberacion l join l.plagas p"));
        return ids;
    }

    public boolean plagaTieneDependencias(Long id) {
        return existe("select count(r) from Requerimiento r where r.plaga.id = :id", id)
                || existe("select count(rp) from RequerimientoPlaga rp where rp.plaga.id = :id", id)
                || existe("select count(lp) from Liberacion l join l.plagas lp where lp.id = :id", id);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private Set<Long> longQuery(String jpql) {
        return new HashSet<>(em.createQuery(jpql, Long.class).getResultList());
    }

    private boolean existe(String jpql, Long id) {
        return em.createQuery(jpql, Long.class).setParameter("id", id).getSingleResult() > 0;
    }
}
