import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { colors, radius, spacing, typography } from "../theme/theme";
import { strings } from "../i18n/de";
import { useBackend } from "../store/backend-context";
import { useAppData } from "../hooks/useAppData";
import { Button } from "../components/ui";

const MAX_SELECTED = 6;

export function ConfigScreen() {
  const navigation = useNavigation();
  const { settings, setSettings } = useBackend();
  const data = useAppData();
  const [selected, setSelected] = useState<string[]>(settings.dashboardAnalytes);

  const analytes = useMemo(
    () =>
      (data?.analytes ?? []).slice().sort((a, b) =>
        a.displayName.localeCompare(b.displayName, "de")
      ),
    [data]
  );

  const toggle = (key: string) => {
    setSelected((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= MAX_SELECTED) return prev;
      return [...prev, key];
    });
  };

  const full = selected.length >= MAX_SELECTED;

  const apply = () => {
    setSettings({ dashboardAnalytes: selected });
    navigation.goBack();
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.status}>
          {full
            ? strings.config.limit.replace("{count}", String(selected.length))
            : strings.config.status.replace("{count}", String(selected.length))}
        </Text>

        {analytes.map((analyte) => {
          const checked = selected.includes(analyte.key);
          const disabled = full && !checked;
          return (
            <TouchableOpacity
              key={analyte.id}
              style={[styles.item, disabled && styles.itemLocked]}
              onPress={() => toggle(analyte.key)}
              disabled={disabled}
            >
              <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                {checked ? <Text style={styles.checkmark}>✓</Text> : null}
              </View>
              <Text style={styles.itemTitle}>{analyte.displayName}</Text>
              <Text style={styles.itemGroup}>
                ({analyte.group?.name ?? "Sonstige"})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Button title={strings.config.apply} onPress={apply} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  status: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.md
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.md,
    marginBottom: spacing.sm
  },
  itemLocked: { opacity: 0.45 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { color: "#FFFFFF", fontWeight: "700" },
  itemTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: colors.text
  },
  itemGroup: { fontSize: 12, color: colors.textFaint },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.background
  }
});
