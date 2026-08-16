import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../theme/theme";
import { strings } from "../i18n/de";
import { useBackend } from "../store/backend-context";
import { useAppData } from "../hooks/useAppData";
import { MetaText, Panel } from "../components/ui";
import { formatYear } from "../utils/date";

export function ManageScreen() {
  const { activeUser } = useBackend();
  const data = useAppData();

  const years = useMemo(() => {
    const counts = new Map<string, number>();
    for (const summary of data?.summaries.values() ?? []) {
      for (const obs of summary.observations) {
        const y = formatYear(obs.measuredAt);
        counts.set(y, (counts.get(y) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [data]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <MetaText>
        {strings.manage.dataFor}: {activeUser?.name ?? ""}
      </MetaText>
      <Panel>
        <Text style={styles.panelTitle}>{strings.manage.localStorage}</Text>
        <MetaText>{strings.manage.localStorageHint}</MetaText>
      </Panel>

      {years.length === 0 ? (
        <Panel>
          <MetaText>{strings.manage.noValues}</MetaText>
        </Panel>
      ) : (
        years.map(([year, count]) => (
          <Panel key={year}>
            <View style={styles.yearRow}>
              <Text style={styles.year}>{year}</Text>
              <MetaText>
                {strings.manage.measurementCount.replace("{count}", String(count))}
              </MetaText>
            </View>
          </Panel>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  panelTitle: {
    ...(typography.subheading as object),
    color: colors.text,
    marginBottom: 4
  },
  yearRow: { flexDirection: "row", justifyContent: "space-between" },
  year: { fontSize: 17, fontWeight: "700", color: colors.text }
});
