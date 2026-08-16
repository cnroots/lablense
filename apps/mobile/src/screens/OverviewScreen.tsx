import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { colors, radius, spacing, typography } from "../theme/theme";
import { strings } from "../i18n/de";
import { useBackend } from "../store/backend-context";
import { useAppData } from "../hooks/useAppData";
import type { AnalyteSummary } from "../hooks/useAppData";
import { PeriodSelector } from "../components/PeriodSelector";
import { TrendChart } from "../components/TrendChart";
import type { ChartPoint } from "../components/TrendChart";
import { Button, MetaText, StatusBadge } from "../components/ui";
import { formatNumber, isWithinPeriod, todayIso } from "../utils/date";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

function latestDate(summaries: Map<string, AnalyteSummary>): Date {
  let max = todayIso();
  for (const s of summaries.values()) {
    const last = s.observations[s.observations.length - 1];
    if (last && last.measuredAt > max) max = last.measuredAt;
  }
  return new Date(max + "T12:00:00");
}

function pointsFor(summary: AnalyteSummary, period: string, latest: Date): ChartPoint[] {
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

export function OverviewScreen() {
  const navigation = useNavigation<Nav>();
  const { settings, setSettings } = useBackend();
  const data = useAppData();

  const latest = useMemo(
    () => (data ? latestDate(data.summaries) : new Date()),
    [data]
  );

  const cards = useMemo(() => {
    if (!data) return [];
    const byKey = new Map(
      [...data.summaries.values()].map((s) => [s.analyte.key, s])
    );
    return settings.dashboardAnalytes
      .map((key) => byKey.get(key))
      .filter((s): s is AnalyteSummary => !!s)
      .slice(0, 6);
  }, [data, settings.dashboardAnalytes]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <PeriodSelector
        value={settings.period}
        onChange={(period) => setSettings({ period })}
      />
      <MetaText>
        {settings.period === "Alle"
          ? "Gesamter Zeitraum"
          : `${settings.period} rückwärts ab ${latest.toLocaleDateString("de-DE")}`}
      </MetaText>

      {cards.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Wähle Laborwerte für die Startseite aus.
          </Text>
          <Button
            title={strings.menu.configureHome}
            onPress={() => navigation.navigate("Config")}
            style={styles.emptyButton}
          />
        </View>
      ) : (
        cards.map((summary) => (
          <OverviewCard
            key={summary.analyte.id}
            summary={summary}
            points={pointsFor(summary, settings.period, latest)}
            onPress={() =>
              navigation.navigate("Detail", {
                analyteId: summary.analyte.id
              })
            }
          />
        ))
      )}
    </ScrollView>
  );
}

function OverviewCard({
  summary,
  points,
  onPress
}: {
  summary: AnalyteSummary;
  points: ChartPoint[];
  onPress: () => void;
}) {
  const { settings } = useBackend();
  const latestValue = summary.latest?.valueNumeric;
  const outside = summary.status === "low" || summary.status === "high";
  const mean =
    points.length > 0
      ? points.reduce((a, b) => a + b.value, 0) / points.length
      : undefined;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle} onPress={onPress}>
        {summary.analyte.displayName}{" "}
        {settings.showRefs && summary.refMin !== undefined && (
          <Text style={styles.refText}>
            (
            {summary.refMax !== undefined
              ? `${formatNumber(summary.refMin)}–${formatNumber(summary.refMax)}`
              : `≥ ${formatNumber(summary.refMin)}`}
            )
          </Text>
        )}
      </Text>
      <View style={styles.cardValueRow}>
        <Text style={styles.cardValue}>{formatNumber(latestValue)}</Text>
        <Text style={styles.cardUnit}>{summary.unitDisplay ?? ""}</Text>
      </View>
      {mean !== undefined && (
        <MetaText>
          Ø {formatNumber(mean)} {summary.unitDisplay ?? ""}
        </MetaText>
      )}
      {outside && settings.highlightOutside && (
        <StatusBadge text={strings.overview.outsideReference} />
      )}
      {points.length > 0 && (
        <View style={styles.chartWrap}>
          <TrendChart
            points={points}
            width={280}
            height={82}
            refMin={summary.refMin}
            refMax={summary.refMax}
            showRefs={settings.showRefs}
            showMean
            highlightOutside={settings.highlightOutside}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  card: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.divider
  },
  cardTitle: {
    ...(typography.subheading as object),
    color: colors.text
  },
  refText: {
    fontSize: 13,
    color: colors.textFaint,
    fontWeight: "400"
  },
  cardValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 4
  },
  cardValue: {
    ...(typography.value as object),
    color: colors.text
  },
  cardUnit: {
    fontSize: 14,
    color: colors.textMuted,
    marginLeft: 6
  },
  chartWrap: { marginTop: spacing.sm, alignItems: "center" },
  empty: {
    alignItems: "center",
    paddingVertical: spacing.xxl
  },
  emptyText: {
    fontSize: 15,
    color: colors.textMuted,
    marginBottom: spacing.md,
    textAlign: "center"
  },
  emptyButton: { marginTop: spacing.sm }
});
