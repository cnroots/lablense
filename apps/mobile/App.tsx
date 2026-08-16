import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { BackendProvider, useBackend } from "./src/store/backend-context";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { colors } from "./src/theme/theme";

function AppBody() {
  const { ready, error } = useBackend();

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Startfehler</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <Text style={styles.loading}>Wird vorbereitet …</Text>
      </View>
    );
  }

  return <RootNavigator />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <BackendProvider>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
          <AppBody />
        </SafeAreaView>
      </BackendProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24
  },
  loading: { fontSize: 16, color: colors.textMuted },
  errorTitle: { fontSize: 18, fontWeight: "700", color: colors.danger },
  errorText: { fontSize: 14, color: colors.textMuted, textAlign: "center" }
});
