import React from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
  TextStyle
} from "react-native";
import { colors, radius, spacing, typography } from "../theme/theme";

export function Panel({
  children,
  style
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

type ButtonVariant = "primary" | "secondary" | "danger";

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled,
  style
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const palette: Record<ButtonVariant, { bg: string; fg: string }> = {
    primary: { bg: colors.primary, fg: colors.primaryText },
    secondary: { bg: "#FFFFFF", fg: colors.text },
    danger: { bg: "#FFFFFF", fg: colors.danger }
  };
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        { backgroundColor: palette[variant].bg },
        variant !== "primary" && styles.buttonBordered,
        disabled && styles.buttonDisabled,
        style
      ]}
    >
      <Text style={[styles.buttonText, { color: palette[variant].fg }]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

export function Pill({
  label,
  active,
  onPress
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.pill, active && styles.pillActive]}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function StatusBadge({ text }: { text: string }) {
  return (
    <View style={styles.badge}>
      <View style={styles.badgeDot} />
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  style
}: {
  label?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "decimal-pad";
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.fieldWrap, style]}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        style={styles.field}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        keyboardType={keyboardType}
      />
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function MetaText({ children }: { children: React.ReactNode }) {
  return <Text style={styles.meta}>{children}</Text>;
}

export const uiStyles = StyleSheet.create({
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  } as ViewStyle
});

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.divider
  },
  button: {
    borderRadius: radius.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center"
  },
  buttonBordered: {
    borderWidth: 1,
    borderColor: colors.border
  },
  buttonDisabled: {
    opacity: 0.5
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "600"
  },
  pill: {
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginRight: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF"
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  pillText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600"
  },
  pillTextActive: {
    color: colors.primaryText
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 2
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.orange,
    marginRight: 4
  },
  badgeText: {
    color: colors.orange,
    fontSize: 12,
    fontWeight: "600"
  },
  fieldWrap: {
    marginBottom: spacing.sm
  },
  fieldLabel: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 3
  },
  field: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: 15,
    color: colors.text
  },
  sectionTitle: {
    ...(typography.heading as TextStyle),
    color: colors.text,
    marginBottom: spacing.sm
  },
  meta: {
    fontSize: 13,
    color: colors.textMuted
  }
});
