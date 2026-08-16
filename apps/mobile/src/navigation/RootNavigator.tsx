import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { colors } from "../theme/theme";
import { strings } from "../i18n/de";
import { useBackend } from "../store/backend-context";
import type { MainTabParamList, RootStackParamList } from "./types";
import { OverviewScreen } from "../screens/OverviewScreen";
import { AllValuesScreen } from "../screens/AllValuesScreen";
import { ImportScreen } from "../screens/ImportScreen";
import { DetailScreen } from "../screens/DetailScreen";
import { ConfigScreen } from "../screens/ConfigScreen";
import { ProfilesScreen } from "../screens/ProfilesScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { ManageScreen } from "../screens/ManageScreen";
import { ReferencesScreen } from "../screens/ReferencesScreen";
import { MenuScreen } from "../screens/MenuScreen";

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.background }
      }}
    >
      <Tab.Screen
        name="Overview"
        component={OverviewScreen}
        options={{ title: strings.nav.overview, tabBarIcon: () => <TabIcon glyph="⌂" /> }}
      />
      <Tab.Screen
        name="AllValues"
        component={AllValuesScreen}
        options={{ title: strings.nav.all, tabBarIcon: () => <TabIcon glyph="☷" /> }}
      />
      <Tab.Screen
        name="Import"
        component={ImportScreen}
        options={{ title: strings.nav.import, tabBarIcon: () => <TabIcon glyph="＋" /> }}
      />
    </Tab.Navigator>
  );
}

function TabIcon({ glyph }: { glyph: string }) {
  return <Text style={styles.tabIcon}>{glyph}</Text>;
}

function HeaderLeft() {
  return <HeaderGlyph glyph="☰" />;
}

function HeaderGlyph({ glyph }: { glyph: string }) {
  return <Text style={styles.headerGlyph}>{glyph}</Text>;
}

function ProfileButton({ onPress }: { onPress: () => void }) {
  const { activeUser } = useBackend();
  return (
    <Pressable onPress={onPress} style={styles.profileBtn}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {(activeUser?.name?.[0] ?? "?").toUpperCase()}
        </Text>
      </View>
      <Text style={styles.profileName} numberOfLines={1}>
        {activeUser?.name ?? ""}
      </Text>
      <Text style={styles.profileCaret}>⌄</Text>
    </Pressable>
  );
}

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: "700" },
          headerShadowVisible: false
        }}
      >
        <Stack.Screen
          name="Main"
          component={MainTabs}
          options={({ navigation }: { navigation: NativeStackNavigationProp<RootStackParamList> }) => ({
            headerLeft: () => (
              <Pressable onPress={() => navigation.navigate("Menu")} hitSlop={12}>
                <HeaderLeft />
              </Pressable>
            ),
            headerTitle: () => (
              <Pressable
                onPress={() => navigation.navigate("Main", { screen: "Overview" })}
              >
                <Text style={styles.appTitle}>{strings.appName}</Text>
              </Pressable>
            ),
            headerRight: () => (
              <ProfileButton onPress={() => navigation.navigate("Profiles")} />
            )
          })}
        />
        <Stack.Screen name="Menu" component={MenuScreen} options={{ title: strings.menu.title }} />
        <Stack.Screen name="Detail" component={DetailScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Config" component={ConfigScreen} options={{ title: strings.config.title }} />
        <Stack.Screen name="Profiles" component={ProfilesScreen} options={{ title: strings.profiles.title }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: strings.settings.title }} />
        <Stack.Screen name="Manage" component={ManageScreen} options={{ title: strings.manage.title }} />
        <Stack.Screen name="References" component={ReferencesScreen} options={{ title: strings.references.title }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabIcon: { fontSize: 20, color: colors.text },
  headerGlyph: { fontSize: 22, color: colors.text },
  appTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  profileBtn: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: 150
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  profileName: {
    marginLeft: 6,
    fontSize: 14,
    color: colors.text,
    flexShrink: 1
  },
  profileCaret: { marginLeft: 4, color: colors.textMuted }
});
