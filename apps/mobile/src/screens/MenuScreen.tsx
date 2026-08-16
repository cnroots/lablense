import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { colors, radius, spacing } from "../theme/theme";
import { strings } from "../i18n/de";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type MenuScreenName = "Config" | "Manage" | "References" | "Settings" | "Profiles";

interface MenuItem {
  label: string;
  screen: MenuScreenName;
  icon: string;
}

const items: MenuItem[] = [
  { label: strings.menu.configureHome, screen: "Config", icon: "⚙" },
  { label: strings.menu.manageData, screen: "Manage", icon: "◫" },
  { label: strings.menu.references, screen: "References", icon: "▣" },
  { label: strings.menu.settings, screen: "Settings", icon: "⚙" },
  { label: strings.profiles.title, screen: "Profiles", icon: "👤" }
];

export function MenuScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {items.map((item) => (
        <TouchableOpacity
          key={item.screen}
          style={styles.item}
          onPress={() => navigation.navigate(item.screen)}
        >
          <Text style={styles.icon}>{item.icon}</Text>
          <Text style={styles.label}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  item: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.lg,
    marginBottom: spacing.sm
  },
  icon: { fontSize: 18, marginRight: spacing.md },
  label: { fontSize: 16, fontWeight: "600", color: colors.text }
});
