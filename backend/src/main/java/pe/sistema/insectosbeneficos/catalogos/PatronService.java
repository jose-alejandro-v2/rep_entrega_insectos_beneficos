package pe.sistema.insectosbeneficos.catalogos;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;
import pe.sistema.insectosbeneficos.catalogos.dto.ActualizarCatalogoRequest;
import pe.sistema.insectosbeneficos.catalogos.dto.CrearCatalogoRequest;
import pe.sistema.insectosbeneficos.catalogos.dto.PatronDto;
import pe.sistema.insectosbeneficos.seguridad.ApiException;
import pe.sistema.insectosbeneficos.seguridad.MensajeResponse;
import pe.sistema.insectosbeneficos.seguridad.Validacion;
import java.util.List;
import java.util.stream.Collectors;

@ApplicationScoped
public class PatronService {

    @Inject
    PatronRepository patronRepository;

    @Inject
    CatalogoMapper mapper;

    @Inject
    Validacion validacion;

    public List<PatronDto> listar() {
        return patronRepository.listAll().stream()
                .map(p -> {
                    PatronDto dto = mapper.toPatronDto(p);
                    dto.setPuedeEliminar("ACTIVO".equals(p.getEstado()));
                    return dto;
                })
                .collect(Collectors.toList());
    }

    @Transactional
    public PatronDto crear(CrearCatalogoRequest req) {
        CrearCatalogoRequest valido = validacion.validar(req);
        String nombre = valido.getNombre().trim();
        if (patronRepository.find("nombre", nombre).firstResult() != null) {
            throw new ApiException(Response.Status.CONFLICT, "PATRON_YA_EXISTE",
                    "El patrón '" + nombre + "' ya existe");
        }
        Patron p = new Patron();
        p.setNombre(nombre);
        p.setEstado("ACTIVO");
        patronRepository.persist(p);
        PatronDto dto = mapper.toPatronDto(p);
        dto.setPuedeEliminar(true);
        return dto;
    }

    @Transactional
    public PatronDto actualizar(Long id, ActualizarCatalogoRequest req) {
        ActualizarCatalogoRequest valido = validacion.validar(req);
        Patron p = patronRepository.findById(id);
        if (p == null) {
            throw new ApiException(Response.Status.NOT_FOUND, "PATRON_NO_ENCONTRADO", "Patrón no encontrado");
        }
        String nombre = valido.getNombre().trim();
        if (!p.getNombre().equals(nombre)) {
            if (patronRepository.find("nombre", nombre).firstResult() != null) {
                throw new ApiException(Response.Status.CONFLICT, "PATRON_YA_EXISTE",
                        "El patrón '" + nombre + "' ya existe");
            }
        }
        p.setNombre(nombre);
        if (valido.getEstado() != null) {
            p.setEstado(valido.getEstado());
        }
        patronRepository.persist(p);
        PatronDto dto = mapper.toPatronDto(p);
        dto.setPuedeEliminar("ACTIVO".equals(p.getEstado()));
        return dto;
    }

    @Transactional
    public MensajeResponse eliminar(Long id) {
        Patron p = patronRepository.findById(id);
        if (p == null) {
            throw new ApiException(Response.Status.NOT_FOUND, "PATRON_NO_ENCONTRADO", "Patrón no encontrado");
        }
        if ("INACTIVO".equals(p.getEstado())) {
            throw new ApiException(Response.Status.BAD_REQUEST, "PATRON_YA_INACTIVO", "El patrón ya está inactivo");
        }
        p.setEstado("INACTIVO");
        patronRepository.persist(p);
        return new MensajeResponse("Patrón desactivado correctamente");
    }
}
