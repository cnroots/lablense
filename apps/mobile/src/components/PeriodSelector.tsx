import React from "react";
import { StyleSheet, View } from "react-native";
import { strings } from "../i18n/de";
import type { Period } from "../utils/date";
import { Pill } from "./ui";

export function PeriodSelector({
  value,
  onChange
}: {
  value: Period;
  onChange: (period: Period) => void;
}) {
  return (
    <View style={styles.row}>
      {strings.periods.map((p) => (
        <Pill
          key={p}
          label={p}
          active={value === p}
          onPress={() => onChange(p)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingVertical: 8
  }
});
