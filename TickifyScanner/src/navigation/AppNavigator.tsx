import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import SyncKeyScreen from '../screens/SyncKeyScreen';
import ScannerScreen from '../screens/ScannerScreen';

export type RootStackParamList = {
  Login: undefined;
  SyncKey: undefined;
  Scanner: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="SyncKey" component={SyncKeyScreen} options={{ title: 'Đồng bộ Dữ liệu' }} />
        <Stack.Screen name="Scanner" component={ScannerScreen} options={{ title: 'Quét Vé Dề Dê', headerBackVisible: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}