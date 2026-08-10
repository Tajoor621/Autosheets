import React, { useEffect, useState } from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { COLORS } from '../theme';

import SplashScreen from '../screens/SplashScreen';
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import FleetScreen from '../screens/FleetScreen';
import ReportsScreen from '../screens/ReportsScreen';
import RentalScreen from '../screens/RentalScreen';
import ParkingScreen from '../screens/ParkingScreen';
import TaxiScreen from '../screens/TaxiScreen';
import ExpenseScreen from '../screens/ExpenseScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: COLORS.background,
    card: COLORS.surface,
    primary: COLORS.primary,
    text: COLORS.textPrimary,
    border: COLORS.border,
  },
};

function MainTabs({ route }) {
  const role = route?.params?.role || 'owner';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          height: 70,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Dashboard') {
            return <Ionicons name="grid" size={size} color={color} />;
          }
          if (route.name === 'Fleet') {
            return <Ionicons name="car-sport" size={size} color={color} />;
          }
          if (route.name === 'Reports') {
            return <Ionicons name="bar-chart" size={size} color={color} />;
          }
          return <Ionicons name="ellipsis-horizontal" size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} initialParams={{ role }} />
      <Tab.Screen name="Fleet" component={FleetScreen} />
      <Tab.Screen name="Reports" component={ReportsScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [isReady, setIsReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState('Splash');
  const [savedRole, setSavedRole] = useState('owner');

  useEffect(() => {
    (async () => {
      try {
        const loggedIn = await SecureStore.getItemAsync('autosheets_logged_in');
        const role = await SecureStore.getItemAsync('autosheets_role');
        if (loggedIn === 'true') {
          setInitialRoute('Main');
          if (role) setSavedRole(role);
        }
      } catch (e) {
        // SecureStore unavailable — fall back to Splash/Login flow
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  if (!isReady) return null;

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{ headerShown: false, animation: 'fade' }}
        initialRouteName={initialRoute}
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Main" component={MainTabs} initialParams={{ role: savedRole }} />
        <Stack.Screen name="Rental" component={RentalScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="Parking" component={ParkingScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="Taxi" component={TaxiScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="Expense" component={ExpenseScreen} options={{ animation: 'slide_from_right' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
