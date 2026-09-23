package pe.sistema.insectosbeneficos.catalogos;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;
import pe.sistema.insectosbeneficos.catalogos.dto.ActualizarCatalogoRequest;
import pe.sistema.insectosbeneficos.catalogos.dto.CrearCatalogoRequest;
import pe.sistema.insectosbeneficos.catalogos.dto.NematodoDto;
import pe.sistema.insectosbeneficos.seguridad.ApiException;
import pe.sistema.insectosbeneficos.seguridad.MensajeResponse;
import pe.sistema.insectosbeneficos.seguridad.Validacion;
import java.util.List;
import java.util.stream.Collectors;

@ApplicationScoped
public class NematodoService {

    @Inject
    NematodoRepository nematodoRepository;

    @Inject
    CatalogoMapper mapper;

    @Inject
    Validacion validacion;

    public List<NematodoDto> listar() {
        return nematodoRepository.listAll().stream()
                .map(n -> {
                    NematodoDto dto = mapper.toNematodoDto(n);
                    dto.setPuedeEliminar("ACTIVO".equals(n.getEstado()));
                    return dto;
                })
                .collect(Collectors.toList());
    }

    @Transactional
    public NematodoDto crear(CrearCatalogoRequest req) {
        CrearCatalogoRequest valido = validacion.validar(req);
        String nombre = valido.getNombre().trim();
        if (nematodoRepository.find("nombre", nombre).firstResult() != null) {
            throw new ApiException(Response.Status.CONFLICT, "NEMATODO_YA_EXISTE",
                    "El nematodo '" + nombre + "' ya existe");
        }
        Nematodo n = new Nematodo();
        n.setNombre(nombre);
        n.setEstado("ACTIVO");
        nematodoRepository.persist(n);
        NematodoDto dto = mapper.toNematodoDto(n);
        dto.setPuedeEliminar(true);
        return dto;
    }

    @Transactional
    public NematodoDto actualizar(Long id, ActualizarCatalogoRequest req) {
        ActualizarCatalogoRequest valido = validacion.validar(req);
        Nematodo n = nematodoRepository.findById(id);
        if (n == null) {
            throw new ApiException(Response.Status.NOT_FOUND, "NEMATODO_NO_ENCONTRADO", "Nematodo no encontrado");
        }
        String nombre = valido.getNombre().trim();
        if (!n.getNombre().equals(nombre)) {
            if (nematodoRepository.find("nombre", nombre).firstResult() != null) {
                throw new ApiException(Response.Status.CONFLICT, "NEMATODO_YA_EXISTE",
                        "El nematodo '" + nombre + "' ya existe");
            }
        }
        n.setNombre(nombre);
        if (valido.getEstado() != null) {
            n.setEstado(valido.getEstado());
        }
        nematodoRepository.persist(n);
        NematodoDto dto = mapper.toNematodoDto(n);
        dto.setPuedeEliminar("ACTIVO".equals(n.getEstado()));
        return dto;
    }

    @Transactional
    public MensajeResponse eliminar(Long id) {
        Nematodo n = nematodoRepository.findById(id);
        if (n == null) {
            throw new ApiException(Response.Status.NOT_FOUND, "NEMATODO_NO_ENCONTRADO", "Nematodo no encontrado");
        }
        if ("INACTIVO".equals(n.getEstado())) {
            throw new ApiException(Response.Status.BAD_REQUEST, "NEMATODO_YA_INACTIVO", "El nematodo ya está inactivo");
        }
        n.setEstado("INACTIVO");
        nematodoRepository.persist(n);
        return new MensajeResponse("Nematodo desactivado correctamente");
    }
}
