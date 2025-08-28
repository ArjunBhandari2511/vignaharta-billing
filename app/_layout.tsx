import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Colors } from "../constants/Colors";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" backgroundColor={Colors.background} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="edit-invoice" />
        <Stack.Screen name="edit-purchase" />
        <Stack.Screen name="edit-payin" />
        <Stack.Screen name="edit-payout" />
        <Stack.Screen name="company-details" />
      </Stack>
    </>
  );
}
