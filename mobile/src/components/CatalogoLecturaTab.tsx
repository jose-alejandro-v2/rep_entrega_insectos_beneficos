/**
 * CatalogoLecturaTab — pestañas SOLO LECTURA de Fundos, Variedades y Lotes
 * (v1.16.0, Q4: visibles para todos los roles; el CRUD solo Admin/SA).
 *
 * Carga vía ApiClient (`listarFundos`/`listarVariedades`/`listarLotes`).
 * Fundos y Variedades (~6/11 registros) se listan directo; Lotes (~157)
 * incluye buscador local (nombre/fundo/variedad). Sin acciones de edición.
 */

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {
  extractErrorMessage,
  listarFundos,
  listarLotes,
  listarVariedades,
  type FundoDto,
  type LoteDto,
  type VariedadDto,
} from '../services/ApiClient';
import {theme} from '../theme';
import AppCard from './AppCard';
import AppInput from './AppInput';
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';
import LoadingState from './LoadingState';
import StatusChip from './StatusChip';

export type CatalogoLecturaTipo = 'fundos' | 'variedades' | 'lotes';

interface Props {
  tipo: CatalogoLecturaTipo;
}

const PLURALES: Record<CatalogoLecturaTipo, string> = {
  fundos: 'Fundos',
  variedades: 'Variedades',
  lotes: 'Lotes',
};

const ICONOS: Record<CatalogoLecturaTipo, string> = {
  fundos: 'home-variant-outline',
  variedades: 'palette',
  lotes: 'view-grid-outline',
};

export default function CatalogoLecturaTab({tipo}: Props) {
  const [fundos, setFundos] = useState<FundoDto[]>([]);
  const [variedades, setVariedades] = useState<VariedadDto[]>([]);
  const [lotes, setLotes] = useState<LoteDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tipo === 'fundos') {
        setFundos(await listarFundos());
      } else if (tipo === 'variedades') {
        setVariedades(await listarVariedades());
      } else {
        setLotes(await listarLotes());
      }
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [tipo]);

  useEffect(() => {
    setBusqueda('');
    loadData();
  }, [loadData]);

  const plural = PLURALES[tipo];

  const lotesFiltrados = useMemo(() => {
    if (tipo !== 'lotes') {
      return [];
    }
    const q = busqueda.trim().toLowerCase();
    if (!q) {
      return lotes;
    }
    return lotes.filter(
      l =>
        l.nombre.toLowerCase().includes(q) ||
        l.fundo.toLowerCase().includes(q) ||
        l.variedad.toLowerCase().includes(q),
    );
  }, [tipo, lotes, busqueda]);

  const renderFila = (key: number, contenido: React.ReactNode) => (
    <AppCard key={key} style={styles.card}>
      {contenido}
    </AppCard>
  );

  let cuerpo: React.ReactNode;
  if (loading) {
    cuerpo = <LoadingState message={`Cargando ${plural.toLowerCase()}…`} />;
  } else if (error) {
    cuerpo = <ErrorState onRetry={loadData} />;
  } else if (tipo === 'fundos') {
    cuerpo =
      fundos.length > 0 ? (
        <View style={styles.list}>
          {fundos.map(f =>
            renderFila(
              f.id,
              <Text style={styles.nombre}>{f.nombre}</Text>,
            ),
          )}
        </View>
      ) : (
        <EmptyState
          title="No hay fundos"
          message="Aún no se registraron fundos en el sistema."
          icon={ICONOS.fundos}
        />
      );
  } else if (tipo === 'variedades') {
    cuerpo =
      variedades.length > 0 ? (
        <View style={styles.list}>
          {variedades.map(v =>
            renderFila(
              v.id,
              <View style={styles.rowBetween}>
                <Text style={styles.nombre}>{v.nombre}</Text>
                <StatusChip tone="info" label={v.color || '—'} />
              </View>,
            ),
          )}
        </View>
      ) : (
        <EmptyState
          title="No hay variedades"
          message="Aún no se registraron variedades en el sistema."
          icon={ICONOS.variedades}
        />
      );
  } else {
    cuerpo =
      lotes.length === 0 ? (
        <EmptyState
          title="No hay lotes"
          message="Aún no se registraron lotes en el sistema."
          icon={ICONOS.lotes}
        />
      ) : lotesFiltrados.length === 0 ? (
        <EmptyState
          title="Sin resultados"
          message="Ningún lote coincide con la búsqueda."
          icon="magnify-close"
        />
      ) : (
        <View style={styles.list}>
          {lotesFiltrados.map(l =>
            renderFila(
              l.id,
              <>
                <Text style={styles.nombre}>{l.nombre}</Text>
                <Text style={styles.meta}>Fundo: {l.fundo}</Text>
                <Text style={styles.meta}>Variedad: {l.variedad}</Text>
                <Text style={styles.meta}>
                  Área: {l.area != null ? `${l.area} ha` : '—'}
                </Text>
              </>,
            ),
          )}
        </View>
      );
  }

  return (
    <View style={styles.tabContent}>
      {tipo === 'lotes' && !loading && !error && lotes.length > 0 ? (
        <AppInput
          label="Buscar"
          value={busqueda}
          onChangeText={setBusqueda}
          accessibilityLabel="Buscar lote"
        />
      ) : null}
      {cuerpo}
    </View>
  );
}

const styles = StyleSheet.create({
  tabContent: {
    gap: theme.spacing[4],
  },
  list: {
    gap: theme.spacing[3],
  },
  card: {
    gap: theme.spacing[1],
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing[3],
  },
  nombre: {
    fontFamily: theme.typography.subtitle2.fontFamily,
    fontSize: theme.typography.subtitle2.fontSize,
    lineHeight: theme.typography.subtitle2.lineHeight,
    color: theme.colors.text.primary,
  },
  meta: {
    fontFamily: theme.typography.body2.fontFamily,
    fontSize: theme.typography.body2.fontSize,
    color: theme.colors.text.secondary,
  },
});
