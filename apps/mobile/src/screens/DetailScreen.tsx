import React, { useMemo, useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { colors, radius, spacing, typography } from "../theme/theme";
import { strings } from "../i18n/de";
import { useBackend } from "../store/backend-context";
import { useAppData } from "../hooks/useAppData";
import type { AnalyteSummary } from "../hooks/useAppData";
import { PeriodSelector } from "../components/PeriodSelector";
import { TrendChart } from "../components/TrendChart";
import type { ChartPoint } from "../components/TrendChart";
import { Button, Field, MetaText, Panel, SectionTitle, StatusBadge } from "../components/ui";
import { formatDate, formatNumber, isWithinPeriod, todayIso } from "../utils/date";
import type { RootStackParamList } from "../navigation/types";
import type { Observation } from "@lablens/core";

type Route = RouteProp<RootStackParamList, "Detail">;

export function DetailScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation();
  const { backend, activeUser, refresh, settings, setSettings } = useBackend();
  const data = useAppData();
  const [editing, setEditing] = useState<Observation | null>(null);

  const summary = useMemo(
    () => data?.summaries.get(route.params.analyteId),
    [data, route.params.analyteId]
  );

  if (!summary) {
    return (
      <ScrollView style={styles.screen}>
        <MetaText>Keine Daten.</MetaText>
      </ScrollView>
    );
  }

  const latest = latestDateFor(summary);
  const points = pointsFor(summary, settings.period, latest);
  const refText = referenceText(summary);

  const saveEdit = async (date: string, valueText: string) => {
    if (!editing || !activeUser) return;
    const v = Number(valueText.replace(",", "."));
    if (!Number.isFinite(v)) {
      Alert.alert("Bitte einen gültigen Wert eingeben.");
      return;
    }
    await backend.observations.update(activeUser.id, editing.id, {
      valueNumeric: v,
      measuredAt: date,
      unitId: editing.unitId
    });
    setEditing(null);
    refresh();
  };

  const deleteEdit = async () => {
    if (!editing || !activeUser) return;
    Alert.alert("Löschen", strings.edit.confirmDelete, [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Löschen",
        style: "destructive",
        onPress: async () => {
          await backend.observations.delete(activeUser.id, editing.id);
          setEditing(null);
          refresh();
        }
      }
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Button
          title={strings.detail.back}
          variant="secondary"
          onPress={() => navigation.goBack()}
        />
      </View>

      <Panel>
        <MetaText>
          Referenz {refText} · {summary.unitDisplay ?? ""}
        </MetaText>
        <View style={styles.infoHead}>
          <Text style={styles.groupChip}>
            {summary.analyte.group?.name ?? ""}
          </Text>
          <Text style={styles.infoTitle}>{strings.detail.explained}</Text>
        </View>
        <Text style={styles.infoText}>
          {summary.analyte.description ??
            `Laborwert aus der Gruppe ${summary.analyte.group?.name ?? ""}.`}
        </Text>
        {(summary.status === "low" || summary.status === "high") &&
          settings.highlightOutside && (
            <View style={styles.statusBox}>
              <Text style={styles.statusBoxText}>
                {strings.detail.outside} Die Einordnung hängt auch von Labor,
                Messmethode und persönlicher Situation ab.
              </Text>
            </View>
          )}
        <View style={styles.stats}>
          <Stat
            label={strings.detail.current}
            value={formatNumber(summary.latest?.valueNumeric)}
          />
          <Stat
            label={strings.detail.periodAverage}
            value={
              points.length
                ? formatNumber(
                    points.reduce((a, b) => a + b.value, 0) / points.length
                  )
                : "—"
            }
          />
          <Stat
            label={strings.detail.measurements}
            value={String(summary.observations.length)}
          />
        </View>
      </Panel>

      <PeriodSelector
        value={settings.period}
        onChange={(period) => setSettings({ period })}
      />

      <Panel style={styles.chartPanel}>
        {points.length > 0 ? (
          <TrendChart
            points={points}
            width={300}
            height={160}
            refMin={summary.refMin}
            refMax={summary.refMax}
            showRefs={settings.showRefs}
            showMean
            highlightOutside={settings.highlightOutside}
          />
        ) : (
          <MetaText>{strings.overview.noValues}</MetaText>
        )}
      </Panel>

      <SectionTitle>{strings.detail.individual}</SectionTitle>
      {points.length === 0 ? (
        <MetaText>{strings.overview.noValues}</MetaText>
      ) : (
        [...points]
          .reverse()
          .map((p) => (
            <MeasurementRow
              key={p.measuredAt + String(p.value)}
              measuredAt={p.measuredAt}
              value={p.value}
              unit={summary.unitDisplay ?? ""}
              outside={!!p.outside}
              onEdit={() => {
                const obs = summary.observations.find(
                  (o) => o.measuredAt === p.measuredAt
                );
                if (obs) setEditing(obs);
              }}
            />
          ))
      )}

      <EditModal
        observation={editing}
        summary={summary}
        onCancel={() => setEditing(null)}
        onSave={saveEdit}
        onDelete={deleteEdit}
      />
    </ScrollView>
  );
}

function latestDateFor(summary: AnalyteSummary): Date {
  let max = todayIso();
  const last = summary.observations[summary.observations.length - 1];
  if (last && last.measuredAt > max) max = last.measuredAt;
  return new Date(max + "T12:00:00");
}

function pointsFor(
  summary: AnalyteSummary,
  period: string,
  latest: Date
): ChartPoint[] {
  return summary.observations
    .filter((o) => isWithinPeriod(o.measuredAt, period as never, latest))
    .map((o) => ({
      value: o.valueNumeric ?? 0,
      measuredAt: o.measuredAt,
      outside:
        o.valueNumeric !== undefined &&
        ((summary.refMin !== undefined && o.valueNumeric < summary.refMin) ||
          (summary.refMax !== undefined && o.valueNumeric > summary.refMax))
    }));
}

function referenceText(summary: AnalyteSummary): string {
  if (summary.refMin === undefined && summary.refMax === undefined) {
    return strings.detail.noGeneralRange;
  }
  if (summary.refMin !== undefined && summary.refMax !== undefined) {
    return `${formatNumber(summary.refMin)}–${formatNumber(summary.refMax)}`;
  }
  if (summary.refMin !== undefined) return `≥ ${formatNumber(summary.refMin)}`;
  return `< ${formatNumber(summary.refMax)}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function MeasurementRow({
  measuredAt,
  value,
  unit,
  outside,
  onEdit
}: {
  measuredAt: string;
  value: number;
  unit: string;
  outside: boolean;
  onEdit: () => void;
}) {
  const { settings } = useBackend();
  return (
    <View style={styles.measurement}>
      <View style={styles.measurementMain}>
        <View>
          <Text style={styles.measurementDate}>{formatDate(measuredAt)}</Text>
        </View>
        <View style={styles.measurementRight}>
          <Text style={styles.measurementValue}>
            {formatNumber(value)} {unit}
          </Text>
          {outside && settings.highlightOutside && (
            <StatusBadge text="außerhalb" />
          )}
        </View>
        <Button title="✎" variant="secondary" onPress={onEdit} />
      </View>
    </View>
  );
}

function EditModal({
  observation,
  summary,
  onCancel,
  onSave,
  onDelete
}: {
  observation: Observation | null;
  summary: AnalyteSummary;
  onCancel: () => void;
  onSave: (date: string, value: string) => void;
  onDelete: () => void;
}) {
  const [date, setDate] = useState(observation?.measuredAt.slice(0, 10) ?? "");
  const [value, setValue] = useState(
    observation?.valueNumeric !== undefined
      ? String(observation.valueNumeric).replace(".", ",")
      : ""
  );

  React.useEffect(() => {
    if (observation) {
      setDate(observation.measuredAt.slice(0, 10));
      setValue(
        observation.valueNumeric !== undefined
          ? String(observation.valueNumeric).replace(".", ",")
          : observation.valueText ?? ""
      );
    }
  }, [observation]);

  return (
    <Modal visible={!!observation} transparent animationType="slide">
      <View style={styles.modalShade}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>{strings.edit.title}</Text>
          <MetaText>{summary.analyte.displayName}</MetaText>
          <Field
            label={strings.edit.date}
            value={date}
            onChangeText={setDate}
            placeholder="JJJJ-MM-TT"
          />
          <Field
            label={strings.edit.originalValue}
            value={value}
            onChangeText={setValue}
            keyboardType="decimal-pad"
          />
          <MetaText>
            {strings.edit.unit}: {summary.unitDisplay ?? ""}
          </MetaText>
          <View style={styles.modalActions}>
            <Button
              title={strings.edit.delete}
              variant="danger"
              onPress={onDelete}
            />
            <Button
              title={strings.edit.cancel}
              variant="secondary"
              onPress={onCancel}
            />
            <Button title={strings.edit.save} onPress={() => onSave(date, value)} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  headerRow: { marginBottom: spacing.md },
  infoHead: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm },
  groupChip: {
    backgroundColor: colors.reference,
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginRight: spacing.sm
  },
  infoTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  infoText: { fontSize: 14, color: colors.textMuted, marginTop: 4, lineHeight: 20 },
  statusBox: {
    backgroundColor: "#FBEFEC",
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm
  },
  statusBoxText: { fontSize: 13, color: colors.danger },
  stats: {
    flexDirection: "row",
    marginTop: spacing.md,
    justifyContent: "space-between"
  },
  stat: { alignItems: "center", flex: 1 },
  statLabel: { fontSize: 12, color: colors.textMuted },
  statValue: { fontSize: 20, fontWeight: "700", color: colors.text, marginTop: 2 },
  chartPanel: { alignItems: "center", marginTop: spacing.sm },
  measurement: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.sm,
    marginBottom: spacing.sm
  },
  measurementMain: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  measurementDate: { fontSize: 14, fontWeight: "600", color: colors.text },
  measurementRight: { alignItems: "flex-end", flex: 1, marginHorizontal: spacing.sm },
  measurementValue: { fontSize: 15, fontWeight: "700", color: colors.text },
  modalShade: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end"
  },
  modal: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl
  },
  modalTitle: { ...(typography.heading as object), color: colors.text },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginTop: spacing.md
  }
});
