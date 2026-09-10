package pe.sistema.insectosbeneficos.requerimientos;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * Entidad de fotos adjuntas a un requerimiento (HITO-010).
 * Patrón idéntico a {@link Requerimiento}: entidad Plain JPA + Repository Panache.
 *
 * Cada foto almacena metadatos inmutables (nombre original, content-type, tamaño,
 * ruta en disco). La entidad referencia a {@link Requerimiento} via FK.
 */
@Entity
@Table(name = "fotos_requerimiento")
public class FotoRequerimiento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requerimiento_id", nullable = false)
    private Requerimiento requerimiento;

    @Column(nullable = false, length = 500)
    private String ruta;

    @Column(name = "nombre_archivo", nullable = false, length = 255)
    private String nombreArchivo;

    @Column(name = "tamano_bytes", nullable = false)
    private Long tamanoBytes;

    @Column(name = "content_type", nullable = false, length = 100)
    private String contentType;

    @Column(columnDefinition = "text")
    private String metadatos;

    /** Bytes crudos de la imagen (BYTEA, V20). Nullable para fotos legacy (V11). */
    @Basic(fetch = FetchType.LAZY)
    @Column(columnDefinition = "BYTEA")
    private byte[] contenido;

    @Column(name = "creado_en", updatable = false)
    private Instant creadoEn = Instant.now();

    // ------------------------------------------------------------------
    // Getters / Setters
    // ------------------------------------------------------------------

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Requerimiento getRequerimiento() { return requerimiento; }
    public void setRequerimiento(Requerimiento requerimiento) { this.requerimiento = requerimiento; }

    public String getRuta() { return ruta; }
    public void setRuta(String ruta) { this.ruta = ruta; }

    public byte[] getContenido() { return contenido; }
    public void setContenido(byte[] contenido) { this.contenido = contenido; }

    public String getNombreArchivo() { return nombreArchivo; }
    public void setNombreArchivo(String nombreArchivo) { this.nombreArchivo = nombreArchivo; }

    public Long getTamanoBytes() { return tamanoBytes; }
    public void setTamanoBytes(Long tamanoBytes) { this.tamanoBytes = tamanoBytes; }

    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }

    public String getMetadatos() { return metadatos; }
    public void setMetadatos(String metadatos) { this.metadatos = metadatos; }

    public Instant getCreadoEn() { return creadoEn; }
    public void setCreadoEn(Instant creadoEn) { this.creadoEn = creadoEn; }
}
