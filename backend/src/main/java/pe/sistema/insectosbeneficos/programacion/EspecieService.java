package pe.sistema.insectosbeneficos.programacion;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;
import pe.sistema.insectosbeneficos.integridad.DependenciasService;
import pe.sistema.insectosbeneficos.programacion.dto.ActualizarEspecieRequest;
import pe.sistema.insectosbeneficos.programacion.dto.CrearEspecieRequest;
import pe.sistema.insectosbeneficos.programacion.dto.EspecieDto;
import pe.sistema.insectosbeneficos.seguridad.ApiException;
import pe.sistema.insectosbeneficos.seguridad.MensajeResponse;
import pe.sistema.insectosbeneficos.seguridad.Validacion;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@ApplicationScoped
public class EspecieService {

    @Inject
    EspecieRepository especieRepository;

    @Inject
    ProgramacionMapper mapper;

    @Inject
    Validacion validacion;

    @Inject
    DependenciasService dependencias;

    public List<EspecieDto> getEspecies() {
        // Batch: un solo set de ids con dependencias para todo el listado (v1.16.0)
        Set<Long> conDeps = dependencias.especiesConDependencias();
        return especieRepository.listAll().stream()
                .map(e -> {
                    EspecieDto dto = mapper.toEspecieDto(e);
                    dto.setPuedeEliminar(calcularPuedeEliminar(e, conDeps.contains(e.getId())));
                    return dto;
                })
                .collect(Collectors.toList());
    }

    /** Flag (v1.16.0): ACTIVO y sin programaciones/requerimientos asociados. */
    private boolean calcularPuedeEliminar(Especie e, boolean conDeps) {
        return "ACTIVO".equals(e.getEstado()) && !conDeps;
    }

    /** 409 si la especie tiene programaciones o requerimientos asociados (v1.16.0). */
    private void verificarSinDependencias(Especie e) {
        if (dependencias.especieTieneDependencias(e.getId())) {
            throw new ApiException(Response.Status.CONFLICT, "REGISTRO_CON_DEPENDENCIAS",
                    "La especie tiene programaciones o requerimientos asociados y no puede eliminarse");
        }
    }

    @Transactional
    public EspecieDto crear(CrearEspecieRequest req) {
        CrearEspecieRequest valido = validacion.validar(req);
        String nombre = valido.getNombre().trim();
        if (especieRepository.find("nombre", nombre).firstResult() != null) {
            throw new ApiException(Response.Status.CONFLICT, "ESPECIE_YA_EXISTE",
                    "La especie '" + nombre + "' ya existe");
        }
        Especie e = new Especie();
        e.setNombre(nombre);
        e.setEstado("ACTIVO");
        especieRepository.persist(e);
        EspecieDto dto = mapper.toEspecieDto(e);
        dto.setPuedeEliminar(true);
        return dto;
    }

    @Transactional
    public EspecieDto actualizar(Long id, ActualizarEspecieRequest req) {
        ActualizarEspecieRequest valido = validacion.validar(req);
        Especie e = especieRepository.findById(id);
        if (e == null) {
            throw new ApiException(Response.Status.NOT_FOUND, "ESPECIE_NO_ENCONTRADA", "Especie no encontrada");
        }
        String nombre = valido.getNombre().trim();
        if (!e.getNombre().equals(nombre)) {
            if (especieRepository.find("nombre", nombre).firstResult() != null) {
                throw new ApiException(Response.Status.CONFLICT, "ESPECIE_YA_EXISTE",
                        "La especie '" + nombre + "' ya existe");
            }
        }
        e.setNombre(nombre);
        // Transicion ACTIVO -> INACTIVO: mismo 409 que el DELETE (v1.16.0)
        if (valido.getEstado() != null && "INACTIVO".equals(valido.getEstado())
                && "ACTIVO".equals(e.getEstado())) {
            verificarSinDependencias(e);
        }
        if (valido.getEstado() != null) {
            e.setEstado(valido.getEstado());
        }
        especieRepository.persist(e);
        EspecieDto dto = mapper.toEspecieDto(e);
        dto.setPuedeEliminar(calcularPuedeEliminar(e, dependencias.especieTieneDependencias(e.getId())));
        return dto;
    }

    @Transactional
    public MensajeResponse eliminar(Long id) {
        Especie e = especieRepository.findById(id);
        if (e == null) {
            throw new ApiException(Response.Status.NOT_FOUND, "ESPECIE_NO_ENCONTRADA", "Especie no encontrada");
        }
        if ("INACTIVO".equals(e.getEstado())) {
            throw new ApiException(Response.Status.BAD_REQUEST, "ESPECIE_YA_INACTIVA", "La especie ya está inactiva");
        }
        // Registros asociados -> 409 (v1.16.0)
        verificarSinDependencias(e);
        e.setEstado("INACTIVO");
        especieRepository.persist(e);
        return new MensajeResponse("Especie desactivada correctamente");
    }
}
