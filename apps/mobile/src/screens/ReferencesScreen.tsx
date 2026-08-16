import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../theme/theme";
import { strings } from "../i18n/de";
import { useAppData } from "../hooks/useAppData";
import type { AnalyteSummary } from "../hooks/useAppData";
import { MetaText, Panel } from "../components/ui";
import { formatNumber } from "../utils/date";

export function ReferencesScreen() {
  const data = useAppData();

  const analytes = (data?.analytes ?? [])
    .slice()
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "de"));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Panel>
        <Text style={styles.panelTitle}>{strings.references.catalogTitle}</Text>
        <MetaText>{strings.references.catalogHint}</MetaText>
      </Panel>

      {analytes.map((analyte) => {
        const summary = data?.summaries.get(analyte.id);
        return (
          <ReferenceRow key={analyte.id} summary={summary} />
        );
      })}
    </ScrollView>
  );
}

function ReferenceRow({ summary }: { summary: AnalyteSummary | undefined }) {
  if (!summary) return null;
  const { refMin, refMax, unitDisplay } = summary;
  const ref =
    refMin !== undefined && refMax !== undefined
      ? `${formatNumber(refMin)}–${formatNumber(refMax)}`
      : refMin !== undefined
        ? `≥ ${formatNumber(refMin)}`
        : refMax !== undefined
          ? `< ${formatNumber(refMax)}`
          : "—";

  return (
    <Panel style={styles.rowPanel}>
      <View style={styles.row}>
        <View style={styles.rowInfo}>
          <Text style={styles.rowTitle}>{summary.analyte.displayName}</Text>
          <MetaText>
            {summary.analyte.group?.name ?? "Sonstige"} ·{" "}
            {strings.references.source}: lokaler Katalog
          </MetaText>
        </View>
        <View style={styles.rowRight}>
          <Text style={styles.ref}>{ref}</Text>
          <MetaText>{unitDisplay ?? ""}</MetaText>
        </View>
      </View>
    </Panel>
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
  rowPanel: { padding: spacing.md },
  row: { flexDirection: "row", justifyContent: "space-between" },
  rowInfo: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  rowRight: { alignItems: "flex-end", marginLeft: spacing.sm },
  ref: { fontSize: 15, fontWeight: "700", color: colors.text }
});
