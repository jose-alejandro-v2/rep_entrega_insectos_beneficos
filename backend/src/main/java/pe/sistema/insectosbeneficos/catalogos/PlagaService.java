package pe.sistema.insectosbeneficos.catalogos;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;
import pe.sistema.insectosbeneficos.catalogos.dto.ActualizarCatalogoRequest;
import pe.sistema.insectosbeneficos.catalogos.dto.CrearCatalogoRequest;
import pe.sistema.insectosbeneficos.catalogos.dto.PlagaDto;
import pe.sistema.insectosbeneficos.integridad.DependenciasService;
import pe.sistema.insectosbeneficos.seguridad.ApiException;
import pe.sistema.insectosbeneficos.seguridad.MensajeResponse;
import pe.sistema.insectosbeneficos.seguridad.Validacion;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@ApplicationScoped
public class PlagaService {

    @Inject
    PlagaRepository plagaRepository;

    @Inject
    CatalogoMapper mapper;

    @Inject
    Validacion validacion;

    @Inject
    DependenciasService dependencias;

    public List<PlagaDto> listar() {
        // Batch: un solo set de ids con dependencias para todo el listado (v1.16.0)
        Set<Long> conDeps = dependencias.plagasConDependencias();
        return plagaRepository.listAll().stream()
                .map(p -> {
                    PlagaDto dto = mapper.toPlagaDto(p);
                    dto.setPuedeEliminar(calcularPuedeEliminar(p, conDeps.contains(p.getId())));
                    return dto;
                })
                .collect(Collectors.toList());
    }

    /** Flag (v1.16.0): ACTIVA y sin requerimientos/liberaciones asociadas. */
    private boolean calcularPuedeEliminar(Plaga p, boolean conDeps) {
        return "ACTIVO".equals(p.getEstado()) && !conDeps;
    }

    /** 409 si la plaga tiene requerimientos o liberaciones asociadas (v1.16.0). */
    private void verificarSinDependencias(Plaga p) {
        if (dependencias.plagaTieneDependencias(p.getId())) {
            throw new ApiException(Response.Status.CONFLICT, "REGISTRO_CON_DEPENDENCIAS",
                    "La plaga tiene requerimientos o liberaciones asociadas y no puede eliminarse");
        }
    }

    @Transactional
    public PlagaDto crear(CrearCatalogoRequest req) {
        CrearCatalogoRequest valido = validacion.validar(req);
        String nombre = valido.getNombre().trim();
        if (plagaRepository.find("nombre", nombre).firstResult() != null) {
            throw new ApiException(Response.Status.CONFLICT, "PLAGA_YA_EXISTE",
                    "La plaga '" + nombre + "' ya existe");
        }
        Plaga p = new Plaga();
        p.setNombre(nombre);
        p.setEstado("ACTIVO");
        plagaRepository.persist(p);
        PlagaDto dto = mapper.toPlagaDto(p);
        dto.setPuedeEliminar(true);
        return dto;
    }

    @Transactional
    public PlagaDto actualizar(Long id, ActualizarCatalogoRequest req) {
        ActualizarCatalogoRequest valido = validacion.validar(req);
        Plaga p = plagaRepository.findById(id);
        if (p == null) {
            throw new ApiException(Response.Status.NOT_FOUND, "PLAGA_NO_ENCONTRADA", "Plaga no encontrada");
        }
        String nombre = valido.getNombre().trim();
        if (!p.getNombre().equals(nombre)) {
            if (plagaRepository.find("nombre", nombre).firstResult() != null) {
                throw new ApiException(Response.Status.CONFLICT, "PLAGA_YA_EXISTE",
                        "La plaga '" + nombre + "' ya existe");
            }
        }
        p.setNombre(nombre);
        // Transicion ACTIVO -> INACTIVO: mismo 409 que el DELETE (v1.16.0)
        if (valido.getEstado() != null && "INACTIVO".equals(valido.getEstado())
                && "ACTIVO".equals(p.getEstado())) {
            verificarSinDependencias(p);
        }
        if (valido.getEstado() != null) {
            p.setEstado(valido.getEstado());
        }
        plagaRepository.persist(p);
        PlagaDto dto = mapper.toPlagaDto(p);
        dto.setPuedeEliminar(calcularPuedeEliminar(p, dependencias.plagaTieneDependencias(p.getId())));
        return dto;
    }

    @Transactional
    public MensajeResponse eliminar(Long id) {
        Plaga p = plagaRepository.findById(id);
        if (p == null) {
            throw new ApiException(Response.Status.NOT_FOUND, "PLAGA_NO_ENCONTRADA", "Plaga no encontrada");
        }
        if ("INACTIVO".equals(p.getEstado())) {
            throw new ApiException(Response.Status.BAD_REQUEST, "PLAGA_YA_INACTIVA", "La plaga ya está inactiva");
        }
        // Registros asociados -> 409 (v1.16.0)
        verificarSinDependencias(p);
        p.setEstado("INACTIVO");
        plagaRepository.persist(p);
        return new MensajeResponse("Plaga desactivada correctamente");
    }
}
