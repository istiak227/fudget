import AsyncStorage from "@react-native-async-storage/async-storage";

import { AppData } from "../types";

const STORAGE_KEY = "fudget-phone-data-v1";
export const DEFAULT_GROUP = "Other";
export const EXAMPLE_GROUPS = [
  "Salary",
  "Transport",
  "Foods",
  "Family",
  "Bills",
  "Convenience",
  "Shopping",
  "Education",
  "Personal",
  "Entertainment",
];

export const emptyData: AppData = {
  months: {},
  savings: [],
  loans: [],
  lending: [],
  groups: EXAMPLE_GROUPS,
  language: "en",
  updatedAt: new Date().toISOString(),
};

export async function loadAppData() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return emptyData;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppData>;

    return {
      ...emptyData,
      ...parsed,
      groups:
        parsed.groups && parsed.groups.length > 0 ? parsed.groups : EXAMPLE_GROUPS,
    } as AppData;
  } catch {
    return emptyData;
  }
}

export async function saveAppData(data: AppData) {
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...data,
      updatedAt: new Date().toISOString(),
    }),
  );
}
