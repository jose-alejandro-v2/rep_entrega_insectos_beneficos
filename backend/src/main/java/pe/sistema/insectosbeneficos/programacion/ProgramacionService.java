package pe.sistema.insectosbeneficos.programacion;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import pe.sistema.insectosbeneficos.programacion.dto.ProgramacionDto;
import pe.sistema.insectosbeneficos.programacion.dto.UpdateProgramacionRequest;
import pe.sistema.insectosbeneficos.seguridad.ApiException;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@ApplicationScoped
public class ProgramacionService {

    @Inject
    ProgramacionRepository programacionRepository;

    @Inject
    EspecieRepository especieRepository;

    @Inject
    DetalleProgramacionRepository detalleRepository;

    @Inject
    ProgramacionMapper mapper;

    public List<ProgramacionDto> getProgramaciones(Integer anio, Integer mes) {
        return programacionRepository.findByAnioAndMes(anio, mes).stream()
                .map(mapper::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public Programacion crearProgramacionInicial(Integer anio, Integer mes, Especie especie) {
        Programacion p = new Programacion();
        p.setAnio(anio);
        p.setMes(mes);
        p.setEspecie(especie);
        p.setStockInicialBase(5000);
        p.setEstado("EN_PROCESO");

        // Genera UNA fila por cada Lunes (MONDAY) y Jueves (THURSDAY) reales que caen
        // DENTRO del mes (HITO-012 / diseño A). Filas ordenadas cronológicamente por fecha.
        // El día (LUNES/JUEVES) se deriva de `fecha` (dayOfWeek); no existe columna `dia`.
        List<DetalleProgramacion> detalles = new ArrayList<>();
        int currentStock = p.getStockInicialBase();
        int lengthOfMonth = LocalDate.of(anio, mes, 1).lengthOfMonth();
        for (int day = 1; day <= lengthOfMonth; day++) {
            LocalDate fecha = LocalDate.of(anio, mes, day);
            DayOfWeek dow = fecha.getDayOfWeek();
            if (dow == DayOfWeek.MONDAY || dow == DayOfWeek.THURSDAY) {
                DetalleProgramacion d = new DetalleProgramacion();
                d.setProgramacion(p);
                // Semana del mes (1..5): agrupa el Lunes+Jueves de una misma semana para
                // el fondo alternado. NO es única (la unicidad es por `fecha`).
                d.setSemana(((day - 1) / 7) + 1);
                d.setFecha(fecha);
                d.setPapelConPostura(0);
                d.setSobreConCascarilla(0);
                d.setTotal(0);
                d.setStockInicial(currentStock);
                d.setStockFinal(currentStock);
                d.setEstado("EN_PROCESO");
                detalles.add(d);
                // Totales iniciales en 0 → el remanente acumulado no cambia todavía;
                // updateProgramacion recalcula los valores reales al editar.
            }
        }
        p.setDetalles(detalles);
        programacionRepository.persist(p);
        return p;
    }

    /**
     * Crea una nueva programacion validando que no exista para el mismo mes+año+especie.
     * Solo Admin/Super Admin pueden crear programaciones (validado en Resource).
     */
    @Transactional
    public ProgramacionDto crearProgramacion(Integer anio, Integer mes, Long especieId) {
        // Validar que la especie exista
        Especie especie = especieRepository.findByIdOptional(especieId)
                .orElseThrow(() -> new ApiException(jakarta.ws.rs.core.Response.Status.NOT_FOUND,
                        "ESPECIE_NO_ENCONTRADA", "Especie no encontrada"));

        // Validar que no exista ya una programacion para ese mes+año+especie
        if (programacionRepository.findByAnioAndMesAndEspecieId(anio, mes, especieId).isPresent()) {
            throw new ApiException(jakarta.ws.rs.core.Response.Status.CONFLICT,
                    "PROGRAMACION_YA_EXISTE",
                    "Ya existe una programación para este mes, año y especie");
        }

        // Crear la programacion inicial
        Programacion programacion = crearProgramacionInicial(anio, mes, especie);
        return mapper.toDto(programacion);
    }

    public ProgramacionDto getProgramacion(Long id) {
        Programacion p = programacionRepository.findByIdOptional(id)
                .orElseThrow(() -> new ApiException(jakarta.ws.rs.core.Response.Status.NOT_FOUND, "PROGRAMACION_NO_ENCONTRADA", "Programacion no encontrada"));
        return mapper.toDto(p);
    }

    @Transactional
    public ProgramacionDto updateProgramacion(Long id, UpdateProgramacionRequest request) {
        // El volcado inicial del flujo crear (POST → PUT) no pasa por la
        // restricción de día (HITO-016): solo la edición queda limitada a L/J.
        boolean esCreacionInicial = Boolean.TRUE.equals(request.getEsCreacionInicial());
        if (!esCreacionInicial) {
            verificarDiaEdicion();
        }

        Programacion p = programacionRepository.findByIdOptional(id)
                .orElseThrow(() -> new ApiException(jakarta.ws.rs.core.Response.Status.NOT_FOUND, "PROGRAMACION_NO_ENCONTRADA", "Programacion no encontrada"));

        if ("PUBLICADO".equals(p.getEstado())) {
            throw new ApiException(jakarta.ws.rs.core.Response.Status.BAD_REQUEST, "PROGRAMACION_PUBLICADA", "No se puede editar una programación publicada");
        }

        if (request.getStockInicialBase() != null) {
            p.setStockInicialBase(request.getStockInicialBase());
        }

        List<DetalleProgramacion> detalles = p.getDetalles();
        // Orden cronológico por fecha (cada fila = un Lunes/Jueves real del mes).
        detalles.sort((d1, d2) -> d1.getFecha().compareTo(d2.getFecha()));

        int currentStockInicial = p.getStockInicialBase();

        for (DetalleProgramacion d : detalles) {
            for (UpdateProgramacionRequest.UpdateDetalleRequest req : request.getDetalles()) {
                boolean match = (req.getId() != null && d.getId().equals(req.getId()))
                        || (req.getFecha() != null && d.getFecha().toString().equals(req.getFecha()));
                if (match) {
                    if (req.getPapelConPostura() != null) d.setPapelConPostura(req.getPapelConPostura());
                    if (req.getSobreConCascarilla() != null) d.setSobreConCascarilla(req.getSobreConCascarilla());
                }
            }

            d.setStockInicial(currentStockInicial);
            d.setTotal(d.getPapelConPostura() + d.getSobreConCascarilla());
            d.setStockFinal(d.getStockInicial() - d.getTotal());

            // Remanente acumulado (RN-037): puede volverse negativo si el total supera el stock.
            currentStockInicial = d.getStockFinal();
        }

        return mapper.toDto(p);
    }

    @Transactional
    public ProgramacionDto publicarProgramacion(Long id) {
        Programacion p = programacionRepository.findByIdOptional(id)
                .orElseThrow(() -> new ApiException(jakarta.ws.rs.core.Response.Status.NOT_FOUND, "PROGRAMACION_NO_ENCONTRADA", "Programacion no encontrada"));

        p.setEstado("PUBLICADO");
        p.setFechaPublicacion(ZonedDateTime.now());
        for (DetalleProgramacion d : p.getDetalles()) {
            d.setEstado("PUBLICADO");
        }

        System.out.println("Email sent: Programación " + id + " publicada.");
        return mapper.toDto(p);
    }

    private void verificarDiaEdicion() {
        DayOfWeek day = LocalDateTime.now().getDayOfWeek();
        if (day != DayOfWeek.MONDAY && day != DayOfWeek.THURSDAY) {
            throw new ApiException(jakarta.ws.rs.core.Response.Status.BAD_REQUEST, "EDICION_NO_PERMITIDA", "La edición solo está permitida los días lunes y jueves");
        }
    }
}
