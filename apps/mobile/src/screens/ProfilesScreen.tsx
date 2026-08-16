import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { colors, radius, spacing, typography } from "../theme/theme";
import { strings } from "../i18n/de";
import { useBackend } from "../store/backend-context";
import type { User } from "@lablens/core";
import { Button, Panel, SectionTitle } from "../components/ui";

export function ProfilesScreen() {
  const { backend, activeUser, setActiveUser, refresh } = useBackend();
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState("");

  const reload = async () => {
    setUsers(await backend.users.list());
  };

  useEffect(() => {
    reload();
  }, [backend, activeUser, refresh]);

  const addProfile = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert(strings.profiles.title, "Bitte einen Namen eingeben.");
      return;
    }
    const user = await backend.users.create({ name: trimmed });
    setName("");
    await reload();
    setActiveUser(user.id);
  };

  const rename = async (id: string, newName: string) => {
    await backend.users.update(id, { name: newName });
    await reload();
    refresh();
  };

  const remove = (id: string) => {
    if (users.length === 1) {
      Alert.alert(strings.profiles.title, strings.profiles.lastProfile);
      return;
    }
    Alert.alert(strings.profiles.title, strings.profiles.confirmDelete, [
      { text: "Abbrechen", style: "cancel" },
      {
        text: strings.profiles.delete,
        style: "destructive",
        onPress: async () => {
          await backend.users.delete(id);
          await reload();
          if (activeUser?.id === id) {
            const remaining = await backend.users.list();
            if (remaining[0]) setActiveUser(remaining[0].id);
          }
          refresh();
        }
      }
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Panel>
        <Text style={styles.panelTitle}>{strings.profiles.newProfile}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={strings.profiles.name}
          placeholderTextColor={colors.textFaint}
        />
        <Button title={strings.profiles.add} onPress={addProfile} style={styles.addBtn} />
      </Panel>

      <SectionTitle>{strings.profiles.title}</SectionTitle>
      {users.map((user) => {
        const isActive = user.id === activeUser?.id;
        return (
          <View key={user.id} style={[styles.row, isActive && styles.rowActive]}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user.name?.[0] ?? "?").toUpperCase()}
              </Text>
            </View>
            <TextInput
              style={styles.nameInput}
              value={user.name ?? ""}
              onChangeText={(v) => rename(user.id, v)}
            />
            <Button
              title={isActive ? strings.profiles.active : strings.profiles.select}
              variant="secondary"
              onPress={() => setActiveUser(user.id)}
            />
            {users.length > 1 && (
              <Button
                title={strings.profiles.delete}
                variant="danger"
                onPress={() => remove(user.id)}
              />
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  panelTitle: {
    ...(typography.subheading as object),
    color: colors.text,
    marginBottom: spacing.sm
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: 15,
    color: colors.text
  },
  addBtn: { marginTop: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.sm,
    marginBottom: spacing.sm
  },
  rowActive: { borderColor: colors.primary },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: { color: "#FFFFFF", fontWeight: "700" },
  nameInput: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: 15,
    color: colors.text
  }
});
