import React from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../theme/theme";
import { strings } from "../i18n/de";
import { useBackend } from "../store/backend-context";
import { Panel } from "../components/ui";

export function SettingsScreen() {
  const { settings, setSettings } = useBackend();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Panel>
        <SettingRow
          title={strings.settings.showRefs}
          hint={strings.settings.showRefsHint}
          value={settings.showRefs}
          onChange={(v) => setSettings({ showRefs: v })}
        />
        <SettingRow
          title={strings.settings.highlightOutside}
          hint={strings.settings.highlightOutsideHint}
          value={settings.highlightOutside}
          onChange={(v) => setSettings({ highlightOutside: v })}
        />
        <SettingRow
          title={strings.settings.largeText}
          hint={strings.settings.largeTextHint}
          value={settings.largeText}
          onChange={(v) => setSettings({ largeText: v })}
        />
      </Panel>

      <Text style={styles.privacyTitle}>{strings.settings.privacyTitle}</Text>
      <PrivacyRow title={strings.settings.offline} hint={strings.settings.offlineHint} />
      <PrivacyRow title={strings.settings.local} hint={strings.settings.localHint} />
      <PrivacyRow title={strings.settings.noArchive} hint={strings.settings.noArchiveHint} />
    </ScrollView>
  );
}

function SettingRow({
  title,
  hint,
  value,
  onChange
}: {
  title: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingText}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingHint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.primary }}
      />
    </View>
  );
}

function PrivacyRow({ title, hint }: { title: string; hint: string }) {
  return (
    <View style={styles.privacyRow}>
      <Text style={styles.check}>✓</Text>
      <View style={styles.settingText}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingHint}>{hint}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider
  },
  settingText: { flex: 1, marginRight: spacing.sm },
  settingTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  settingHint: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  privacyTitle: {
    ...(typography.subheading as object),
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm
  },
  privacyRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.md,
    marginBottom: spacing.sm
  },
  check: {
    color: colors.ok,
    fontSize: 18,
    fontWeight: "700",
    marginRight: spacing.sm
  }
});
