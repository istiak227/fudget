import { MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  pickBackupFile,
  shareBackupFile,
} from "./src/services/backup";
import {
  AppData,
  AppLanguage,
  MonthlyEntry,
  PersonLedger,
  SavingsAccount,
} from "./src/types";
import {
  formatDateLabel,
  formatIsoDate,
  formatMonthLabel,
  getMonthKey,
  getMonthOptions,
  getTodayIso,
  offsetMonth,
  parseIsoDate,
} from "./src/utils/date";
import { formatCurrency, sumAmounts, toAmount } from "./src/utils/format";
import {
  DEFAULT_GROUP,
  emptyData,
  loadAppData,
  saveAppData,
} from "./src/utils/storage";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
type TabKey = "monthly" | "savings" | "loans" | "lending" | "settings";
type BaseFormState = {
  id?: string;
  name: string;
  amount: string;
  date: string;
  group?: string;
};
type EntryFormState = BaseFormState;
type SavingsFormState = BaseFormState & { accountId: string };
type PersonFormState = BaseFormState & { personId: string };
type RenameTarget =
  | { type: "savings"; id: string; value: string }
  | { type: "loans" | "lending"; id: string; value: string }
  | null;

const NAV_ITEMS: Array<{ key: TabKey; labelKey: string; icon: IconName }> = [
  { key: "monthly", labelKey: "navMonthly", icon: "calendar-month-outline" },
  { key: "savings", labelKey: "navSavings", icon: "bank-outline" },
  { key: "loans", labelKey: "navLoans", icon: "hand-coin-outline" },
  { key: "lending", labelKey: "navLending", icon: "cash-fast" },
  { key: "settings", labelKey: "navSettings", icon: "cog-outline" },
];

const COPY: Record<AppLanguage, Record<string, string>> = {
  en: {
    navMonthly: "Monthly",
    navSavings: "Savings",
    navLoans: "Loans",
    navLending: "Lending",
    navSettings: "Settings",
    menuTitle: "Menu",
    languageTitle: "Language",
    languageEnglish: "English",
    languageBangla: "Bangla",
    debitIncome: "Debits / Income",
    creditExpense: "Credits / Expenses",
    leftThisMonth: "Left This Month",
    addDebit: "Add Debit",
    addCredit: "Add Credit",
    incomeMoneyIn: "Income or money in",
    expenseMoneyOut: "Expense or money out",
    insights: "Insights",
    addExpenseInsight: "Add expense items to see group insights.",
    savingsTitle: "Savings",
    addSavingsAccount: "Add savings account",
    create: "Create",
    savingsEmpty:
      "Create your first savings account to start tracking bank, cash, or other savings.",
    savingsDebitTitle: "Debits",
    savingsCreditTitle: "Credits",
    savingsAddMoney: "Add money",
    savingsWithdrawMoney: "Withdraw money",
    savingsNoAdded: "No savings added yet.",
    savingsNoWithdrawals: "No withdrawals yet.",
    loansTitle: "Loans",
    lendingTitle: "Lending",
    outstandingLoan: "Outstanding Loan",
    outstandingLending: "Outstanding Lending",
    addBorrowedFrom: "Add person you borrowed from",
    addLentTo: "Add person you lent to",
    loansEmpty: "Loans are optional, but you can track them here whenever you need.",
    lendingEmpty: "Lending is optional too, and works the same simple way.",
    addLoan: "Add Loan",
    addRepayment: "Add Repayment",
    addLentAmount: "Add Lent Amount",
    addReturnedAmount: "Add Returned Amount",
    recordAmount: "Record amount",
    recordReturn: "Record return",
    amounts: "Amounts",
    repayments: "Repayments",
    nothingRecorded: "Nothing recorded yet.",
    noRepayments: "No repayments yet.",
    settingsTitle: "Settings",
    groupsTitle: "Groups",
    addNewGroup: "Add a new group",
    add: "Add",
    backupTitle: "Backup",
    backupText:
      "Create a JSON backup file and save it anywhere you want. Later, pick that file to restore your data.",
    backupNow: "Back Up Now",
    restoreBackup: "Restore Backup",
    backupIdle: "Create a JSON backup file and save it anywhere you like.",
    backupReady: "Backup ready",
    backupReadyMessage: "Your JSON backup file is ready to save or share.",
    backupFailed: "Backup failed",
    backupFailedMessage: "The JSON backup file could not be created.",
    restoreAsk: "Restore backup?",
    restore: "Restore",
    restoreComplete: "Restore complete",
    restoreCompleteMessage: "The JSON backup has been restored to this device.",
    restoreFailed: "Restore failed",
    restoreFailedMessage: "The selected JSON backup file could not be restored.",
    groupHelp:
      "Use groups to organize monthly debit and credit items. Entries without a group stay in Other.",
    defaultLabel: "Default",
    debitIncomeModal: "Debit / Income",
    creditExpenseModal: "Credit / Expense",
    savingsCreditModal: "Savings Credit",
    savingsDebitModal: "Savings Debit",
    amountModal: "Amount",
    repaymentModal: "Repayment",
    fillNameAmount: "Fill in the item name and amount. Date is optional.",
    name: "Name",
    amount: "Amount",
    group: "Group",
    date: "Date",
    forExampleSalary: "For example Salary or Transport",
    tapToChooseDate: "Tap to choose a date",
    today: "Today",
    clear: "Clear",
    cancel: "Cancel",
    save: "Save",
    jumpToMonth: "Jump to month",
    close: "Close",
    noIncomeSaved: "No income saved for this month yet.",
    noExpensesSaved: "No expenses saved for this month yet.",
    deleteItem: "Delete item?",
    deleteMonthItem: "This entry will be removed from the month.",
    deleteSavingsItem: "This savings item will be removed.",
    deleteLedgerItem: "This ledger item will be removed.",
    delete: "Delete",
    removeGroup: "Remove group?",
    alreadyThere: "Already there",
    groupExists: "This group already exists.",
    rename: "Rename",
    accountName: "Account name",
    personName: "Person name",
    renameAccount: "Rename account",
    renamePerson: "Rename person",
    deleteAccount: "Delete account?",
    deleteAccountBody: "This savings account and all its entries will be removed.",
    deletePerson: "Delete person?",
    deletePersonBody: "This person and all related entries will be removed.",
    missingDetails: "Missing details",
    addNameAmount: "Please add a name and amount.",
    pickAccountNameAmount: "Pick an account and add a name and amount.",
    pickPersonNameAmount: "Pick a person and add a name and amount.",
    saveIssue: "Save issue",
    saveIssueBody: "Your latest changes could not be written right now.",
    preparingBook: "Preparing your budget book...",
  },
  bn: {
    navMonthly: "মাসিক",
    navSavings: "সঞ্চয়",
    navLoans: "ঋণ",
    navLending: "ধার",
    navSettings: "সেটিংস",
    menuTitle: "মেনু",
    languageTitle: "ভাষা",
    languageEnglish: "English",
    languageBangla: "বাংলা",
    debitIncome: "ডেবিট / আয়",
    creditExpense: "ক্রেডিট / খরচ",
    leftThisMonth: "এই মাসে বাকি",
    addDebit: "ডেবিট যোগ করুন",
    addCredit: "ক্রেডিট যোগ করুন",
    incomeMoneyIn: "আয় বা টাকা এসেছে",
    expenseMoneyOut: "খরচ বা টাকা গেছে",
    insights: "ইনসাইট",
    addExpenseInsight: "খরচ যোগ করলে গ্রুপভিত্তিক ইনসাইট দেখা যাবে।",
    savingsTitle: "সঞ্চয়",
    addSavingsAccount: "সঞ্চয়ের নাম যোগ করুন",
    create: "তৈরি করুন",
    savingsEmpty:
      "ব্যাংক, ক্যাশ বা অন্য সঞ্চয় ট্র্যাক করতে প্রথম সঞ্চয় অ্যাকাউন্ট তৈরি করুন।",
    savingsDebitTitle: "ডেবিট",
    savingsCreditTitle: "ক্রেডিট",
    savingsAddMoney: "টাকা যোগ",
    savingsWithdrawMoney: "টাকা উত্তোলন",
    savingsNoAdded: "এখনও সঞ্চয় যোগ করা হয়নি।",
    savingsNoWithdrawals: "এখনও উত্তোলন করা হয়নি।",
    loansTitle: "ঋণ",
    lendingTitle: "ধার",
    outstandingLoan: "মোট বাকি ঋণ",
    outstandingLending: "মোট বাকি ধার",
    addBorrowedFrom: "যার কাছ থেকে ঋণ নিয়েছেন",
    addLentTo: "যাকে ধার দিয়েছেন",
    loansEmpty: "ঋণ অপশনাল, প্রয়োজন হলে এখানে ট্র্যাক করতে পারবেন।",
    lendingEmpty: "ধারও অপশনাল, একই সহজভাবে এখানে ট্র্যাক করতে পারবেন।",
    addLoan: "ঋণ যোগ করুন",
    addRepayment: "পরিশোধ যোগ করুন",
    addLentAmount: "ধার দেওয়া যোগ করুন",
    addReturnedAmount: "ফেরত পাওয়া যোগ করুন",
    recordAmount: "পরিমাণ লিখুন",
    recordReturn: "ফেরত লিখুন",
    amounts: "পরিমাণ",
    repayments: "পরিশোধ",
    nothingRecorded: "এখনও কিছু যোগ করা হয়নি।",
    noRepayments: "এখনও কোনো পরিশোধ নেই।",
    settingsTitle: "সেটিংস",
    groupsTitle: "গ্রুপ",
    addNewGroup: "নতুন গ্রুপ যোগ করুন",
    add: "যোগ করুন",
    backupTitle: "ব্যাকআপ",
    backupText:
      "একটি JSON ব্যাকআপ ফাইল তৈরি করুন এবং যেখানে খুশি সেভ করুন। পরে সেই ফাইল থেকে ডাটা রিস্টোর করতে পারবেন।",
    backupNow: "এখন ব্যাকআপ",
    restoreBackup: "ব্যাকআপ রিস্টোর",
    backupIdle: "একটি JSON ব্যাকআপ ফাইল তৈরি করে যেকোনো জায়গায় সেভ করুন।",
    backupReady: "ব্যাকআপ প্রস্তুত",
    backupReadyMessage: "আপনার JSON ব্যাকআপ ফাইল সেভ বা শেয়ার করার জন্য প্রস্তুত।",
    backupFailed: "ব্যাকআপ ব্যর্থ",
    backupFailedMessage: "JSON ব্যাকআপ ফাইল তৈরি করা যায়নি।",
    restoreAsk: "ব্যাকআপ রিস্টোর করবেন?",
    restore: "রিস্টোর",
    restoreComplete: "রিস্টোর সম্পন্ন",
    restoreCompleteMessage: "JSON ব্যাকআপ এই ডিভাইসে রিস্টোর হয়েছে।",
    restoreFailed: "রিস্টোর ব্যর্থ",
    restoreFailedMessage: "নির্বাচিত JSON ব্যাকআপ ফাইল রিস্টোর করা যায়নি।",
    groupHelp:
      "মাসিক ডেবিট ও ক্রেডিট আইটেম গ্রুপে সাজাতে পারবেন। যেগুলোর গ্রুপ নেই সেগুলো Other এ থাকবে।",
    defaultLabel: "ডিফল্ট",
    debitIncomeModal: "ডেবিট / আয়",
    creditExpenseModal: "ক্রেডিট / খরচ",
    savingsCreditModal: "সঞ্চয় ক্রেডিট",
    savingsDebitModal: "সঞ্চয় ডেবিট",
    amountModal: "পরিমাণ",
    repaymentModal: "পরিশোধ",
    fillNameAmount: "আইটেমের নাম ও পরিমাণ দিন। তারিখ অপশনাল।",
    name: "নাম",
    amount: "পরিমাণ",
    group: "গ্রুপ",
    date: "তারিখ",
    forExampleSalary: "যেমন Salary বা Transport",
    tapToChooseDate: "তারিখ বাছাই করতে চাপুন",
    today: "আজ",
    clear: "মুছুন",
    cancel: "বাতিল",
    save: "সেভ",
    jumpToMonth: "মাসে যান",
    close: "বন্ধ",
    noIncomeSaved: "এই মাসে এখনও কোনো আয় সেভ করা হয়নি।",
    noExpensesSaved: "এই মাসে এখনও কোনো খরচ সেভ করা হয়নি।",
    deleteItem: "আইটেম মুছবেন?",
    deleteMonthItem: "এই এন্ট্রিটি মাস থেকে মুছে যাবে।",
    deleteSavingsItem: "এই সঞ্চয় আইটেমটি মুছে যাবে।",
    deleteLedgerItem: "এই লেজার আইটেমটি মুছে যাবে।",
    delete: "মুছুন",
    removeGroup: "গ্রুপ মুছবেন?",
    alreadyThere: "আগেই আছে",
    groupExists: "এই গ্রুপটি আগে থেকেই আছে।",
    rename: "নাম বদলান",
    accountName: "অ্যাকাউন্টের নাম",
    personName: "ব্যক্তির নাম",
    renameAccount: "অ্যাকাউন্টের নাম বদলান",
    renamePerson: "ব্যক্তির নাম বদলান",
    deleteAccount: "অ্যাকাউন্ট মুছবেন?",
    deleteAccountBody: "এই সঞ্চয় অ্যাকাউন্ট এবং এর সব এন্ট্রি মুছে যাবে।",
    deletePerson: "ব্যক্তিকে মুছবেন?",
    deletePersonBody: "এই ব্যক্তি এবং সংশ্লিষ্ট সব এন্ট্রি মুছে যাবে।",
    missingDetails: "তথ্য অসম্পূর্ণ",
    addNameAmount: "নাম ও পরিমাণ দিন।",
    pickAccountNameAmount: "অ্যাকাউন্ট বাছাই করে নাম ও পরিমাণ দিন।",
    pickPersonNameAmount: "ব্যক্তি বাছাই করে নাম ও পরিমাণ দিন।",
    saveIssue: "সেভ সমস্যা",
    saveIssueBody: "এই মুহূর্তে সর্বশেষ পরিবর্তন সেভ করা যায়নি।",
    preparingBook: "আপনার হিসাব বই প্রস্তুত হচ্ছে...",
  },
};

const initialEntryForm = (): EntryFormState => ({
  name: "",
  amount: "",
  date: getTodayIso(),
  group: DEFAULT_GROUP,
});

const initialSavingsForm = (): SavingsFormState => ({
  name: "",
  amount: "",
  date: getTodayIso(),
  accountId: "",
});

const initialPersonForm = (): PersonFormState => ({
  name: "",
  amount: "",
  date: getTodayIso(),
  personId: "",
});

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function groupNameOf(entry: { group?: string }) {
  return entry.group?.trim() || DEFAULT_GROUP;
}

function upsertEntry<
  T extends { id: string; name: string; amount: number; date?: string; group?: string },
>(items: T[], form: BaseFormState): T[] {
  const nextItem = {
    id: form.id ?? createId(),
    name: form.name.trim(),
    amount: toAmount(form.amount),
    date: form.date.trim() || undefined,
    group: form.group && form.group !== DEFAULT_GROUP ? form.group : undefined,
  } as T;

  if (form.id) {
    return items.map((item) => (item.id === form.id ? nextItem : item));
  }

  return [nextItem, ...items];
}

function monthlyRecord(data: AppData, monthKey: string) {
  return (
    data.months[monthKey] ?? {
      monthKey,
      credits: [],
      debits: [],
      updatedAt: new Date().toISOString(),
    }
  );
}

function hasMonthContent(monthKey: string, data: AppData) {
  const month = data.months[monthKey];
  return Boolean(month && (month.credits.length > 0 || month.debits.length > 0));
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("monthly");
  const [menuVisible, setMenuVisible] = useState(false);
  const [currentMonthKey, setCurrentMonthKey] = useState(getMonthKey(new Date()));
  const [data, setData] = useState<AppData>(emptyData);
  const [isReady, setIsReady] = useState(false);
  const [isBackupBusy, setIsBackupBusy] = useState(false);
  const [lastBackupInfo, setLastBackupInfo] = useState<{
    kind: "idle" | "backup" | "restore";
    value?: string;
  }>({ kind: "idle" });

  const [monthModalVisible, setMonthModalVisible] = useState(false);
  const [entryModalVisible, setEntryModalVisible] = useState(false);
  const [entryKind, setEntryKind] = useState<"credit" | "debit">("debit");
  const [entryForm, setEntryForm] = useState<EntryFormState>(initialEntryForm());

  const [savingsModalVisible, setSavingsModalVisible] = useState(false);
  const [savingsKind, setSavingsKind] = useState<"credit" | "debit">("credit");
  const [savingsForm, setSavingsForm] = useState<SavingsFormState>(initialSavingsForm());
  const [accountNameDraft, setAccountNameDraft] = useState("");

  const [personModalVisible, setPersonModalVisible] = useState(false);
  const [personLedgerType, setPersonLedgerType] = useState<"loans" | "lending">("loans");
  const [personMode, setPersonMode] = useState<"borrowed" | "repaid">("borrowed");
  const [personForm, setPersonForm] = useState<PersonFormState>(initialPersonForm());
  const [personNameDraft, setPersonNameDraft] = useState("");
  const [renameTarget, setRenameTarget] = useState<RenameTarget>(null);
  const [renameValue, setRenameValue] = useState("");

  const [groupDraft, setGroupDraft] = useState("");
  const [monthlyExpanded, setMonthlyExpanded] = useState({
    debits: true,
    credits: true,
  });
  const language = data.language;
  const text = COPY[language];
  const t = (key: string) => text[key] ?? key;

  function displayGroupName(name?: string) {
    const group = name?.trim() || DEFAULT_GROUP;
    if (group === DEFAULT_GROUP && language === "bn") {
      return "অন্যান্য";
    }
    return group;
  }

  const lastBackupLabel =
    lastBackupInfo.kind === "backup" && lastBackupInfo.value
      ? `${language === "bn" ? "সর্বশেষ ব্যাকআপ:" : "Last backup:"} ${lastBackupInfo.value}`
      : lastBackupInfo.kind === "restore" && lastBackupInfo.value
        ? `${language === "bn" ? "যে ফাইল থেকে রিস্টোর:" : "Restored from:"} ${lastBackupInfo.value}`
        : t("backupIdle");

  useEffect(() => {
    loadAppData()
      .then((saved) => setData(saved))
      .finally(() => setIsReady(true));
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    saveAppData(data).catch(() => {
      Alert.alert(t("saveIssue"), t("saveIssueBody"));
    });
  }, [data, isReady]);

  const currentMonth = useMemo(
    () => monthlyRecord(data, currentMonthKey),
    [currentMonthKey, data],
  );
  const monthDebitTotal = sumAmounts(currentMonth.debits);
  const monthCreditTotal = sumAmounts(currentMonth.credits);
  const monthBalance = monthDebitTotal - monthCreditTotal;
  const totalSavings = data.savings.reduce(
    (total, account) => total + sumAmounts(account.debits) - sumAmounts(account.credits),
    0,
  );
  const totalLoan = data.loans.reduce(
    (total, item) => total + sumAmounts(item.borrowed) - sumAmounts(item.repaid),
    0,
  );
  const totalLending = data.lending.reduce(
    (total, item) => total + sumAmounts(item.borrowed) - sumAmounts(item.repaid),
    0,
  );

  const expenseGroups = useMemo(() => {
    const totals = new Map<string, number>();

    currentMonth.credits.forEach((entry) => {
      const key = groupNameOf(entry);
      totals.set(key, (totals.get(key) ?? 0) + entry.amount);
    });

    return [...totals.entries()]
      .map(([group, amount]) => ({ group, amount }))
      .sort((left, right) => right.amount - left.amount);
  }, [currentMonth.credits]);

  const highestExpenseGroup = expenseGroups[0] ?? null;

  function updateData(mutator: (current: AppData) => AppData) {
    setData((current) => mutator(current));
  }

  function openMonthlyModal(kind: "credit" | "debit", item?: MonthlyEntry) {
    setEntryKind(kind);
    setEntryForm(
      item
        ? {
            id: item.id,
            name: item.name,
            amount: String(item.amount),
            date: item.date ?? getTodayIso(),
            group: item.group ?? DEFAULT_GROUP,
          }
        : initialEntryForm(),
    );
    setEntryModalVisible(true);
  }

  function saveMonthlyEntry() {
    if (!entryForm.name.trim() || !entryForm.amount.trim()) {
      Alert.alert(t("missingDetails"), t("addNameAmount"));
      return;
    }

    updateData((current) => {
      const record = monthlyRecord(current, currentMonthKey);
      const updatedRecord = {
        ...record,
        [entryKind === "debit" ? "debits" : "credits"]: upsertEntry(
          entryKind === "debit" ? record.debits : record.credits,
          entryForm,
        ),
        updatedAt: new Date().toISOString(),
      };

      return {
        ...current,
        months: {
          ...current.months,
          [currentMonthKey]: updatedRecord,
        },
      };
    });
    setEntryModalVisible(false);
  }

  function deleteMonthlyEntry(kind: "credit" | "debit", id: string) {
    Alert.alert(t("deleteItem"), t("deleteMonthItem"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: () =>
          updateData((current) => {
            const record = monthlyRecord(current, currentMonthKey);
            const nextItems = (kind === "debit" ? record.debits : record.credits).filter(
              (item) => item.id !== id,
            );
            const otherItems = kind === "debit" ? record.credits : record.debits;
            const nextRecord = {
              ...record,
              [kind === "debit" ? "debits" : "credits"]: nextItems,
              updatedAt: new Date().toISOString(),
            };
            const nextMonths = { ...current.months };

            if (nextItems.length === 0 && otherItems.length === 0) {
              delete nextMonths[currentMonthKey];
            } else {
              nextMonths[currentMonthKey] = nextRecord;
            }

            return {
              ...current,
              months: nextMonths,
            };
          }),
      },
    ]);
  }

  function addSavingsAccount() {
    const name = accountNameDraft.trim();
    if (!name) {
      return;
    }

    const newAccount: SavingsAccount = {
      id: createId(),
      name,
      credits: [],
      debits: [],
      updatedAt: new Date().toISOString(),
    };

    updateData((current) => ({
      ...current,
      savings: [newAccount, ...current.savings],
    }));
    setAccountNameDraft("");
  }

  function openRenameSavingsAccount(account: SavingsAccount) {
    setRenameTarget({ type: "savings", id: account.id, value: account.name });
    setRenameValue(account.name);
  }

  function deleteSavingsAccount(accountId: string) {
    Alert.alert(t("deleteAccount"), t("deleteAccountBody"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: () =>
          updateData((current) => ({
            ...current,
            savings: current.savings.filter((account) => account.id !== accountId),
          })),
      },
    ]);
  }

  function openSavingsModal(kind: "credit" | "debit", accountId: string, item?: MonthlyEntry) {
    setSavingsKind(kind);
    setSavingsForm(
      item
        ? {
            accountId,
            id: item.id,
            name: item.name,
            amount: String(item.amount),
            date: item.date ?? getTodayIso(),
          }
        : {
            ...initialSavingsForm(),
            accountId,
          },
    );
    setSavingsModalVisible(true);
  }

  function saveSavingsEntry() {
    if (!savingsForm.accountId || !savingsForm.name.trim() || !savingsForm.amount.trim()) {
      Alert.alert(t("missingDetails"), t("pickAccountNameAmount"));
      return;
    }

    updateData((current) => ({
      ...current,
      savings: current.savings.map((account) => {
        if (account.id !== savingsForm.accountId) {
          return account;
        }

        return {
          ...account,
          [savingsKind === "credit" ? "credits" : "debits"]: upsertEntry(
            savingsKind === "credit" ? account.credits : account.debits,
            savingsForm,
          ),
          updatedAt: new Date().toISOString(),
        };
      }),
    }));
    setSavingsModalVisible(false);
  }

  function deleteSavingsEntry(kind: "credit" | "debit", accountId: string, entryId: string) {
    Alert.alert(t("deleteItem"), t("deleteSavingsItem"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: () =>
          updateData((current) => ({
            ...current,
            savings: current.savings.map((account) => {
              if (account.id !== accountId) {
                return account;
              }

              return {
                ...account,
                [kind === "credit" ? "credits" : "debits"]: (
                  kind === "credit" ? account.credits : account.debits
                ).filter((entry) => entry.id !== entryId),
                updatedAt: new Date().toISOString(),
              };
            }),
          })),
      },
    ]);
  }

  function addPerson(type: "loans" | "lending") {
    const name = personNameDraft.trim();
    if (!name) {
      return;
    }

    const item: PersonLedger = {
      id: createId(),
      person: name,
      borrowed: [],
      repaid: [],
      updatedAt: new Date().toISOString(),
    };

    updateData((current) => ({
      ...current,
      [type]: [item, ...current[type]],
    }));
    setPersonNameDraft("");
  }

  function openRenamePerson(type: "loans" | "lending", person: PersonLedger) {
    setRenameTarget({ type, id: person.id, value: person.person });
    setRenameValue(person.person);
  }

  function deletePerson(type: "loans" | "lending", personId: string) {
    Alert.alert(t("deletePerson"), t("deletePersonBody"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: () =>
          updateData((current) => ({
            ...current,
            [type]: current[type].filter((person) => person.id !== personId),
          })),
      },
    ]);
  }

  function openPersonModal(
    type: "loans" | "lending",
    mode: "borrowed" | "repaid",
    personId: string,
    item?: MonthlyEntry,
  ) {
    setPersonLedgerType(type);
    setPersonMode(mode);
    setPersonForm(
      item
        ? {
            personId,
            id: item.id,
            name: item.name,
            amount: String(item.amount),
            date: item.date ?? getTodayIso(),
          }
        : {
            ...initialPersonForm(),
            personId,
          },
    );
    setPersonModalVisible(true);
  }

  function savePersonEntry(type: "loans" | "lending") {
    if (!personForm.personId || !personForm.name.trim() || !personForm.amount.trim()) {
      Alert.alert(t("missingDetails"), t("pickPersonNameAmount"));
      return;
    }

    updateData((current) => ({
      ...current,
      [type]: current[type].map((item) => {
        if (item.id !== personForm.personId) {
          return item;
        }

        return {
          ...item,
          [personMode]: upsertEntry(item[personMode], personForm),
          updatedAt: new Date().toISOString(),
        };
      }),
    }));
    setPersonModalVisible(false);
  }

  function deletePersonEntry(
    type: "loans" | "lending",
    mode: "borrowed" | "repaid",
    personId: string,
    entryId: string,
  ) {
    Alert.alert(t("deleteItem"), t("deleteLedgerItem"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: () =>
          updateData((current) => ({
            ...current,
            [type]: current[type].map((item) => {
              if (item.id !== personId) {
                return item;
              }

              return {
                ...item,
                [mode]: item[mode].filter((entry) => entry.id !== entryId),
                updatedAt: new Date().toISOString(),
              };
            }),
          })),
      },
    ]);
  }

  function addGroup() {
    const name = groupDraft.trim();
    if (!name) {
      return;
    }

    const exists = data.groups.some(
      (group) => group.toLowerCase() === name.toLowerCase(),
    );

    if (exists || name.toLowerCase() === DEFAULT_GROUP.toLowerCase()) {
      Alert.alert(t("alreadyThere"), t("groupExists"));
      return;
    }

    updateData((current) => ({
      ...current,
      groups: [...current.groups, name],
    }));
    setGroupDraft("");
  }

  function removeGroup(groupName: string) {
    Alert.alert(
      t("removeGroup"),
      `Entries in ${groupName} will move to ${DEFAULT_GROUP}.`,
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("delete"),
          style: "destructive",
          onPress: () =>
            updateData((current) => {
              const nextMonths = Object.fromEntries(
                Object.entries(current.months).map(([monthKey, month]) => [
                  monthKey,
                  {
                    ...month,
                    credits: month.credits.map((entry) =>
                      entry.group === groupName ? { ...entry, group: undefined } : entry,
                    ),
                    debits: month.debits.map((entry) =>
                      entry.group === groupName ? { ...entry, group: undefined } : entry,
                    ),
                  },
                ]),
              );

              return {
                ...current,
                months: nextMonths,
                groups: current.groups.filter((group) => group !== groupName),
              };
            }),
        },
      ],
    );
  }

  function saveRename() {
    const nextValue = renameValue.trim();

    if (!renameTarget || !nextValue) {
      return;
    }

    updateData((current) => {
      if (renameTarget.type === "savings") {
        return {
          ...current,
          savings: current.savings.map((account) =>
            account.id === renameTarget.id ? { ...account, name: nextValue } : account,
          ),
        };
      }

      return {
        ...current,
        [renameTarget.type]: current[renameTarget.type].map((person) =>
          person.id === renameTarget.id ? { ...person, person: nextValue } : person,
        ),
      };
    });

    setRenameTarget(null);
    setRenameValue("");
  }

  async function backupNow() {
    try {
      setIsBackupBusy(true);
      await shareBackupFile(data);
      const savedAt = new Date().toLocaleString();
      setLastBackupInfo({ kind: "backup", value: savedAt });
      Alert.alert(t("backupReady"), t("backupReadyMessage"));
    } catch {
      Alert.alert(t("backupFailed"), t("backupFailedMessage"));
    } finally {
      setIsBackupBusy(false);
    }
  }

  async function restoreFromFile() {
    try {
      setIsBackupBusy(true);
      const selected = await pickBackupFile();

      if (!selected) {
        return;
      }

      Alert.alert(
        t("restoreAsk"),
        `This will replace the current local data with ${selected.fileName}.`,
        [
          { text: t("cancel"), style: "cancel" },
          {
            text: t("restore"),
            style: "destructive",
            onPress: () => {
              setData(selected.data);
              setLastBackupInfo({ kind: "restore", value: selected.fileName });
              Alert.alert(t("restoreComplete"), t("restoreCompleteMessage"));
            },
          },
        ],
      );
    } catch {
      Alert.alert(t("restoreFailed"), t("restoreFailedMessage"));
    } finally {
      setIsBackupBusy(false);
    }
  }

  const topPadding = Platform.OS === "android" ? (NativeStatusBar.currentHeight ?? 0) + 12 : 12;

  if (!isReady) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#17494d" />
        <Text style={styles.loadingText}>{t("preparingBook")}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={[styles.navBar, { paddingTop: topPadding }]}>
        <Text style={styles.navTitle}>fudget</Text>
        <Pressable style={styles.navButton} onPress={() => setMenuVisible(true)}>
          <MaterialCommunityIcons name="menu" size={24} color="#17494d" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === "monthly" && (
          <>
            <View style={styles.monthHeader}>
              <Pressable
                style={styles.monthArrow}
                onPress={() => setCurrentMonthKey(offsetMonth(currentMonthKey, -1))}
              >
                <Text style={styles.monthArrowText}>‹</Text>
              </Pressable>
              <Pressable style={styles.monthCenter} onPress={() => setMonthModalVisible(true)}>
                <Text style={styles.monthTitle}>{formatMonthLabel(currentMonthKey, language)}</Text>
                <Text style={styles.monthHint}>
                  {language === "bn"
                    ? `${currentMonth.debits.length} আয় • ${currentMonth.credits.length} খরচ`
                    : `${currentMonth.debits.length} income • ${currentMonth.credits.length} expense`}
                </Text>
              </Pressable>
              <Pressable
                style={styles.monthArrow}
                onPress={() => setCurrentMonthKey(offsetMonth(currentMonthKey, 1))}
              >
                <Text style={styles.monthArrowText}>›</Text>
              </Pressable>
            </View>

            <View style={styles.summaryGrid}>
              <BalanceCard title={t("debitIncome")} amount={formatCurrency(monthDebitTotal)} />
              <BalanceCard title={t("creditExpense")} amount={formatCurrency(monthCreditTotal)} />
              <BalanceCard title={t("leftThisMonth")} amount={formatCurrency(monthBalance)} wide />
            </View>

            <View style={styles.actionRow}>
              <LargeActionButton
                title={t("addDebit")}
                subtitle={t("incomeMoneyIn")}
                color="#1e706b"
                icon="arrow-down-bold-circle-outline"
                onPress={() => openMonthlyModal("debit")}
              />
              <LargeActionButton
                title={t("addCredit")}
                subtitle={t("expenseMoneyOut")}
                color="#bf5c39"
                icon="arrow-up-bold-circle-outline"
                onPress={() => openMonthlyModal("credit")}
              />
            </View>

            <EntrySection
              title={t("debitIncome")}
              emptyText={t("noIncomeSaved")}
              items={currentMonth.debits}
              accent="#1e706b"
              icon="arrow-down-bold-circle-outline"
              total={monthDebitTotal}
              itemCount={currentMonth.debits.length}
              expanded={monthlyExpanded.debits}
              onToggle={() =>
                setMonthlyExpanded((current) => ({
                  ...current,
                  debits: !current.debits,
                }))
              }
              onEdit={(item) => openMonthlyModal("debit", item)}
              onDelete={(item) => deleteMonthlyEntry("debit", item.id)}
              showGroups
              formatGroupLabel={displayGroupName}
              itemWord={language === "bn" ? "টি" : "items"}
              language={language}
            />

            <EntrySection
              title={t("creditExpense")}
              emptyText={t("noExpensesSaved")}
              items={currentMonth.credits}
              accent="#bf5c39"
              icon="arrow-up-bold-circle-outline"
              total={monthCreditTotal}
              itemCount={currentMonth.credits.length}
              expanded={monthlyExpanded.credits}
              onToggle={() =>
                setMonthlyExpanded((current) => ({
                  ...current,
                  credits: !current.credits,
                }))
              }
              onEdit={(item) => openMonthlyModal("credit", item)}
              onDelete={(item) => deleteMonthlyEntry("credit", item.id)}
              showGroups
              formatGroupLabel={displayGroupName}
              itemWord={language === "bn" ? "টি" : "items"}
              language={language}
            />

            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Text style={styles.cardTitle}>{t("insights")}</Text>
                <MaterialCommunityIcons name="chart-arc" size={18} color="#17494d" />
              </View>
              <Text style={styles.insightText}>
                {highestExpenseGroup
                  ? language === "bn"
                    ? `এই মাসে গ্রুপভিত্তিক সর্বোচ্চ খরচ: ${displayGroupName(highestExpenseGroup.group)} (${formatCurrency(highestExpenseGroup.amount)})।`
                    : `Highest expense this month by group: ${displayGroupName(highestExpenseGroup.group)} (${formatCurrency(highestExpenseGroup.amount)}).`
                  : t("addExpenseInsight")}
              </Text>
              {expenseGroups.slice(0, 4).map((item) => (
                <GroupBar
                  key={item.group}
                  label={displayGroupName(item.group)}
                  amount={item.amount}
                  maxAmount={expenseGroups[0]?.amount ?? 1}
                />
              ))}
            </View>
          </>
        )}

        {activeTab === "savings" && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t("savingsTitle")}</Text>
              <Text style={styles.sectionAmount}>{formatCurrency(totalSavings)}</Text>
            </View>

            <View style={styles.inlineCreator}>
              <TextInput
                value={accountNameDraft}
                onChangeText={setAccountNameDraft}
                placeholder={t("addSavingsAccount")}
                placeholderTextColor="#7d786f"
                style={styles.input}
              />
              <Pressable style={styles.inlineButton} onPress={addSavingsAccount}>
                <Text style={styles.inlineButtonText}>{t("create")}</Text>
              </Pressable>
            </View>

            {data.savings.length === 0 ? (
              <EmptyCard text={t("savingsEmpty")} />
            ) : (
              data.savings.map((account) => (
                <SavingsCard
                  key={account.id}
                  account={account}
                  onAddCredit={() => openSavingsModal("credit", account.id)}
                  onAddDebit={() => openSavingsModal("debit", account.id)}
                  onEdit={(kind, item) => openSavingsModal(kind, account.id, item)}
                  onDelete={(kind, itemId) => deleteSavingsEntry(kind, account.id, itemId)}
                  onRename={() => openRenameSavingsAccount(account)}
                  onDeleteAccount={() => deleteSavingsAccount(account.id)}
                  language={language}
                  t={t}
                />
              ))
            )}
          </>
        )}

        {activeTab === "loans" && (
          <PeopleLedgerView
            title={t("loansTitle")}
            totalLabel={t("outstandingLoan")}
            totalAmount={totalLoan}
            placeholder={t("addBorrowedFrom")}
            emptyText={t("loansEmpty")}
            people={data.loans}
            personDraft={personNameDraft}
            setPersonDraft={setPersonNameDraft}
            onCreate={() => addPerson("loans")}
            onAddPrimary={(id) => openPersonModal("loans", "borrowed", id)}
            onAddSecondary={(id) => openPersonModal("loans", "repaid", id)}
            primaryLabel={t("addLoan")}
            secondaryLabel={t("addRepayment")}
            onEdit={(mode, personId, item) => openPersonModal("loans", mode, personId, item)}
            onDelete={(mode, personId, itemId) =>
              deletePersonEntry("loans", mode, personId, itemId)
            }
            onRenamePerson={(person) => openRenamePerson("loans", person)}
            onDeletePerson={(personId) => deletePerson("loans", personId)}
            t={t}
            itemWord={language === "bn" ? "টি" : "items"}
            language={language}
          />
        )}

        {activeTab === "lending" && (
          <PeopleLedgerView
            title={t("lendingTitle")}
            totalLabel={t("outstandingLending")}
            totalAmount={totalLending}
            placeholder={t("addLentTo")}
            emptyText={t("lendingEmpty")}
            people={data.lending}
            personDraft={personNameDraft}
            setPersonDraft={setPersonNameDraft}
            onCreate={() => addPerson("lending")}
            onAddPrimary={(id) => openPersonModal("lending", "borrowed", id)}
            onAddSecondary={(id) => openPersonModal("lending", "repaid", id)}
            primaryLabel={t("addLentAmount")}
            secondaryLabel={t("addReturnedAmount")}
            onEdit={(mode, personId, item) => openPersonModal("lending", mode, personId, item)}
            onDelete={(mode, personId, itemId) =>
              deletePersonEntry("lending", mode, personId, itemId)
            }
            onRenamePerson={(person) => openRenamePerson("lending", person)}
            onDeletePerson={(personId) => deletePerson("lending", personId)}
            t={t}
            itemWord={language === "bn" ? "টি" : "items"}
            language={language}
          />
        )}

        {activeTab === "settings" && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t("settingsTitle")}</Text>
              <MaterialCommunityIcons name="cog-outline" size={22} color="#17494d" />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t("groupsTitle")}</Text>
              <Text style={styles.settingsHelp}>{t("groupHelp")}</Text>
              <View style={styles.inlineCreator}>
                <TextInput
                  value={groupDraft}
                  onChangeText={setGroupDraft}
                  placeholder={t("addNewGroup")}
                  placeholderTextColor="#7d786f"
                  style={styles.input}
                />
                <Pressable style={styles.inlineButton} onPress={addGroup}>
                  <Text style={styles.inlineButtonText}>{t("add")}</Text>
                </Pressable>
              </View>
              <View style={styles.groupList}>
                <GroupSettingsRow
                  label={displayGroupName(DEFAULT_GROUP)}
                  fixed
                  fixedLabel={t("defaultLabel")}
                />
                {data.groups.map((group) => (
                  <GroupSettingsRow
                    key={group}
                    label={displayGroupName(group)}
                    onRemove={() => removeGroup(group)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.exportCard}>
              <Text style={styles.exportTitle}>{t("backupTitle")}</Text>
              <Text style={styles.exportText}>{t("backupText")}</Text>
              <Text style={styles.backupStatusText}>{lastBackupLabel}</Text>
              <View style={styles.actionRow}>
                <Pressable
                  style={styles.backupActionButton}
                  onPress={() => void backupNow()}
                  disabled={isBackupBusy}
                >
                  <MaterialCommunityIcons name="content-save-outline" size={18} color="#fff8ef" />
                  <Text style={styles.backupActionButtonText}>
                    {isBackupBusy ? (language === "bn" ? "চলছে..." : "Working...") : t("backupNow")}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.backupActionButtonSecondary}
                  onPress={() => void restoreFromFile()}
                  disabled={isBackupBusy}
                >
                  <MaterialCommunityIcons name="file-restore-outline" size={18} color="#17494d" />
                  <Text style={styles.backupActionButtonSecondaryText}>{t("restoreBackup")}</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <SideMenu
        visible={menuVisible}
        activeTab={activeTab}
        language={language}
        navItems={NAV_ITEMS.map((item) => ({
          ...item,
          label: t(item.labelKey),
        }))}
        onClose={() => setMenuVisible(false)}
        onSelect={(tab) => {
          setActiveTab(tab);
          setMenuVisible(false);
        }}
        onLanguageChange={(nextLanguage) =>
          updateData((current) => ({
            ...current,
            language: nextLanguage,
          }))
        }
        t={t}
      />

      <MonthPickerModal
        visible={monthModalVisible}
        selectedMonthKey={currentMonthKey}
        language={language}
        title={t("jumpToMonth")}
        onSelect={(monthKey) => {
          setCurrentMonthKey(monthKey);
          setMonthModalVisible(false);
        }}
        onClose={() => setMonthModalVisible(false)}
        closeLabel={t("close")}
      />

      <EntryModal
        visible={entryModalVisible}
        title={entryKind === "debit" ? t("debitIncomeModal") : t("creditExpenseModal")}
        form={entryForm}
        setForm={setEntryForm}
        onClose={() => setEntryModalVisible(false)}
        onSave={saveMonthlyEntry}
        groups={[DEFAULT_GROUP, ...data.groups]}
        language={language}
        t={t}
        formatGroupLabel={displayGroupName}
      />

      <EntryModal
        visible={savingsModalVisible}
        title={savingsKind === "credit" ? t("savingsCreditModal") : t("savingsDebitModal")}
        form={savingsForm}
        setForm={setSavingsForm}
        onClose={() => setSavingsModalVisible(false)}
        onSave={saveSavingsEntry}
        language={language}
        t={t}
      />

      <EntryModal
        visible={personModalVisible}
        title={personMode === "borrowed" ? t("amountModal") : t("repaymentModal")}
        form={personForm}
        setForm={setPersonForm}
        onClose={() => setPersonModalVisible(false)}
        onSave={() => savePersonEntry(personLedgerType)}
        language={language}
        t={t}
      />

      <RenameModal
        visible={Boolean(renameTarget)}
        title={
          renameTarget?.type === "savings" ? t("renameAccount") : t("renamePerson")
        }
        label={renameTarget?.type === "savings" ? t("accountName") : t("personName")}
        value={renameValue}
        onChangeValue={setRenameValue}
        onClose={() => {
          setRenameTarget(null);
          setRenameValue("");
        }}
        onSave={saveRename}
        saveLabel={t("save")}
        cancelLabel={t("cancel")}
      />
    </SafeAreaView>
  );
}

function BalanceCard({
  title,
  amount,
  wide,
}: {
  title: string;
  amount: string;
  wide?: boolean;
}) {
  return (
    <View style={[styles.balanceCard, wide && styles.balanceCardWide]}>
      <Text style={styles.balanceTitle}>{title}</Text>
      <Text style={styles.balanceAmount}>{amount}</Text>
    </View>
  );
}

function LargeActionButton({
  title,
  subtitle,
  color,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  color: string;
  icon: IconName;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.largeActionButton, { backgroundColor: color }]} onPress={onPress}>
      <MaterialCommunityIcons name={icon} size={22} color="#fff7ef" />
      <Text style={styles.largeActionTitle}>{title}</Text>
      <Text style={styles.largeActionSubtitle}>{subtitle}</Text>
    </Pressable>
  );
}

function EntrySection({
  title,
  emptyText,
  items,
  accent,
  icon,
  total,
  itemCount,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  showGroups,
  formatGroupLabel,
  itemWord,
  language,
}: {
  title: string;
  emptyText: string;
  items: MonthlyEntry[];
  accent: string;
  icon: IconName;
  total: number;
  itemCount: number;
  expanded: boolean;
  onToggle: () => void;
  onEdit: (item: MonthlyEntry) => void;
  onDelete: (item: MonthlyEntry) => void;
  showGroups?: boolean;
  formatGroupLabel?: (group?: string) => string;
  itemWord?: string;
  language: AppLanguage;
}) {
  return (
    <View style={styles.card}>
      <Pressable style={styles.entrySectionHeader} onPress={onToggle}>
        <View style={styles.entrySectionTitleWrap}>
          <MaterialCommunityIcons name={icon} size={18} color={accent} />
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
        <View style={styles.entrySectionSummary}>
          <Text style={styles.entrySectionMeta}>
            {itemCount} {itemWord ?? "items"}
          </Text>
          <Text style={styles.entrySectionTotal}>{formatCurrency(total)}</Text>
          <MaterialCommunityIcons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={20}
            color="#6b655c"
          />
        </View>
      </Pressable>

      {!expanded ? null : items.length === 0 ? (
        <Text style={styles.emptyText}>{emptyText}</Text>
      ) : (
        items.map((item) => (
          <View key={item.id} style={styles.entryRow}>
            <View style={styles.entryTopLine}>
              <View style={styles.entryTitleWrap}>
                <View style={[styles.entryDot, { backgroundColor: accent }]} />
                <Text numberOfLines={1} style={styles.entryName}>
                  {item.name}
                </Text>
              </View>
              <Text style={styles.entryAmount}>{formatCurrency(item.amount)}</Text>
            </View>

            <View style={styles.entryBottomLine}>
              <View style={styles.entryMetaWrap}>
                {showGroups ? (
                  <View style={styles.groupBadge}>
                    <Text style={styles.groupBadgeText}>
                      {formatGroupLabel ? formatGroupLabel(groupNameOf(item)) : groupNameOf(item)}
                    </Text>
                  </View>
                ) : null}
                {item.date ? (
                  <Text style={styles.entryMeta}>{formatDateLabel(item.date, language)}</Text>
                ) : null}
              </View>
              <View style={styles.entryActions}>
                <Pressable style={styles.iconActionButton} onPress={() => onEdit(item)}>
                  <MaterialCommunityIcons name="pencil-outline" size={16} color="#17494d" />
                </Pressable>
                <Pressable style={styles.iconActionButtonGhost} onPress={() => onDelete(item)}>
                  <MaterialCommunityIcons
                    name="trash-can-outline"
                    size={16}
                    color="#9a4b31"
                  />
                </Pressable>
              </View>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function SavingsCard({
  account,
  onAddCredit,
  onAddDebit,
  onEdit,
  onDelete,
  onRename,
  onDeleteAccount,
  language,
  t,
}: {
  account: SavingsAccount;
  onAddCredit: () => void;
  onAddDebit: () => void;
  onEdit: (kind: "credit" | "debit", item: MonthlyEntry) => void;
  onDelete: (kind: "credit" | "debit", itemId: string) => void;
  onRename: () => void;
  onDeleteAccount: () => void;
  language: AppLanguage;
  t: (key: string) => string;
}) {
  const [expanded, setExpanded] = useState({
    debits: true,
    credits: false,
  });
  const total = sumAmounts(account.debits) - sumAmounts(account.credits);

  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <View style={styles.headerMainWrap}>
          <Text style={styles.cardTitle}>{account.name}</Text>
          <Text style={styles.sectionAmount}>{formatCurrency(total)}</Text>
        </View>
        <View style={styles.subtleHeaderActions}>
          <Pressable style={styles.subtleHeaderButton} onPress={onRename}>
            <MaterialCommunityIcons name="pencil-outline" size={15} color="#7a746b" />
          </Pressable>
          <Pressable style={styles.subtleHeaderButton} onPress={onDeleteAccount}>
            <MaterialCommunityIcons name="trash-can-outline" size={15} color="#7a746b" />
          </Pressable>
        </View>
      </View>

      <View style={styles.actionRow}>
        <LargeActionButton
          title={t("addDebit")}
          subtitle={t("savingsAddMoney")}
          color="#1e706b"
          icon="plus-circle-outline"
          onPress={onAddDebit}
        />
        <LargeActionButton
          title={t("addCredit")}
          subtitle={t("savingsWithdrawMoney")}
          color="#bf5c39"
          icon="minus-circle-outline"
          onPress={onAddCredit}
        />
      </View>

      <EntrySection
        title={t("savingsDebitTitle")}
        emptyText={t("savingsNoAdded")}
        items={account.debits}
        accent="#1e706b"
        icon="plus-circle-outline"
        total={sumAmounts(account.debits)}
        itemCount={account.debits.length}
        expanded={expanded.debits}
        onToggle={() =>
          setExpanded((current) => ({
            ...current,
            debits: !current.debits,
          }))
        }
        onEdit={(item) => onEdit("debit", item)}
        onDelete={(item) => onDelete("debit", item.id)}
        itemWord={language === "bn" ? "টি" : "items"}
        language={language}
      />

      <EntrySection
        title={t("savingsCreditTitle")}
        emptyText={t("savingsNoWithdrawals")}
        items={account.credits}
        accent="#bf5c39"
        icon="minus-circle-outline"
        total={sumAmounts(account.credits)}
        itemCount={account.credits.length}
        expanded={expanded.credits}
        onToggle={() =>
          setExpanded((current) => ({
            ...current,
            credits: !current.credits,
          }))
        }
        onEdit={(item) => onEdit("credit", item)}
        onDelete={(item) => onDelete("credit", item.id)}
        itemWord={language === "bn" ? "টি" : "items"}
        language={language}
      />
    </View>
  );
}

function PeopleLedgerView({
  title,
  totalLabel,
  totalAmount,
  placeholder,
  emptyText,
  people,
  personDraft,
  setPersonDraft,
  onCreate,
  onAddPrimary,
  onAddSecondary,
  primaryLabel,
  secondaryLabel,
  onEdit,
  onDelete,
  onRenamePerson,
  onDeletePerson,
  t,
  itemWord,
  language,
}: {
  title: string;
  totalLabel: string;
  totalAmount: number;
  placeholder: string;
  emptyText: string;
  people: PersonLedger[];
  personDraft: string;
  setPersonDraft: (value: string) => void;
  onCreate: () => void;
  onAddPrimary: (id: string) => void;
  onAddSecondary: (id: string) => void;
  primaryLabel: string;
  secondaryLabel: string;
  onEdit: (mode: "borrowed" | "repaid", personId: string, item: MonthlyEntry) => void;
  onDelete: (mode: "borrowed" | "repaid", personId: string, itemId: string) => void;
  onRenamePerson: (person: PersonLedger) => void;
  onDeletePerson: (personId: string) => void;
  t: (key: string) => string;
  itemWord: string;
  language: AppLanguage;
}) {
  return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionAmount}>{formatCurrency(totalAmount)}</Text>
      </View>

      <View style={styles.inlineCreator}>
        <TextInput
          value={personDraft}
          onChangeText={setPersonDraft}
          placeholder={placeholder}
          placeholderTextColor="#7d786f"
          style={styles.input}
        />
        <Pressable style={styles.inlineButton} onPress={onCreate}>
          <Text style={styles.inlineButtonText}>Create</Text>
        </Pressable>
      </View>

      {people.length === 0 ? (
        <EmptyCard text={emptyText} />
      ) : (
        people.map((person) => (
          <PeopleLedgerCard
            key={person.id}
            person={person}
            primaryLabel={primaryLabel}
            secondaryLabel={secondaryLabel}
            onAddPrimary={() => onAddPrimary(person.id)}
            onAddSecondary={() => onAddSecondary(person.id)}
            onEdit={onEdit}
            onDelete={onDelete}
            onRename={() => onRenamePerson(person)}
            onDeletePerson={() => onDeletePerson(person.id)}
            t={t}
            itemWord={itemWord}
            language={language}
          />
        ))
      )}
    </>
  );
}

function PeopleLedgerCard({
  person,
  primaryLabel,
  secondaryLabel,
  onAddPrimary,
  onAddSecondary,
  onEdit,
  onDelete,
  onRename,
  onDeletePerson,
  t,
  itemWord,
  language,
}: {
  person: PersonLedger;
  primaryLabel: string;
  secondaryLabel: string;
  onAddPrimary: () => void;
  onAddSecondary: () => void;
  onEdit: (mode: "borrowed" | "repaid", personId: string, item: MonthlyEntry) => void;
  onDelete: (mode: "borrowed" | "repaid", personId: string, itemId: string) => void;
  onRename: () => void;
  onDeletePerson: () => void;
  t: (key: string) => string;
  itemWord: string;
  language: AppLanguage;
}) {
  const [expanded, setExpanded] = useState({
    borrowed: true,
    repaid: false,
  });
  const outstanding = sumAmounts(person.borrowed) - sumAmounts(person.repaid);

  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <View style={styles.headerMainWrap}>
          <Text style={styles.cardTitle}>{person.person}</Text>
          <Text style={styles.sectionAmount}>{formatCurrency(outstanding)}</Text>
        </View>
        <View style={styles.subtleHeaderActions}>
          <Pressable style={styles.subtleHeaderButton} onPress={onRename}>
            <MaterialCommunityIcons name="pencil-outline" size={15} color="#7a746b" />
          </Pressable>
          <Pressable style={styles.subtleHeaderButton} onPress={onDeletePerson}>
            <MaterialCommunityIcons name="trash-can-outline" size={15} color="#7a746b" />
          </Pressable>
        </View>
      </View>

      <View style={styles.actionRow}>
        <LargeActionButton
          title={primaryLabel}
          subtitle={t("recordAmount")}
          color="#1e706b"
          icon="plus-circle-outline"
          onPress={onAddPrimary}
        />
        <LargeActionButton
          title={secondaryLabel}
          subtitle={t("recordReturn")}
          color="#bf5c39"
          icon="minus-circle-outline"
          onPress={onAddSecondary}
        />
      </View>

      <EntrySection
        title={t("amounts")}
        emptyText={t("nothingRecorded")}
        items={person.borrowed}
        accent="#1e706b"
        icon="plus-circle-outline"
        total={sumAmounts(person.borrowed)}
        itemCount={person.borrowed.length}
        expanded={expanded.borrowed}
        onToggle={() =>
          setExpanded((current) => ({
            ...current,
            borrowed: !current.borrowed,
          }))
        }
        onEdit={(item) => onEdit("borrowed", person.id, item)}
        onDelete={(item) => onDelete("borrowed", person.id, item.id)}
        itemWord={itemWord}
        language={language}
      />

      <EntrySection
        title={t("repayments")}
        emptyText={t("noRepayments")}
        items={person.repaid}
        accent="#bf5c39"
        icon="minus-circle-outline"
        total={sumAmounts(person.repaid)}
        itemCount={person.repaid.length}
        expanded={expanded.repaid}
        onToggle={() =>
          setExpanded((current) => ({
            ...current,
            repaid: !current.repaid,
          }))
        }
        onEdit={(item) => onEdit("repaid", person.id, item)}
        onDelete={(item) => onDelete("repaid", person.id, item.id)}
        itemWord={itemWord}
        language={language}
      />
    </View>
  );
}

function GroupBar({
  label,
  amount,
  maxAmount,
}: {
  label: string;
  amount: number;
  maxAmount: number;
}) {
  return (
    <View style={styles.groupBarRow}>
      <View style={styles.groupBarHeader}>
        <Text style={styles.groupBarLabel}>{label}</Text>
        <Text style={styles.groupBarAmount}>{formatCurrency(amount)}</Text>
      </View>
      <View style={styles.groupBarTrack}>
        <View
          style={[
            styles.groupBarFill,
            { width: `${Math.max((amount / Math.max(maxAmount, 1)) * 100, 8)}%` },
          ]}
        />
      </View>
    </View>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function GroupSettingsRow({
  label,
  fixed,
  fixedLabel,
  onRemove,
}: {
  label: string;
  fixed?: boolean;
  fixedLabel?: string;
  onRemove?: () => void;
}) {
  return (
    <View style={styles.groupSettingsRow}>
      <View style={styles.groupSettingsLabelWrap}>
        <MaterialCommunityIcons name="shape-outline" size={16} color="#17494d" />
        <Text style={styles.groupSettingsLabel}>{label}</Text>
      </View>
      {fixed ? (
        <Text style={styles.groupFixedText}>{fixedLabel ?? "Default"}</Text>
      ) : (
        <Pressable style={styles.iconActionButtonGhost} onPress={onRemove}>
          <MaterialCommunityIcons name="trash-can-outline" size={16} color="#9a4b31" />
        </Pressable>
      )}
    </View>
  );
}

function SideMenu({
  visible,
  activeTab,
  language,
  navItems,
  onClose,
  onSelect,
  onLanguageChange,
  t,
}: {
  visible: boolean;
  activeTab: TabKey;
  language: AppLanguage;
  navItems: Array<{ key: TabKey; label: string; icon: IconName }>;
  onClose: () => void;
  onSelect: (tab: TabKey) => void;
  onLanguageChange: (language: AppLanguage) => void;
  t: (key: string) => string;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.menuBackdrop}>
        <Pressable style={styles.menuBackdropTouch} onPress={onClose} />
        <View style={styles.menuSheet}>
          <View style={styles.menuHeader}>
            <Text style={styles.menuTitle}>{t("menuTitle")}</Text>
            <Pressable style={styles.navButton} onPress={onClose}>
              <MaterialCommunityIcons name="close" size={22} color="#17494d" />
            </Pressable>
          </View>
          {navItems.map((item) => (
            <Pressable
              key={item.key}
              style={[
                styles.menuItem,
                activeTab === item.key && styles.menuItemActive,
              ]}
              onPress={() => onSelect(item.key)}
            >
              <MaterialCommunityIcons
                name={item.icon}
                size={18}
                color={activeTab === item.key ? "#fff8ef" : "#17494d"}
              />
              <Text
                style={[
                  styles.menuItemText,
                  activeTab === item.key && styles.menuItemTextActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
          <View style={styles.menuLanguageBlock}>
            <Text style={styles.menuLanguageTitle}>{t("languageTitle")}</Text>
            <View style={styles.menuLanguageRow}>
              <Pressable
                style={[
                  styles.menuLanguageChip,
                  language === "en" && styles.menuLanguageChipActive,
                ]}
                onPress={() => onLanguageChange("en")}
              >
                <Text
                  style={[
                    styles.menuLanguageChipText,
                    language === "en" && styles.menuLanguageChipTextActive,
                  ]}
                >
                  {t("languageEnglish")}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.menuLanguageChip,
                  language === "bn" && styles.menuLanguageChipActive,
                ]}
                onPress={() => onLanguageChange("bn")}
              >
                <Text
                  style={[
                    styles.menuLanguageChipText,
                    language === "bn" && styles.menuLanguageChipTextActive,
                  ]}
                >
                  {t("languageBangla")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function EntryModal<T extends BaseFormState>({
  visible,
  title,
  form,
  setForm,
  onClose,
  onSave,
  groups,
  language,
  t,
  formatGroupLabel,
}: {
  visible: boolean;
  title: string;
  form: T;
  setForm: (value: T | ((current: T) => T)) => void;
  onClose: () => void;
  onSave: () => void;
  groups?: string[];
  language: AppLanguage;
  t: (key: string) => string;
  formatGroupLabel?: (group?: string) => string;
}) {
  const amountInputRef = useRef<TextInput>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const selectedDate = parseIsoDate(form.date) ?? new Date();

  function onDateChange(event: DateTimePickerEvent, nextDate?: Date) {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }

    if (event.type === "dismissed" || !nextDate) {
      return;
    }

    setForm((current) => ({
      ...current,
      date: formatIsoDate(nextDate),
    }));
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalBackdrop}
      >
        <View style={styles.modalCard}>
          <View style={styles.modalTitleRow}>
            <MaterialCommunityIcons name="note-edit-outline" size={22} color="#17494d" />
            <Text style={styles.modalTitle}>{title}</Text>
          </View>
          <Text style={styles.modalHelperText}>
            {t("fillNameAmount")}
          </Text>

          <Text style={styles.inputLabel}>{t("name")}</Text>
          <TextInput
            autoFocus
            value={form.name}
            onChangeText={(name) => setForm((current) => ({ ...current, name }))}
            placeholder={t("forExampleSalary")}
            placeholderTextColor="#7d786f"
            style={styles.modalInput}
            returnKeyType="next"
            onSubmitEditing={() => amountInputRef.current?.focus()}
          />

          <Text style={styles.inputLabel}>{t("amount")}</Text>
          <TextInput
            ref={amountInputRef}
            value={form.amount}
            onChangeText={(amount) => setForm((current) => ({ ...current, amount }))}
            placeholder="0"
            placeholderTextColor="#7d786f"
            keyboardType="decimal-pad"
            style={styles.modalInput}
            returnKeyType="next"
            onSubmitEditing={() => setShowDatePicker(true)}
          />

          {groups ? (
            <>
              <Text style={styles.inputLabel}>{t("group")}</Text>
              <View style={styles.modalGroupWrap}>
                {groups.map((group) => (
                  <Pressable
                    key={group}
                    style={[
                      styles.modalGroupChip,
                      (form.group ?? DEFAULT_GROUP) === group && styles.modalGroupChipActive,
                    ]}
                    onPress={() =>
                      setForm((current) => ({
                        ...current,
                        group,
                      }))
                    }
                  >
                    <Text
                      style={[
                        styles.modalGroupChipText,
                        (form.group ?? DEFAULT_GROUP) === group &&
                          styles.modalGroupChipTextActive,
                      ]}
                    >
                      {formatGroupLabel ? formatGroupLabel(group) : group}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          <Text style={styles.inputLabel}>{t("date")}</Text>
          <Pressable
            style={styles.dateButton}
            onPress={() => setShowDatePicker((current) => !current)}
          >
            <View style={styles.dateButtonContent}>
              <MaterialCommunityIcons
                name="calendar-month-outline"
                size={18}
                color="#17494d"
              />
              <View>
                <Text style={styles.dateButtonLabel}>{formatDateLabel(form.date, language)}</Text>
                <Text style={styles.dateButtonHint}>
                  {form.date ? formatDateLabel(form.date, language) : t("tapToChooseDate")}
                </Text>
              </View>
            </View>
            <MaterialCommunityIcons
              name={showDatePicker ? "chevron-up" : "chevron-down"}
              size={20}
              color="#6b655c"
            />
          </Pressable>

          <View style={styles.dateActionRow}>
            <Pressable
              style={styles.dateActionChip}
              onPress={() =>
                setForm((current) => ({
                  ...current,
                  date: getTodayIso(),
                }))
              }
            >
              <Text style={styles.dateActionChipText}>{t("today")}</Text>
            </Pressable>
            <Pressable
              style={styles.dateActionChip}
              onPress={() =>
                setForm((current) => ({
                  ...current,
                  date: "",
                }))
              }
            >
              <Text style={styles.dateActionChipText}>{t("clear")}</Text>
            </Pressable>
          </View>

          {showDatePicker ? (
            <View style={styles.pickerWrap}>
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={onDateChange}
              />
              {Platform.OS === "ios" ? (
                <Pressable
                  style={styles.pickerDoneButton}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={styles.pickerDoneButtonText}>{t("close")}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View style={styles.modalActions}>
            <Pressable style={styles.smallButtonGhost} onPress={onClose}>
              <Text style={styles.smallButtonGhostText}>{t("cancel")}</Text>
            </Pressable>
            <Pressable style={styles.smallButton} onPress={onSave}>
              <Text style={styles.smallButtonText}>{t("save")}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function MonthPickerModal({
  visible,
  selectedMonthKey,
  language,
  title,
  onSelect,
  onClose,
  closeLabel,
}: {
  visible: boolean;
  selectedMonthKey: string;
  language: AppLanguage;
  title: string;
  onSelect: (monthKey: string) => void;
  onClose: () => void;
  closeLabel: string;
}) {
  const options = useMemo(
    () => getMonthOptions(selectedMonthKey, 24, language),
    [language, selectedMonthKey],
  );

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.modalBackdrop}>
        <View style={styles.monthPickerCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <ScrollView>
            {options.map((option) => (
              <Pressable
                key={option.monthKey}
                style={[
                  styles.monthOption,
                  option.monthKey === selectedMonthKey && styles.monthOptionActive,
                ]}
                onPress={() => onSelect(option.monthKey)}
              >
                <Text style={styles.monthOptionText}>{option.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={styles.monthPickerClose} onPress={onClose}>
            <Text style={styles.monthPickerCloseText}>{closeLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function RenameModal({
  visible,
  title,
  label,
  value,
  onChangeValue,
  onClose,
  onSave,
  saveLabel,
  cancelLabel,
}: {
  visible: boolean;
  title: string;
  label: string;
  value: string;
  onChangeValue: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
  saveLabel: string;
  cancelLabel: string;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalBackdrop}
      >
        <View style={styles.renameModalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.inputLabel}>{label}</Text>
          <TextInput
            autoFocus
            value={value}
            onChangeText={onChangeValue}
            style={styles.modalInput}
            placeholderTextColor="#7d786f"
          />
          <View style={styles.modalActions}>
            <Pressable style={styles.smallButtonGhost} onPress={onClose}>
              <Text style={styles.smallButtonGhostText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable style={styles.smallButton} onPress={onSave}>
              <Text style={styles.smallButtonText}>{saveLabel}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#efe7db",
  },
  loadingScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#efe7db",
  },
  loadingText: {
    marginTop: 14,
    fontSize: 18,
    color: "#17494d",
  },
  navBar: {
    paddingHorizontal: 18,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#efe7db",
  },
  navTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#17494d",
    textTransform: "lowercase",
  },
  navButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#f8f1e8",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 42,
    gap: 14,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  monthArrow: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: "#f8f1e8",
    alignItems: "center",
    justifyContent: "center",
  },
  monthArrowText: {
    fontSize: 32,
    color: "#17494d",
    marginTop: -2,
  },
  monthCenter: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: "#f8f1e8",
    borderRadius: 24,
    alignItems: "center",
  },
  monthTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1d1a17",
  },
  monthHint: {
    marginTop: 4,
    fontSize: 12,
    color: "#6b655c",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  balanceCard: {
    flexBasis: "48%",
    flexGrow: 1,
    backgroundColor: "#fff8ef",
    borderRadius: 20,
    padding: 14,
  },
  balanceCardWide: {
    flexBasis: "100%",
  },
  balanceTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#726b62",
  },
  balanceAmount: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: "800",
    color: "#1d1a17",
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  largeActionButton: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    minHeight: 84,
    justifyContent: "center",
  },
  largeActionTitle: {
    color: "#fff7ef",
    fontSize: 20,
    fontWeight: "800",
    marginTop: 8,
  },
  largeActionSubtitle: {
    marginTop: 4,
    color: "#f4e6da",
    fontSize: 13,
  },
  card: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#fff8ef",
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1d1a17",
  },
  emptyText: {
    color: "#6f685f",
    fontSize: 14,
    lineHeight: 19,
  },
  entrySectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  entrySectionTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  entrySectionSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  entrySectionMeta: {
    color: "#6f685f",
    fontSize: 12,
    fontWeight: "700",
  },
  entrySectionTotal: {
    color: "#17494d",
    fontSize: 13,
    fontWeight: "800",
  },
  entryRow: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee2d5",
    gap: 8,
  },
  entryTopLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  entryTitleWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  entryDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginTop: 2,
  },
  entryName: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#201c19",
  },
  entryAmount: {
    fontSize: 14,
    fontWeight: "800",
    color: "#17494d",
  },
  entryBottomLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    paddingLeft: 18,
  },
  entryMetaWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  entryMeta: {
    fontSize: 12,
    color: "#70685f",
  },
  groupBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#ece3d7",
  },
  groupBadgeText: {
    color: "#514b42",
    fontSize: 11,
    fontWeight: "700",
  },
  entryActions: {
    flexDirection: "row",
    gap: 8,
  },
  iconActionButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#deece8",
  },
  iconActionButtonGhost: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3ddd3",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  headerMainWrap: {
    flex: 1,
    minWidth: 0,
  },
  subtleHeaderActions: {
    flexDirection: "row",
    gap: 4,
    marginTop: 2,
  },
  subtleHeaderButton: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f4ecdf",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1d1a17",
  },
  sectionAmount: {
    fontSize: 20,
    fontWeight: "800",
    color: "#17494d",
  },
  inlineCreator: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  input: {
    flex: 1,
    backgroundColor: "#fff8ef",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#1d1a17",
    fontSize: 16,
  },
  inlineButton: {
    backgroundColor: "#c8774d",
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  inlineButtonText: {
    color: "#fffaf4",
    fontWeight: "800",
    fontSize: 16,
  },
  emptyCard: {
    padding: 18,
    borderRadius: 22,
    backgroundColor: "#fff8ef",
  },
  insightText: {
    color: "#514b42",
    fontSize: 14,
    lineHeight: 20,
  },
  groupBarRow: {
    gap: 6,
  },
  groupBarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  groupBarLabel: {
    color: "#514b42",
    fontSize: 13,
    fontWeight: "700",
  },
  groupBarAmount: {
    color: "#17494d",
    fontSize: 13,
    fontWeight: "800",
  },
  groupBarTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#ebdfd3",
    overflow: "hidden",
  },
  groupBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#c8774d",
  },
  settingsHelp: {
    color: "#6f685f",
    fontSize: 14,
    lineHeight: 20,
  },
  groupList: {
    gap: 10,
  },
  groupSettingsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 4,
  },
  groupSettingsLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  groupSettingsLabel: {
    color: "#1d1a17",
    fontSize: 15,
    fontWeight: "700",
  },
  groupFixedText: {
    color: "#6f685f",
    fontSize: 12,
    fontWeight: "700",
  },
  exportCard: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: "#17494d",
  },
  exportTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff8ef",
  },
  exportText: {
    marginTop: 8,
    color: "#dcebe8",
    fontSize: 15,
    lineHeight: 21,
  },
  backupStatusText: {
    marginTop: 8,
    color: "#cfe3e0",
    fontSize: 13,
    lineHeight: 18,
  },
  exportButton: {
    marginTop: 16,
    alignSelf: "flex-start",
    backgroundColor: "#c8774d",
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  exportButtonText: {
    color: "#fff8ef",
    fontWeight: "800",
    fontSize: 16,
  },
  backupActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    backgroundColor: "#c8774d",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backupActionButtonText: {
    color: "#fff8ef",
    fontWeight: "800",
    fontSize: 15,
  },
  backupActionButtonSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    backgroundColor: "#f2eadf",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backupActionButtonSecondaryText: {
    color: "#17494d",
    fontWeight: "800",
    fontSize: 15,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 21, 24, 0.32)",
    flexDirection: "row",
  },
  menuBackdropTouch: {
    flex: 1,
  },
  menuSheet: {
    width: 260,
    backgroundColor: "#fff8ef",
    paddingTop: Platform.OS === "android" ? (NativeStatusBar.currentHeight ?? 0) + 20 : 24,
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 10,
  },
  menuHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  menuTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#17494d",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "#f6eee4",
  },
  menuItemActive: {
    backgroundColor: "#17494d",
  },
  menuItemText: {
    color: "#17494d",
    fontSize: 15,
    fontWeight: "700",
  },
  menuItemTextActive: {
    color: "#fff8ef",
  },
  menuLanguageBlock: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#eadfd2",
    gap: 10,
  },
  menuLanguageTitle: {
    color: "#6b655c",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  menuLanguageRow: {
    flexDirection: "row",
    gap: 8,
  },
  menuLanguageChip: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: "#f6eee4",
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  menuLanguageChipActive: {
    backgroundColor: "#17494d",
  },
  menuLanguageChipText: {
    color: "#17494d",
    fontSize: 13,
    fontWeight: "700",
  },
  menuLanguageChipTextActive: {
    color: "#fff8ef",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 21, 24, 0.45)",
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    backgroundColor: "#fff8ef",
    borderRadius: 28,
    padding: 20,
    gap: 12,
  },
  renameModalCard: {
    backgroundColor: "#fff8ef",
    borderRadius: 22,
    padding: 18,
    gap: 12,
  },
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1d1a17",
  },
  modalHelperText: {
    color: "#6b655c",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  inputLabel: {
    color: "#514b42",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: -4,
  },
  modalInput: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dacdbd",
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#1d1a17",
    fontSize: 16,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dacdbd",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  dateButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dateButtonLabel: {
    color: "#1d1a17",
    fontSize: 15,
    fontWeight: "700",
  },
  dateButtonHint: {
    marginTop: 2,
    color: "#6b655c",
    fontSize: 12,
  },
  dateActionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: -2,
  },
  dateActionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#f0e5d8",
  },
  dateActionChipText: {
    color: "#17494d",
    fontSize: 12,
    fontWeight: "700",
  },
  pickerWrap: {
    borderRadius: 16,
    backgroundColor: "#f8f1e8",
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  pickerDoneButton: {
    alignSelf: "flex-end",
    marginTop: 6,
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#17494d",
  },
  pickerDoneButtonText: {
    color: "#fff8ef",
    fontSize: 12,
    fontWeight: "700",
  },
  modalGroupWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  modalGroupChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#f0e5d8",
  },
  modalGroupChipActive: {
    backgroundColor: "#17494d",
  },
  modalGroupChipText: {
    color: "#17494d",
    fontSize: 13,
    fontWeight: "700",
  },
  modalGroupChipTextActive: {
    color: "#fff8ef",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 8,
  },
  smallButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#17494d",
    borderRadius: 12,
  },
  smallButtonText: {
    color: "#fff8ef",
    fontWeight: "700",
    fontSize: 13,
  },
  smallButtonGhost: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#efe2d3",
    borderRadius: 12,
  },
  smallButtonGhostText: {
    color: "#7a4a35",
    fontWeight: "700",
    fontSize: 13,
  },
  monthPickerCard: {
    maxHeight: "72%",
    backgroundColor: "#fff8ef",
    borderRadius: 28,
    padding: 18,
  },
  monthOption: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  monthOptionActive: {
    backgroundColor: "#f2eadf",
  },
  monthOptionText: {
    fontSize: 18,
    color: "#1d1a17",
    fontWeight: "700",
  },
  monthPickerClose: {
    marginTop: 14,
    alignSelf: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "#17494d",
  },
  monthPickerCloseText: {
    color: "#fff8ef",
    fontWeight: "700",
  },
});
