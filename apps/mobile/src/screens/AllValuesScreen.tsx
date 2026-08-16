import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
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
import { MetaText, StatusBadge } from "../components/ui";
import { formatNumber, isWithinPeriod, todayIso } from "../utils/date";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function AllValuesScreen() {
  const navigation = useNavigation<Nav>();
  const { settings, setSettings } = useBackend();
  const data = useAppData();
  const [query, setQuery] = useState("");

  const latest = useMemo(() => {
    let max = todayIso();
    for (const s of data?.summaries.values() ?? []) {
      const last = s.observations[s.observations.length - 1];
      if (last && last.measuredAt > max) max = last.measuredAt;
    }
    return new Date(max + "T12:00:00");
  }, [data]);

  const groups = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const summaries = [...data.summaries.values()].filter((s) => {
      const a = s.analyte;
      return (
        !q ||
        a.displayName.toLowerCase().includes(q) ||
        a.key.toLowerCase().includes(q) ||
        (a.group?.name.toLowerCase().includes(q) ?? false)
      );
    });

    const byGroup = new Map<string, AnalyteSummary[]>();
    for (const s of summaries) {
      const key = s.analyte.group?.name ?? "Sonstige";
      const list = byGroup.get(key) ?? [];
      list.push(s);
      byGroup.set(key, list);
    }
    return [...byGroup.entries()];
  }, [data, query]);

  return (
    <View style={styles.screen}>
      <View style={styles.fixed}>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder={strings.all.searchPlaceholder}
            placeholderTextColor={colors.textFaint}
          />
        </View>
        <PeriodSelector
          value={settings.period}
          onChange={(period) => setSettings({ period })}
        />
        <MetaText>
          {settings.period === "Alle"
            ? "Gesamter Zeitraum"
            : `${settings.period} rückwärts ab ${latest.toLocaleDateString("de-DE")}`}
        </MetaText>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {groups.length === 0 ? (
          <MetaText>{strings.all.noMatches}</MetaText>
        ) : (
          groups.map(([group, summaries]) => (
            <View key={group} style={styles.group}>
              <Text style={styles.groupTitle}>{group}</Text>
              {summaries.map((summary) => (
                <ValueRow
                  key={summary.analyte.id}
                  summary={summary}
                  points={pointsFor(summary, settings.period, latest)}
                  onPress={() =>
                    navigation.navigate("Detail", {
                      analyteId: summary.analyte.id
                    })
                  }
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
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

function ValueRow({
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

  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle}>{summary.analyte.displayName}</Text>
        {settings.showRefs &&
          summary.refMin !== undefined &&
          summary.refMax !== undefined && (
            <Text style={styles.rowRef}>
              {formatNumber(summary.refMin)}–{formatNumber(summary.refMax)}
            </Text>
          )}
      </View>
      <View style={styles.rowValue}>
        <Text style={styles.rowValueText}>{formatNumber(latestValue)}</Text>
        <Text style={styles.rowUnit}>{summary.unitDisplay ?? ""}</Text>
        {outside && settings.highlightOutside && (
          <StatusBadge text="außerhalb" />
        )}
      </View>
      {points.length > 0 && (
        <View style={styles.spark}>
          <TrendChart
            points={points}
            width={90}
            height={34}
            refMin={summary.refMin}
            refMax={summary.refMax}
            showRefs={false}
            highlightOutside={false}
          />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  fixed: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.background
  },
  searchRow: { marginTop: spacing.sm },
  search: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    fontSize: 15,
    color: colors.text
  },
  list: { padding: spacing.md, paddingTop: spacing.sm },
  group: { marginBottom: spacing.md },
  groupTitle: {
    ...(typography.heading as object),
    color: colors.text,
    marginBottom: spacing.sm
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.md,
    marginBottom: spacing.sm
  },
  rowInfo: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  rowRef: { fontSize: 12, color: colors.textFaint, marginTop: 1 },
  rowValue: { alignItems: "flex-end", marginLeft: spacing.sm },
  rowValueText: { fontSize: 17, fontWeight: "700", color: colors.text },
  rowUnit: { fontSize: 12, color: colors.textMuted },
  spark: { marginLeft: spacing.sm }
});
