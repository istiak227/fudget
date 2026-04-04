import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { AppData } from "../types";
import { DEFAULT_GROUP, EXAMPLE_GROUPS, emptyData } from "../utils/storage";

const BACKUP_VERSION = 1;
const BACKUP_FILE_PREFIX = "fudget-backup-";

type BackupEnvelope = {
  backupVersion: number;
  backedUpAt: string;
  data: AppData;
};

function backupFileName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${BACKUP_FILE_PREFIX}${stamp}.json`;
}

function collectGroupsFromData(data: AppData) {
  const groups = new Set<string>([DEFAULT_GROUP, ...EXAMPLE_GROUPS, ...(data.groups ?? [])]);

  Object.values(data.months).forEach((month) => {
    [...month.credits, ...month.debits].forEach((entry) => {
      groups.add(entry.group?.trim() || DEFAULT_GROUP);
    });
  });

  return [...groups].filter((group) => group !== DEFAULT_GROUP);
}

export function normalizeImportedData(data: AppData) {
  return {
    ...emptyData,
    ...data,
    months: data?.months ?? {},
    savings: data?.savings ?? [],
    loans: data?.loans ?? [],
    lending: data?.lending ?? [],
    groups: collectGroupsFromData({
      ...emptyData,
      ...data,
      months: data?.months ?? {},
      savings: data?.savings ?? [],
      loans: data?.loans ?? [],
      lending: data?.lending ?? [],
      groups: data?.groups ?? [],
      updatedAt: data?.updatedAt ?? new Date().toISOString(),
    }),
    updatedAt: data?.updatedAt ?? new Date().toISOString(),
  } satisfies AppData;
}

export function createBackupPayload(data: AppData) {
  const normalized = normalizeImportedData(data);

  return JSON.stringify(
    {
      backupVersion: BACKUP_VERSION,
      backedUpAt: new Date().toISOString(),
      data: normalized,
    } satisfies BackupEnvelope,
    null,
    2,
  );
}

export function parseBackupPayload(raw: string) {
  const parsed = JSON.parse(raw) as Partial<BackupEnvelope> | Partial<AppData>;
  const data = "data" in parsed && parsed.data ? parsed.data : parsed;
  return normalizeImportedData(data as AppData);
}

export async function shareBackupFile(data: AppData) {
  const payload = createBackupPayload(data);
  const directory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;

  if (!directory) {
    throw new Error("No writable directory available.");
  }

  const uri = `${directory}${backupFileName()}`;
  await FileSystem.writeAsStringAsync(uri, payload, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing is not available on this device.");
  }

  await Sharing.shareAsync(uri, {
    mimeType: "application/json",
    dialogTitle: "Save Fudget backup",
    UTI: "public.json",
  });

  return uri;
}

export async function pickBackupFile() {
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/json",
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  const raw = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return {
    fileName: asset.name,
    data: parseBackupPayload(raw),
  };
}
