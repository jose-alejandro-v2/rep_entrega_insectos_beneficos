package pe.sistema.insectosbeneficos.requerimientos;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;
import pe.sistema.insectosbeneficos.catalogos.EtapaFenologica;
import pe.sistema.insectosbeneficos.catalogos.EtapaFenologicaRepository;
import pe.sistema.insectosbeneficos.catalogos.Fundo;
import pe.sistema.insectosbeneficos.catalogos.FundoRepository;
import pe.sistema.insectosbeneficos.catalogos.Lote;
import pe.sistema.insectosbeneficos.catalogos.LoteRepository;
import pe.sistema.insectosbeneficos.catalogos.Plaga;
import pe.sistema.insectosbeneficos.catalogos.PlagaRepository;
import pe.sistema.insectosbeneficos.programacion.CumplimientoProgramacionRepository;
import pe.sistema.insectosbeneficos.programacion.DetalleProgramacionRepository;
import pe.sistema.insectosbeneficos.programacion.Especie;
import pe.sistema.insectosbeneficos.programacion.EspecieRepository;
import pe.sistema.insectosbeneficos.programacion.Programacion;
import pe.sistema.insectosbeneficos.programacion.ProgramacionRepository;
import pe.sistema.insectosbeneficos.requerimientos.dto.ActualizarRequerimientoRequest;
import pe.sistema.insectosbeneficos.requerimientos.dto.CrearRequerimientoRequest;
import pe.sistema.insectosbeneficos.requerimientos.dto.RequerimientoDto;
import pe.sistema.insectosbeneficos.seguridad.ActualUsuario;
import pe.sistema.insectosbeneficos.seguridad.ApiException;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Servicio de dominio del módulo de requerimientos (HITO-008).
 * Patrón y estilo de errores ({@link ApiException}) idéntico a
 * {@code ProgramacionService}. Las reglas de negocio clave:
 *  - crear: estado inicial REGISTRADO, stockDisponible calculado, creadoPor = usuario actual.
 *  - actualizar: transición hacia adelante en el ciclo (no retroceder, no volver desde LIBERADO);
 *    al pasar a ENTREGADO exige papelConPostura + sobreConCascarilla cuya suma == cantidad.
 */
@ApplicationScoped
public class RequerimientoService {

    /** Ciclo de estados del dominio (orden de avance). */
    private static final List<String> CICLO =
            List.of("REGISTRADO", "PENDIENTE", "APROBADO", "ENTREGADO", "RECIBIDO", "LIBERADO");

    @Inject
    RequerimientoRepository requerimientoRepository;

    @Inject
    ProgramacionRepository programacionRepository;

    @Inject
    DetalleProgramacionRepository detalleProgramacionRepository;

    @Inject
    CumplimientoProgramacionRepository cumplimientoProgramacionRepository;

    @Inject
    EspecieRepository especieRepository;

    @Inject
    FundoRepository fundoRepository;

    @Inject
    LoteRepository loteRepository;

    @Inject
    EtapaFenologicaRepository etapaFenologicaRepository;

    @Inject
    PlagaRepository plagaRepository;

    @Inject
    RequerimientoLoteRepository requerimientoLoteRepository;

    @Inject
    RequerimientoPlagaRepository requerimientoPlagaRepository;

    @Inject
    RequerimientoMapper mapper;

    @Inject
    ActualUsuario actualUsuario;

    @Inject
    pe.sistema.insectosbeneficos.notificaciones.NotificacionService notificacionService;

    // ------------------------------------------------------------------
    // Lectura
    // ------------------------------------------------------------------

    public List<RequerimientoDto> listar(LocalDate fechaDesde, LocalDate fechaHasta, String estado, Long creadoPor) {
        return requerimientoRepository.findByFiltros(fechaDesde, fechaHasta, estado, creadoPor).stream()
                .map(mapper::toDto)
                .collect(Collectors.toList());
    }

    public RequerimientoDto obtenerPorId(Long id) {
        Requerimiento r = requerimientoRepository.findByIdOptional(id)
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND,
                        "REQUERIMIENTO_NO_ENCONTRADO", "Requerimiento no encontrado"));
        return mapper.toDto(r);
    }

    /**
     * Stock disponible en tiempo real de una especie (Screen 10 del mobile).
     * Consulta {@code cumplimiento_programacion.total_real} del último Lunes o Jueves
     * según el día actual (V21 stock fix).
     *
     * Lógica de fechaCorte:
     *   - Lunes/Martes/Miércoles → último Lunes
     *   - Jueves/Viernes/Sábado/Domingo → último Jueves
     *
     * Si no hay cumplimiento para la especie en esa fecha → 0.
     */
    public BigDecimal getStockDisponible(Long especiaId) {
        LocalDate fechaCorte = calcularFechaCorteStock();
        return cumplimientoProgramacionRepository
                .findByEspecieAndFecha(especiaId, fechaCorte)
                .map(cp -> BigDecimal.valueOf(cp.getTotalReal()))
                .orElse(BigDecimal.ZERO);
    }

    /**
     * Calcula la fecha de corte para determinar el stock del último Lunes o Jueves.
     * <ul>
     *   <li>Lunes(1)/Martes(2)/Miércoles(3) → último Lunes</li>
     *   <li>Jueves(4)/Viernes(5)/Sábado(6)/Domingo(7) → último Jueves</li>
     * </ul>
     */
    private LocalDate calcularFechaCorteStock() {
        LocalDate hoy = LocalDate.now();
        DayOfWeek dow = hoy.getDayOfWeek();
        int diasDesdeLunes = dow.getValue() - 1; // 0=Lun, 1=Mar, ..., 6=Dom

        if (dow.getValue() <= 3) { // Lun/Mar/Mie → último Lunes
            return hoy.minusDays(diasDesdeLunes);
        } else { // Jue/Vie/Sab/Dom → último Jueves
            int diasDesdeJueves = (dow.getValue() - 4 + 7) % 7;
            return hoy.minusDays(diasDesdeJueves);
        }
    }

    // ------------------------------------------------------------------
    // Escritura
    // ------------------------------------------------------------------

    @Transactional
    public RequerimientoDto crear(CrearRequerimientoRequest req) {
        validarCantidad(req.getCantidad());

        Fundo fundo = fundoRepository.findByIdOptional(req.getFundoId())
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND,
                        "FUNDO_NO_EXISTE", "Fundo no encontrado"));
        Especie especie = especieRepository.findByIdOptional(req.getEspecieId())
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND,
                        "ESPECIE_NO_EXISTE", "Especie no encontrada"));
        EtapaFenologica etapa = resolverEtapa(req.getEtapaFenologicaId());

        // Resolver lotes: lista tiene prioridad sobre loteId legacy
        List<Long> loteIds = resolverLoteIds(req);
        if (loteIds.isEmpty()) {
            throw new ApiException(Response.Status.BAD_REQUEST,
                    "LOTE_REQUERIDO", "Debe especificar al menos un lote");
        }
        Lote primerLote = loteRepository.findByIdOptional(loteIds.get(0))
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND,
                        "LOTE_NO_EXISTE", "Lote no encontrado"));

        // Resolver plagas: lista tiene prioridad sobre plagaId legacy
        List<Long> plagaIds = resolverPlagaIds(req);
        Plaga primerPlaga = null;
        if (!plagaIds.isEmpty()) {
            primerPlaga = plagaRepository.findByIdOptional(plagaIds.get(0))
                    .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND,
                            "PLAGA_NO_EXISTE", "Plaga no encontrada"));
        }

        BigDecimal stock = getStockDisponible(especie.getId());
        if (req.getCantidad().compareTo(stock) > 0) {
            throw new ApiException(Response.Status.BAD_REQUEST,
                    "CANTIDAD_INVALIDA", "La cantidad supera el stock disponible");
        }

        Requerimiento r = new Requerimiento();
        r.setFecha(req.getFecha());
        r.setFundo(fundo);
        r.setLote(primerLote);
        r.setEspecie(especie);
        r.setEtapaFenologica(etapa);
        r.setCantidad(req.getCantidad());
        r.setPlaga(primerPlaga);
        r.setEstado("REGISTRADO");
        r.setStockDisponible(stock);
        r.setObservaciones(req.getObservaciones());
        r.setCreadoPor(actualUsuario.getId());
        r.setCreatedAt(Instant.now());
        r.setUpdatedAt(Instant.now());
        requerimientoRepository.persist(r);

        // Guardar lotes en tabla pivote
        persistirLotesPivote(r, loteIds);

        // Guardar plagas en tabla pivote
        if (!plagaIds.isEmpty()) {
            persistirPlagasPivote(r, plagaIds);
        }

        return mapper.toDto(r);
    }

    @Transactional
    public RequerimientoDto actualizar(Long id, ActualizarRequerimientoRequest req) {
        Requerimiento r = requerimientoRepository.findByIdOptional(id)
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND,
                        "REQUERIMIENTO_NO_ENCONTRADO", "Requerimiento no encontrado"));

        validarCantidad(req.getCantidad());

        Fundo fundo = fundoRepository.findByIdOptional(req.getFundoId())
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND,
                        "FUNDO_NO_EXISTE", "Fundo no encontrado"));
        Especie especie = especieRepository.findByIdOptional(req.getEspecieId())
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND,
                        "ESPECIE_NO_EXISTE", "Especie no encontrada"));
        EtapaFenologica etapa = resolverEtapa(req.getEtapaFenologicaId());

        // Resolver lotes: lista tiene prioridad sobre loteId legacy
        List<Long> loteIds = resolverLoteIdsActualizar(req);
        if (loteIds.isEmpty()) {
            throw new ApiException(Response.Status.BAD_REQUEST,
                    "LOTE_REQUERIDO", "Debe especificar al menos un lote");
        }
        Lote primerLote = loteRepository.findByIdOptional(loteIds.get(0))
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND,
                        "LOTE_NO_EXISTE", "Lote no encontrado"));

        // Resolver plagas: lista tiene prioridad sobre plagaId legacy
        List<Long> plagaIds = resolverPlagaIdsActualizar(req);
        Plaga primerPlaga = null;
        if (!plagaIds.isEmpty()) {
            primerPlaga = plagaRepository.findByIdOptional(plagaIds.get(0))
                    .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND,
                            "PLAGA_NO_EXISTE", "Plaga no encontrada"));
        }

        validarTransicion(r.getEstado(), req.getEstado());
        String estadoAnterior = r.getEstado();

        // Aplica campos básicos
        r.setFecha(req.getFecha());
        r.setFundo(fundo);
        r.setLote(primerLote);
        r.setEspecie(especie);
        r.setEtapaFenologica(etapa);
        r.setCantidad(req.getCantidad());
        r.setPlaga(primerPlaga);
        if (req.getObservaciones() != null) {
            r.setObservaciones(req.getObservaciones());
        }

        if ("ENTREGADO".equals(req.getEstado())) {
            validarEntrega(req);
            r.setPapelConPostura(req.getPapelConPostura());
            r.setSobreConCascarilla(req.getSobreConCascarilla());
            if (req.getFechaLiberacion() != null) {
                r.setFechaLiberacion(req.getFechaLiberacion());
            }
            if (req.getHoraLiberacion() != null) {
                r.setHoraLiberacion(req.getHoraLiberacion());
            }
        }

        r.setEstado(req.getEstado());
        r.setStockDisponible(getStockDisponible(especie.getId()));
        r.setUpdatedAt(Instant.now());

        // Actualizar tablas pivote: eliminar y re-crear
        eliminarLotesPivote(r);
        persistirLotesPivote(r, loteIds);

        eliminarPlagasPivote(r);
        if (!plagaIds.isEmpty()) {
            persistirPlagasPivote(r, plagaIds);
        }

        // HITO-018: correo al solicitante cuando el requerimiento pasa a ENTREGADO
        // (RF-166/RN-027). Best-effort (NotificacionService nunca lanza).
        if ("ENTREGADO".equals(req.getEstado()) && !"ENTREGADO".equals(estadoAnterior)) {
            notificacionService.notificarRequerimientoEntregado(r);
        }

        return mapper.toDto(r);
    }

    // ------------------------------------------------------------------
    // Helpers de validación
    // ------------------------------------------------------------------

    private void validarCantidad(BigDecimal cantidad) {
        if (cantidad == null || cantidad.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ApiException(Response.Status.BAD_REQUEST,
                    "CANTIDAD_INVALIDA", "La cantidad debe ser mayor a cero");
        }
    }

    private void validarTransicion(String estadoActual, String estadoNuevo) {
        int idxNuevo = CICLO.indexOf(estadoNuevo);
        if (idxNuevo == -1) {
            throw new ApiException(Response.Status.BAD_REQUEST,
                    "ESTADO_NO_VALIDO", "Estado de requerimiento no válido");
        }
        int idxActual = CICLO.indexOf(estadoActual);
        if (idxNuevo < idxActual) {
            throw new ApiException(Response.Status.BAD_REQUEST,
                    "ESTADO_NO_VALIDO", "No se puede retroceder en el ciclo de estados del requerimiento");
        }
    }

    private void validarEntrega(ActualizarRequerimientoRequest req) {
        if (req.getPapelConPostura() == null || req.getSobreConCascarilla() == null) {
            throw new ApiException(Response.Status.BAD_REQUEST,
                    "ENTREGADO_PAPEL_SOBRE_INVALIDO",
                    "Debe indicar papel con postura y sobre con cascarilla para entregar");
        }
        BigDecimal suma = req.getPapelConPostura().add(req.getSobreConCascarilla());
        if (suma.compareTo(req.getCantidad()) != 0) {
            throw new ApiException(Response.Status.BAD_REQUEST,
                    "ENTREGADO_PAPEL_SOBRE_INVALIDO",
                    "La suma de papel con postura y sobre con cascarilla debe igualar la cantidad");
        }
    }

    private EtapaFenologica resolverEtapa(Long id) {
        if (id == null) {
            return null;
        }
        return etapaFenologicaRepository.findByIdOptional(id)
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND,
                        "ETAPA_NO_EXISTE", "Etapa fenológica no encontrada"));
    }

    private Plaga resolverPlaga(Long id) {
        if (id == null) {
            return null;
        }
        return plagaRepository.findByIdOptional(id)
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND,
                        "PLAGA_NO_EXISTE", "Plaga no encontrada"));
    }

    // ------------------------------------------------------------------
    // Helpers de selección múltiple (V19)
    // ------------------------------------------------------------------

    /**
     * Resuelve los IDs de lotes desde el request de creación.
     * La lista {@code lotes} tiene prioridad sobre {@code loteId} legacy.
     */
    private List<Long> resolverLoteIds(CrearRequerimientoRequest req) {
        if (req.getLotes() != null && !req.getLotes().isEmpty()) {
            return req.getLotes();
        }
        if (req.getLoteId() != null) {
            return List.of(req.getLoteId());
        }
        return List.of();
    }

    /**
     * Resuelve los IDs de lotes desde el request de actualización.
     * La lista {@code lotes} tiene prioridad sobre {@code loteId} legacy.
     */
    private List<Long> resolverLoteIdsActualizar(ActualizarRequerimientoRequest req) {
        if (req.getLotes() != null && !req.getLotes().isEmpty()) {
            return req.getLotes();
        }
        if (req.getLoteId() != null) {
            return List.of(req.getLoteId());
        }
        return List.of();
    }

    /**
     * Resuelve los IDs de plagas desde el request de creación.
     * La lista {@code plagas} tiene prioridad sobre {@code plagaId} legacy.
     */
    private List<Long> resolverPlagaIds(CrearRequerimientoRequest req) {
        if (req.getPlagas() != null && !req.getPlagas().isEmpty()) {
            return req.getPlagas();
        }
        if (req.getPlagaId() != null) {
            return List.of(req.getPlagaId());
        }
        return List.of();
    }

    /**
     * Resuelve los IDs de plagas desde el request de actualización.
     * La lista {@code plagas} tiene prioridad sobre {@code plagaId} legacy.
     */
    private List<Long> resolverPlagaIdsActualizar(ActualizarRequerimientoRequest req) {
        if (req.getPlagas() != null && !req.getPlagas().isEmpty()) {
            return req.getPlagas();
        }
        if (req.getPlagaId() != null) {
            return List.of(req.getPlagaId());
        }
        return List.of();
    }

    /** Persiste lotes en tabla pivote requerimiento_lotes. */
    private void persistirLotesPivote(Requerimiento r, List<Long> loteIds) {
        for (Long loteId : loteIds) {
            Lote lote = loteRepository.findByIdOptional(loteId)
                    .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND,
                            "LOTE_NO_EXISTE", "Lote no encontrado: " + loteId));
            RequerimientoLote rl = new RequerimientoLote();
            rl.setRequerimiento(r);
            rl.setLote(lote);
            requerimientoLoteRepository.persist(rl);
        }
    }

    /** Persiste plagas en tabla pivote requerimiento_plagas. */
    private void persistirPlagasPivote(Requerimiento r, List<Long> plagaIds) {
        for (Long plagaId : plagaIds) {
            Plaga plaga = plagaRepository.findByIdOptional(plagaId)
                    .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND,
                            "PLAGA_NO_EXISTE", "Plaga no encontrada: " + plagaId));
            RequerimientoPlaga rp = new RequerimientoPlaga();
            rp.setRequerimiento(r);
            rp.setPlaga(plaga);
            requerimientoPlagaRepository.persist(rp);
        }
    }

    /** Elimina todos los lotes pivote de un requerimiento (bulk delete). */
    private void eliminarLotesPivote(Requerimiento r) {
        requerimientoLoteRepository.delete("requerimiento.id = ?1", r.getId());
    }

    /** Elimina todas las plagas pivote de un requerimiento (bulk delete). */
    private void eliminarPlagasPivote(Requerimiento r) {
        requerimientoPlagaRepository.delete("requerimiento.id = ?1", r.getId());
    }
}
