import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as XLSX from "xlsx";

import { AppData } from "../types";
import { formatMonthLabel } from "./date";

export async function exportWorkbook(data: AppData) {
  const workbook = XLSX.utils.book_new();

  const monthRows = Object.values(data.months).flatMap((month) => {
    const monthLabel = formatMonthLabel(month.monthKey);

    return [
      ...month.debits.map((entry) => ({
        month: monthLabel,
        type: "Debit / Income",
        group: entry.group ?? "Other",
        name: entry.name,
        amount: entry.amount,
        date: entry.date ?? "",
      })),
      ...month.credits.map((entry) => ({
        month: monthLabel,
        type: "Credit / Expense",
        group: entry.group ?? "Other",
        name: entry.name,
        amount: entry.amount,
        date: entry.date ?? "",
      })),
    ];
  });

  const savingsRows = data.savings.flatMap((account) => [
    ...account.credits.map((entry) => ({
      account: account.name,
      type: "Credit / Add",
      name: entry.name,
      amount: entry.amount,
      date: entry.date ?? "",
    })),
    ...account.debits.map((entry) => ({
      account: account.name,
      type: "Debit / Withdraw",
      name: entry.name,
      amount: entry.amount,
      date: entry.date ?? "",
    })),
  ]);

  const loanRows = data.loans.flatMap((item) => [
    ...item.borrowed.map((entry) => ({
      person: item.person,
      type: "Taken",
      name: entry.name,
      amount: entry.amount,
      date: entry.date ?? "",
    })),
    ...item.repaid.map((entry) => ({
      person: item.person,
      type: "Repaid",
      name: entry.name,
      amount: entry.amount,
      date: entry.date ?? "",
    })),
  ]);

  const lendingRows = data.lending.flatMap((item) => [
    ...item.borrowed.map((entry) => ({
      person: item.person,
      type: "Lent",
      name: entry.name,
      amount: entry.amount,
      date: entry.date ?? "",
    })),
    ...item.repaid.map((entry) => ({
      person: item.person,
      type: "Received Back",
      name: entry.name,
      amount: entry.amount,
      date: entry.date ?? "",
    })),
  ]);

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(monthRows),
    "Monthly",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(savingsRows),
    "Savings",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(loanRows),
    "Loans",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(lendingRows),
    "Lending",
  );

  const base64 = XLSX.write(workbook, {
    type: "base64",
    bookType: "xlsx",
  });

  const directory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!directory) {
    throw new Error("No writable directory available.");
  }

  const uri = `${directory}fudget-export.xlsx`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      dialogTitle: "Export Fudget data",
      UTI: "org.openxmlformats.spreadsheetml.sheet",
    });
  }

  return uri;
}
