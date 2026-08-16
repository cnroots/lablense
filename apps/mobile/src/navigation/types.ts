import type { NavigatorScreenParams } from "@react-navigation/native";

export type MainTabParamList = {
  Overview: undefined;
  AllValues: undefined;
  Import: undefined;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList>;
  Menu: undefined;
  Detail: { analyteId: string };
  Config: undefined;
  Profiles: undefined;
  Settings: undefined;
  Manage: undefined;
  References: undefined;
};

export type RootScreen = keyof RootStackParamList;
