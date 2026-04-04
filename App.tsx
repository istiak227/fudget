import { MaterialCommunityIcons } from "@expo/vector-icons";
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

import { AppData, MonthlyEntry, PersonLedger, SavingsAccount } from "./src/types";
import {
  formatMonthLabel,
  getMonthKey,
  getMonthOptions,
  getTodayIso,
  offsetMonth,
} from "./src/utils/date";
import { exportWorkbook } from "./src/utils/export";
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

const NAV_ITEMS: Array<{ key: TabKey; label: string; icon: IconName }> = [
  { key: "monthly", label: "Monthly", icon: "calendar-month-outline" },
  { key: "savings", label: "Savings", icon: "bank-outline" },
  { key: "loans", label: "Loans", icon: "hand-coin-outline" },
  { key: "lending", label: "Lending", icon: "cash-fast" },
  { key: "settings", label: "Settings", icon: "cog-outline" },
];

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
  const [isExporting, setIsExporting] = useState(false);

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

  const [groupDraft, setGroupDraft] = useState("");
  const [monthlyExpanded, setMonthlyExpanded] = useState({
    debits: true,
    credits: true,
  });

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
      Alert.alert("Save issue", "Your latest changes could not be written right now.");
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
    (total, account) => total + sumAmounts(account.credits) - sumAmounts(account.debits),
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
      Alert.alert("Missing details", "Please add a name and amount.");
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
    Alert.alert("Delete item?", "This entry will be removed from the month.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
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
      Alert.alert("Missing details", "Pick an account and add a name and amount.");
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
    Alert.alert("Delete item?", "This savings item will be removed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
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
      Alert.alert("Missing details", "Pick a person and add a name and amount.");
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
    Alert.alert("Delete item?", "This ledger item will be removed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
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
      Alert.alert("Already there", "This group already exists.");
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
      "Remove group?",
      `Entries in ${groupName} will move to ${DEFAULT_GROUP}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
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

  async function onExport() {
    try {
      setIsExporting(true);
      const uri = await exportWorkbook(data);
      Alert.alert("Export ready", `Your Excel file is prepared.\n${uri}`);
    } catch {
      Alert.alert("Export failed", "The Excel file could not be created on this device.");
    } finally {
      setIsExporting(false);
    }
  }

  const topPadding = Platform.OS === "android" ? (NativeStatusBar.currentHeight ?? 0) + 12 : 12;

  if (!isReady) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#17494d" />
        <Text style={styles.loadingText}>Preparing your budget book...</Text>
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
                <Text style={styles.monthTitle}>{formatMonthLabel(currentMonthKey)}</Text>
                <Text style={styles.monthHint}>
                  {currentMonth.debits.length} income • {currentMonth.credits.length} expense
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
              <BalanceCard title="Debits / Income" amount={formatCurrency(monthDebitTotal)} />
              <BalanceCard title="Credits / Expenses" amount={formatCurrency(monthCreditTotal)} />
              <BalanceCard title="Left This Month" amount={formatCurrency(monthBalance)} wide />
            </View>

            <View style={styles.actionRow}>
              <LargeActionButton
                title="Add Debit"
                subtitle="Income or money in"
                color="#1e706b"
                icon="arrow-down-bold-circle-outline"
                onPress={() => openMonthlyModal("debit")}
              />
              <LargeActionButton
                title="Add Credit"
                subtitle="Expense or money out"
                color="#bf5c39"
                icon="arrow-up-bold-circle-outline"
                onPress={() => openMonthlyModal("credit")}
              />
            </View>

            <EntrySection
              title="Debits / Income"
              emptyText="No income saved for this month yet."
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
            />

            <EntrySection
              title="Credits / Expenses"
              emptyText="No expenses saved for this month yet."
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
            />

            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Text style={styles.cardTitle}>Insights</Text>
                <MaterialCommunityIcons name="chart-arc" size={18} color="#17494d" />
              </View>
              <Text style={styles.insightText}>
                {highestExpenseGroup
                  ? `Highest expense this month by group: ${highestExpenseGroup.group} (${formatCurrency(highestExpenseGroup.amount)}).`
                  : "Add expense items to see group insights."}
              </Text>
              {expenseGroups.slice(0, 4).map((item) => (
                <GroupBar
                  key={item.group}
                  label={item.group}
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
              <Text style={styles.sectionTitle}>Savings</Text>
              <Text style={styles.sectionAmount}>{formatCurrency(totalSavings)}</Text>
            </View>

            <View style={styles.inlineCreator}>
              <TextInput
                value={accountNameDraft}
                onChangeText={setAccountNameDraft}
                placeholder="Add savings account"
                placeholderTextColor="#7d786f"
                style={styles.input}
              />
              <Pressable style={styles.inlineButton} onPress={addSavingsAccount}>
                <Text style={styles.inlineButtonText}>Create</Text>
              </Pressable>
            </View>

            {data.savings.length === 0 ? (
              <EmptyCard text="Create your first savings account to start tracking bank, cash, or other savings." />
            ) : (
              data.savings.map((account) => (
                <SavingsCard
                  key={account.id}
                  account={account}
                  onAddCredit={() => openSavingsModal("credit", account.id)}
                  onAddDebit={() => openSavingsModal("debit", account.id)}
                  onEdit={(kind, item) => openSavingsModal(kind, account.id, item)}
                  onDelete={(kind, itemId) => deleteSavingsEntry(kind, account.id, itemId)}
                />
              ))
            )}
          </>
        )}

        {activeTab === "loans" && (
          <PeopleLedgerView
            title="Loans"
            totalLabel="Outstanding Loan"
            totalAmount={totalLoan}
            placeholder="Add person you borrowed from"
            emptyText="Loans are optional, but you can track them here whenever you need."
            people={data.loans}
            personDraft={personNameDraft}
            setPersonDraft={setPersonNameDraft}
            onCreate={() => addPerson("loans")}
            onAddPrimary={(id) => openPersonModal("loans", "borrowed", id)}
            onAddSecondary={(id) => openPersonModal("loans", "repaid", id)}
            primaryLabel="Add Loan"
            secondaryLabel="Add Repayment"
            onEdit={(mode, personId, item) => openPersonModal("loans", mode, personId, item)}
            onDelete={(mode, personId, itemId) =>
              deletePersonEntry("loans", mode, personId, itemId)
            }
          />
        )}

        {activeTab === "lending" && (
          <PeopleLedgerView
            title="Lending"
            totalLabel="Outstanding Lending"
            totalAmount={totalLending}
            placeholder="Add person you lent to"
            emptyText="Lending is optional too, and works the same simple way."
            people={data.lending}
            personDraft={personNameDraft}
            setPersonDraft={setPersonNameDraft}
            onCreate={() => addPerson("lending")}
            onAddPrimary={(id) => openPersonModal("lending", "borrowed", id)}
            onAddSecondary={(id) => openPersonModal("lending", "repaid", id)}
            primaryLabel="Add Lent Amount"
            secondaryLabel="Add Returned Amount"
            onEdit={(mode, personId, item) => openPersonModal("lending", mode, personId, item)}
            onDelete={(mode, personId, itemId) =>
              deletePersonEntry("lending", mode, personId, itemId)
            }
          />
        )}

        {activeTab === "settings" && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Settings</Text>
              <MaterialCommunityIcons name="cog-outline" size={22} color="#17494d" />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Groups</Text>
              <Text style={styles.settingsHelp}>
                Use groups to organize monthly debit and credit items. Entries without a group stay in {DEFAULT_GROUP}.
              </Text>
              <View style={styles.inlineCreator}>
                <TextInput
                  value={groupDraft}
                  onChangeText={setGroupDraft}
                  placeholder="Add a new group"
                  placeholderTextColor="#7d786f"
                  style={styles.input}
                />
                <Pressable style={styles.inlineButton} onPress={addGroup}>
                  <Text style={styles.inlineButtonText}>Add</Text>
                </Pressable>
              </View>
              <View style={styles.groupList}>
                <GroupSettingsRow
                  label={DEFAULT_GROUP}
                  fixed
                />
                {data.groups.map((group) => (
                  <GroupSettingsRow
                    key={group}
                    label={group}
                    onRemove={() => removeGroup(group)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.exportCard}>
              <Text style={styles.exportTitle}>Backup and export</Text>
              <Text style={styles.exportText}>
                Your data stays on this device. You can export everything as an Excel file when needed.
              </Text>
              <Pressable style={styles.exportButton} onPress={onExport} disabled={isExporting}>
                <Text style={styles.exportButtonText}>
                  {isExporting ? "Preparing file..." : "Export Excel File"}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>

      <SideMenu
        visible={menuVisible}
        activeTab={activeTab}
        onClose={() => setMenuVisible(false)}
        onSelect={(tab) => {
          setActiveTab(tab);
          setMenuVisible(false);
        }}
      />

      <MonthPickerModal
        visible={monthModalVisible}
        selectedMonthKey={currentMonthKey}
        onSelect={(monthKey) => {
          setCurrentMonthKey(monthKey);
          setMonthModalVisible(false);
        }}
        onClose={() => setMonthModalVisible(false)}
      />

      <EntryModal
        visible={entryModalVisible}
        title={entryKind === "debit" ? "Debit / Income" : "Credit / Expense"}
        form={entryForm}
        setForm={setEntryForm}
        onClose={() => setEntryModalVisible(false)}
        onSave={saveMonthlyEntry}
        groups={[DEFAULT_GROUP, ...data.groups]}
      />

      <EntryModal
        visible={savingsModalVisible}
        title={savingsKind === "credit" ? "Savings Credit" : "Savings Debit"}
        form={savingsForm}
        setForm={setSavingsForm}
        onClose={() => setSavingsModalVisible(false)}
        onSave={saveSavingsEntry}
      />

      <EntryModal
        visible={personModalVisible}
        title={personMode === "borrowed" ? "Amount" : "Repayment"}
        form={personForm}
        setForm={setPersonForm}
        onClose={() => setPersonModalVisible(false)}
        onSave={() => savePersonEntry(personLedgerType)}
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
}) {
  return (
    <View style={styles.card}>
      <Pressable style={styles.entrySectionHeader} onPress={onToggle}>
        <View style={styles.entrySectionTitleWrap}>
          <MaterialCommunityIcons name={icon} size={18} color={accent} />
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
        <View style={styles.entrySectionSummary}>
          <Text style={styles.entrySectionMeta}>{itemCount} items</Text>
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
                    <Text style={styles.groupBadgeText}>{groupNameOf(item)}</Text>
                  </View>
                ) : null}
                {item.date ? <Text style={styles.entryMeta}>{item.date}</Text> : null}
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
}: {
  account: SavingsAccount;
  onAddCredit: () => void;
  onAddDebit: () => void;
  onEdit: (kind: "credit" | "debit", item: MonthlyEntry) => void;
  onDelete: (kind: "credit" | "debit", itemId: string) => void;
}) {
  const [expanded, setExpanded] = useState({
    credits: true,
    debits: false,
  });
  const total = sumAmounts(account.credits) - sumAmounts(account.debits);

  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <Text style={styles.cardTitle}>{account.name}</Text>
        <Text style={styles.sectionAmount}>{formatCurrency(total)}</Text>
      </View>

      <View style={styles.actionRow}>
        <LargeActionButton
          title="Add Credit"
          subtitle="Save money"
          color="#1e706b"
          icon="plus-circle-outline"
          onPress={onAddCredit}
        />
        <LargeActionButton
          title="Add Debit"
          subtitle="Withdraw money"
          color="#bf5c39"
          icon="minus-circle-outline"
          onPress={onAddDebit}
        />
      </View>

      <EntrySection
        title="Credits"
        emptyText="No savings added yet."
        items={account.credits}
        accent="#1e706b"
        icon="plus-circle-outline"
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
      />

      <EntrySection
        title="Debits"
        emptyText="No withdrawals yet."
        items={account.debits}
        accent="#bf5c39"
        icon="minus-circle-outline"
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
}: {
  person: PersonLedger;
  primaryLabel: string;
  secondaryLabel: string;
  onAddPrimary: () => void;
  onAddSecondary: () => void;
  onEdit: (mode: "borrowed" | "repaid", personId: string, item: MonthlyEntry) => void;
  onDelete: (mode: "borrowed" | "repaid", personId: string, itemId: string) => void;
}) {
  const [expanded, setExpanded] = useState({
    borrowed: true,
    repaid: false,
  });
  const outstanding = sumAmounts(person.borrowed) - sumAmounts(person.repaid);

  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <Text style={styles.cardTitle}>{person.person}</Text>
        <Text style={styles.sectionAmount}>{formatCurrency(outstanding)}</Text>
      </View>

      <View style={styles.actionRow}>
        <LargeActionButton
          title={primaryLabel}
          subtitle="Record amount"
          color="#1e706b"
          icon="plus-circle-outline"
          onPress={onAddPrimary}
        />
        <LargeActionButton
          title={secondaryLabel}
          subtitle="Record return"
          color="#bf5c39"
          icon="minus-circle-outline"
          onPress={onAddSecondary}
        />
      </View>

      <EntrySection
        title="Amounts"
        emptyText="Nothing recorded yet."
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
      />

      <EntrySection
        title="Repayments"
        emptyText="No repayments yet."
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
  onRemove,
}: {
  label: string;
  fixed?: boolean;
  onRemove?: () => void;
}) {
  return (
    <View style={styles.groupSettingsRow}>
      <View style={styles.groupSettingsLabelWrap}>
        <MaterialCommunityIcons name="shape-outline" size={16} color="#17494d" />
        <Text style={styles.groupSettingsLabel}>{label}</Text>
      </View>
      {fixed ? (
        <Text style={styles.groupFixedText}>Default</Text>
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
  onClose,
  onSelect,
}: {
  visible: boolean;
  activeTab: TabKey;
  onClose: () => void;
  onSelect: (tab: TabKey) => void;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.menuBackdrop}>
        <Pressable style={styles.menuBackdropTouch} onPress={onClose} />
        <View style={styles.menuSheet}>
          <View style={styles.menuHeader}>
            <Text style={styles.menuTitle}>Menu</Text>
            <Pressable style={styles.navButton} onPress={onClose}>
              <MaterialCommunityIcons name="close" size={22} color="#17494d" />
            </Pressable>
          </View>
          {NAV_ITEMS.map((item) => (
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
}: {
  visible: boolean;
  title: string;
  form: T;
  setForm: (value: T | ((current: T) => T)) => void;
  onClose: () => void;
  onSave: () => void;
  groups?: string[];
}) {
  const amountInputRef = useRef<TextInput>(null);
  const dateInputRef = useRef<TextInput>(null);

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
            Fill in the item name and amount. Date is optional.
          </Text>

          <Text style={styles.inputLabel}>Name</Text>
          <TextInput
            autoFocus
            value={form.name}
            onChangeText={(name) => setForm((current) => ({ ...current, name }))}
            placeholder="For example Salary or Transport"
            placeholderTextColor="#7d786f"
            style={styles.modalInput}
            returnKeyType="next"
            onSubmitEditing={() => amountInputRef.current?.focus()}
          />

          <Text style={styles.inputLabel}>Amount</Text>
          <TextInput
            ref={amountInputRef}
            value={form.amount}
            onChangeText={(amount) => setForm((current) => ({ ...current, amount }))}
            placeholder="0"
            placeholderTextColor="#7d786f"
            keyboardType="decimal-pad"
            style={styles.modalInput}
            returnKeyType="next"
            onSubmitEditing={() => dateInputRef.current?.focus()}
          />

          {groups ? (
            <>
              <Text style={styles.inputLabel}>Group</Text>
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
                      {group}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          <Text style={styles.inputLabel}>Date</Text>
          <TextInput
            ref={dateInputRef}
            value={form.date}
            onChangeText={(date) => setForm((current) => ({ ...current, date }))}
            placeholder="Date (optional, YYYY-MM-DD)"
            placeholderTextColor="#7d786f"
            style={styles.modalInput}
            returnKeyType="done"
            onSubmitEditing={onSave}
          />

          <View style={styles.modalActions}>
            <Pressable style={styles.smallButtonGhost} onPress={onClose}>
              <Text style={styles.smallButtonGhostText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.smallButton} onPress={onSave}>
              <Text style={styles.smallButtonText}>Save</Text>
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
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedMonthKey: string;
  onSelect: (monthKey: string) => void;
  onClose: () => void;
}) {
  const options = useMemo(() => getMonthOptions(selectedMonthKey, 24), [selectedMonthKey]);

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.modalBackdrop}>
        <View style={styles.monthPickerCard}>
          <Text style={styles.modalTitle}>Jump to month</Text>
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
            <Text style={styles.monthPickerCloseText}>Close</Text>
          </Pressable>
        </View>
      </View>
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
    alignItems: "center",
    gap: 12,
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
