import * as Clipboard from 'expo-clipboard';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  deleteBrand,
  deleteChild,
  deleteFitCheck,
  getBrands,
  getChildren,
  getFitChecks,
  saveBrand,
  saveChild,
  saveFitCheck,
} from './src/storage';
import {
  Child,
  FitCheck,
  FitCheckInput,
  FitPreference,
  Gender,
  GrowthRecord,
  ProductCategory,
  ProductCondition,
  ProductMeasurements,
  RegisteredBrand,
  SizeCategoryKey,
  SizeFitStatus,
  SizeRecord,
} from './src/types';
import { judgeFit, latestGrowthRecord } from './src/utils/fitJudge';

type Screen =
  | { name: 'home' }
  | { name: 'brandForm' }
  | { name: 'recordChoice'; child: Child }
  | { name: 'childForm'; child?: Child; recordChoice?: RecordChoice; profileOnly?: boolean }
  | { name: 'records'; child: Child }
  | { name: 'judgeForm' }
  | { name: 'result'; child: Child; input: FitCheckInput; fitCheck?: FitCheck }
  | { name: 'history' }
  | { name: 'historyDetail'; fitCheck: FitCheck };

const categories: Array<{ label: string; value: ProductCategory }> = [
  { label: 'トップス', value: 'tops' },
  { label: 'ボトムス', value: 'bottoms' },
  { label: 'アウター', value: 'outerwear' },
  { label: '靴', value: 'shoes' },
  { label: '帽子', value: 'hat' },
];

const fits: Array<{ label: string; value: FitPreference }> = [
  { label: 'ぴったり', value: 'just' },
  { label: '少し大きめ', value: 'slightly_large' },
  { label: '来季も着たい', value: 'next_season' },
];

const genders: Array<{ label: string; value: Gender }> = [
  { label: '男の子', value: 'boy' },
  { label: '女の子', value: 'girl' },
  { label: '未選択', value: 'unspecified' },
];

const conditions: Array<{ label: string; value: ProductCondition }> = [
  { label: '新品', value: 'new' },
  { label: '中古', value: 'used' },
];

const sizeFits: Array<{ label: string; value: SizeFitStatus }> = [
  { label: '着れない', value: 'unwearable' },
  { label: '小さい', value: 'small' },
  { label: 'ぴったり', value: 'just' },
  { label: '大きい', value: 'large' },
  { label: 'ぶかぶか', value: 'huge' },
];

type RecordChoice = 'growth' | SizeCategoryKey;

const sizeCategories: Array<{ label: string; value: SizeCategoryKey; placeholder: string }> = [
  { label: '下着', value: 'underwearRecords', placeholder: '例: 120' },
  { label: 'トップス', value: 'topsRecords', placeholder: '例: 120' },
  { label: 'ボトムス', value: 'bottomsRecords', placeholder: '例: 120' },
  { label: '靴下', value: 'sockRecords', placeholder: '例: 16-18' },
  { label: '靴', value: 'shoeRecords', placeholder: '例: 18.0' },
];

const clothingSizeOptions = Array.from({ length: 21 }, (_, index) => String(70 + index * 5));
const sockSizeOptions = Array.from({ length: 18 }, (_, index) => String(7 + index));
const shoeSizeOptions = Array.from({ length: 27 }, (_, index) => (12 + index * 0.5).toFixed(1));

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 18 }, (_, index) => String(currentYear - index));
const months = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
const days = Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, '0'));

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function todayText(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function numberOrUndefined(value: string): number | undefined {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function splitDate(value?: string): [string, string, string] {
  const [year = '', month = '', day = ''] = (value ?? '').split('-');
  return [year, month, day];
}

function joinDate(year: string, month: string, day: string): string | undefined {
  if (!year || !month || !day) return undefined;
  return `${year}-${month}-${day}`;
}

function formatAge(birthDate?: string): string {
  if (!birthDate) return '生年月日未登録';
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return '生年月日未登録';
  const now = new Date();
  let monthsSinceBirth = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) monthsSinceBirth -= 1;
  if (monthsSinceBirth < 0) return '生年月日未登録';
  const ageYears = Math.floor(monthsSinceBirth / 12);
  const ageMonths = monthsSinceBirth % 12;
  return ageYears > 0 ? `${ageYears}歳${ageMonths}か月` : `${ageMonths}か月`;
}

function categoryLabel(value: ProductCategory): string {
  return categories.find((item) => item.value === value)?.label ?? value;
}

function resultColor(label: string): string {
  if (label.startsWith('◎')) return '#15803d';
  if (label.startsWith('○')) return '#2563eb';
  if (label.startsWith('△ 小')) return '#dc2626';
  if (label.startsWith('△')) return '#ea580c';
  return '#6b7280';
}

function sortedGrowthRecords(child: Child): GrowthRecord[] {
  const records = [...(child.growthRecords ?? [])];
  if ((child.heightCm || child.weightKg) && !records.some((record) => record.id === 'legacy')) {
    records.push({
      id: 'legacy',
      measuredAt: child.updatedAt?.slice(0, 10) || child.createdAt?.slice(0, 10) || todayText(),
      heightCm: child.heightCm,
      weightKg: child.weightKg,
    });
  }
  return records.sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime());
}

function sizeFitLabel(value: SizeFitStatus): string {
  return sizeFits.find((item) => item.value === value)?.label ?? value;
}

function normalizeSizeRecords(records?: SizeRecord[], legacySize?: string): SizeRecord[] {
  if (records?.length) return sortSizeRecords(records);
  return legacySize ? [{ id: 'legacy', size: legacySize, fit: 'just' }] : [];
}

function sizeSortValue(size: string): number {
  const match = size.match(/\d+(?:\.\d+)?/);
  return match ? Number.parseFloat(match[0]) : Number.MAX_SAFE_INTEGER;
}

function sortSizeRecords(records: SizeRecord[]): SizeRecord[] {
  const seen = new Set<string>();
  return records
    .filter((record) => record.size.trim())
    .filter((record) => {
      const key = `${record.size.trim()}__${record.fit}__${record.brand?.trim() ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const numeric = sizeSortValue(a.size) - sizeSortValue(b.size);
      if (numeric !== 0) return numeric;
      const sizeText = a.size.localeCompare(b.size, 'ja');
      if (sizeText !== 0) return sizeText;
      return sizeFitLabel(a.fit).localeCompare(sizeFitLabel(b.fit), 'ja');
    });
}

function sizeOptionsFor(category: SizeCategoryKey): string[] {
  if (category === 'shoeRecords') return shoeSizeOptions;
  if (category === 'sockRecords') return sockSizeOptions;
  return clothingSizeOptions;
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[styles.input, multiline && styles.textArea]}
      />
    </View>
  );
}

function SelectBox({
  label,
  value,
  options,
  onChange,
  placeholder = '選択',
  formatOption,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  formatOption?: (value: string) => string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.selectWrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.inputButton} onPress={() => setOpen(true)}>
        <Text style={value ? styles.inputButtonText : styles.placeholderText}>
          {value ? (formatOption ? formatOption(value) : value) : placeholder}
        </Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <View style={styles.modalSheet}>
            <ScrollView>
              {options.map((option) => (
                <Pressable
                  key={option}
                  style={styles.optionRow}
                  onPress={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                >
                  <Text style={styles.optionText}>{formatOption ? formatOption(option) : option}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function DateSelect({
  label,
  year,
  month,
  day,
  onChange,
}: {
  label: string;
  year: string;
  month: string;
  day: string;
  onChange: (parts: [string, string, string]) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.dateRow}>
        <SelectBox label="年" value={year} options={years} onChange={(value) => onChange([value, month, day])} formatOption={(value) => `${value}年`} />
        <SelectBox label="月" value={month} options={months} onChange={(value) => onChange([year, value, day])} formatOption={(value) => `${value}月`} />
        <SelectBox label="日" value={day} options={days} onChange={(value) => onChange([year, month, value])} formatOption={(value) => `${value}日`} />
      </View>
    </View>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ label: string; value: T }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmentWrap}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          onPress={() => onChange(option.value)}
          style={[styles.segment, value === option.value && styles.segmentActive]}
        >
          <Text style={[styles.segmentText, value === option.value && styles.segmentTextActive]}>
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function RadioGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ label: string; value: T }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.radioRow}>
      {options.map((option) => (
        <Pressable key={option.value} style={styles.radioItem} onPress={() => onChange(option.value)}>
          <View style={[styles.radioOuter, value === option.value && styles.radioOuterActive]}>
            {value === option.value ? <View style={styles.radioInner} /> : null}
          </View>
          <Text style={styles.bodyText}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [children, setChildren] = useState<Child[]>([]);
  const [history, setHistory] = useState<FitCheck[]>([]);
  const [brands, setBrands] = useState<RegisteredBrand[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [savedChildren, savedHistory, savedBrands] = await Promise.all([getChildren(), getFitChecks(), getBrands()]);
    setChildren(savedChildren);
    setHistory(savedHistory);
    setBrands(savedBrands);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const content = useMemo(() => {
    if (loading) return <Text style={styles.emptyText}>読み込み中...</Text>;
    if (screen.name === 'home') {
      return (
        <Home
          children={children}
          historyCount={history.length}
          brandCount={brands.length}
          onAdd={() => setScreen({ name: 'childForm', profileOnly: true })}
          onAddBrand={() => setScreen({ name: 'brandForm' })}
          onEdit={(child) => setScreen({ name: 'childForm', child, profileOnly: true })}
          onAddRecord={(child) => setScreen({ name: 'recordChoice', child })}
          onRecords={(child) => setScreen({ name: 'records', child })}
          onHistory={() => setScreen({ name: 'history' })}
          onDelete={async (child) => {
            await deleteChild(child.id);
            await refresh();
          }}
        />
      );
    }
    if (screen.name === 'brandForm') {
      return (
        <BrandForm
          brands={brands}
          onCancel={() => setScreen({ name: 'home' })}
          onSave={async (brand) => {
            await saveBrand(brand);
            await refresh();
            setScreen({ name: 'home' });
          }}
          onDelete={async (id) => {
            await deleteBrand(id);
            await refresh();
          }}
        />
      );
    }
    if (screen.name === 'records') {
      const freshChild = children.find((child) => child.id === screen.child.id) ?? screen.child;
      return (
        <RecordsScreen
          child={freshChild}
          onBack={() => setScreen({ name: 'home' })}
          onSave={async (child) => {
            await saveChild(child);
            await refresh();
          }}
        />
      );
    }
    if (screen.name === 'recordChoice') {
      const freshChild = children.find((child) => child.id === screen.child.id) ?? screen.child;
      return (
        <RecordChoiceScreen
          child={freshChild}
          onBack={() => setScreen({ name: 'home' })}
          onSelect={(recordChoice) => setScreen({ name: 'childForm', child: freshChild, recordChoice })}
        />
      );
    }
    if (screen.name === 'childForm') {
      return (
        <ChildForm
          child={screen.child}
          recordChoice={screen.recordChoice}
          profileOnly={screen.profileOnly}
          brands={brands}
          onCancel={() => setScreen({ name: 'home' })}
          onSave={async (child) => {
            await saveChild(child);
            await refresh();
            setScreen({ name: 'home' });
          }}
        />
      );
    }
    if (screen.name === 'judgeForm') {
      return (
        <JudgeForm
          children={children}
          onCancel={() => setScreen({ name: 'home' })}
          onJudge={(child, input) => setScreen({ name: 'result', child, input })}
        />
      );
    }
    if (screen.name === 'result') {
      return (
        <Result
          child={screen.child}
          input={screen.input}
          saved={screen.fitCheck}
          onHome={() => setScreen({ name: 'home' })}
          onRetry={() => setScreen({ name: 'judgeForm' })}
          onSave={async (fitCheck) => {
            await saveFitCheck(fitCheck);
            await refresh();
            setScreen({ name: 'result', child: screen.child, input: screen.input, fitCheck });
          }}
        />
      );
    }
    if (screen.name === 'history') {
      return (
        <History
          history={history}
          children={children}
          onBack={() => setScreen({ name: 'home' })}
          onOpen={(fitCheck) => setScreen({ name: 'historyDetail', fitCheck })}
          onDelete={async (fitCheck) => {
            await deleteFitCheck(fitCheck.id);
            await refresh();
          }}
        />
      );
    }
    return (
      <HistoryDetail
        fitCheck={screen.fitCheck}
        child={children.find((child) => child.id === screen.fitCheck.childId)}
        onBack={() => setScreen({ name: 'history' })}
        onDelete={async () => {
          await deleteFitCheck(screen.fitCheck.id);
          await refresh();
          setScreen({ name: 'history' });
        }}
      />
    );
  }, [children, history, loading, refresh, screen]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.appName}>これ着れる？</Text>
          <Text style={styles.subtitle}>子供服・靴のサイズを買う前にチェック</Text>
        </View>
        {content}
      </ScrollView>
    </SafeAreaView>
  );
}

function Home(props: {
  children: Child[];
  historyCount: number;
  brandCount: number;
  onAdd: () => void;
  onAddBrand: () => void;
  onEdit: (child: Child) => void;
  onAddRecord: (child: Child) => void;
  onDelete: (child: Child) => void;
  onRecords: (child: Child) => void;
  onHistory: () => void;
}) {
  return (
    <View>
      <View style={styles.actionsRow}>
        <Pressable style={styles.primaryButtonFlex} onPress={props.onAdd}>
          <Text style={styles.primaryButtonText}>子供を追加</Text>
        </Pressable>
        <Pressable style={styles.secondaryButtonFlex} onPress={props.onAddBrand}>
          <Text style={styles.secondaryButtonText}>ブランドを追加</Text>
        </Pressable>
      </View>
      <Pressable style={styles.secondaryButton} onPress={props.onHistory}>
        <Text style={styles.secondaryButtonText}>判定履歴を見る（{props.historyCount}件）</Text>
      </Pressable>
      <Text style={styles.sectionTitle}>登録済みの子供</Text>
      {props.children.length === 0 ? (
        <Text style={styles.emptyText}>まずは子供情報を登録してください。</Text>
      ) : (
        props.children.map((child) => {
          const latest = latestGrowthRecord(child);
          const records = sortedGrowthRecords(child);
          return (
            <View key={child.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.childName}>{child.name}</Text>
                  <Text style={styles.muted}>
                    {formatAge(child.birthDate)} ・ {genders.find((item) => item.value === (child.gender ?? 'unspecified'))?.label}
                  </Text>
                </View>
                <Pressable style={styles.headerEditButton} onPress={() => props.onEdit(child)}>
                  <Text style={styles.headerEditText}>子供の情報を編集</Text>
                </Pressable>
              </View>
              <View style={styles.currentMetrics}>
                <Text style={styles.bodyText}>
                  {latest
                    ? `身長 ${latest.heightCm ? `${latest.heightCm}cm` : '-'}／体重 ${latest.weightKg ? `${latest.weightKg}kg` : '-'}`
                    : '身長・体重の記録はまだありません'}
                </Text>
              </View>
              <SizeSummary title="下着" records={normalizeSizeRecords(child.underwearRecords)} />
              <SizeSummary title="トップス" records={normalizeSizeRecords(child.topsRecords, child.topsSize)} />
              <SizeSummary title="ボトムス" records={normalizeSizeRecords(child.bottomsRecords, child.bottomsSize)} />
              <SizeSummary title="靴下" records={normalizeSizeRecords(child.sockRecords)} />
              <SizeSummary title="靴" records={normalizeSizeRecords(child.shoeRecords, child.shoeSize)} isLast />
              <View style={styles.cardActions}>
                <Pressable style={styles.smallButton} onPress={() => props.onAddRecord(child)}>
                  <Text style={styles.smallButtonText}>情報を追加</Text>
                </Pressable>
                <Pressable style={styles.secondaryMiniButton} onPress={() => props.onRecords(child)}>
                  <Text style={styles.secondaryButtonText}>記録を見る</Text>
                </Pressable>
                <Pressable
                  style={styles.dangerButton}
                  onPress={() =>
                    Alert.alert('削除しますか？', `${child.name}の情報と履歴を削除します。`, [
                      { text: 'キャンセル', style: 'cancel' },
                      { text: '削除', style: 'destructive', onPress: () => props.onDelete(child) },
                    ])
                  }
                >
                  <Text style={styles.dangerButtonText}>削除</Text>
                </Pressable>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const legacySizeProps: Partial<Record<SizeCategoryKey, 'topsSize' | 'bottomsSize' | 'shoeSize'>> = {
  topsRecords: 'topsSize',
  bottomsRecords: 'bottomsSize',
  shoeRecords: 'shoeSize',
};

function syncLegacySizes(child: Child): void {
  (Object.entries(legacySizeProps) as Array<[SizeCategoryKey, 'topsSize' | 'bottomsSize' | 'shoeSize']>).forEach(
    ([recordsField, legacyField]) => {
      if (child[recordsField]?.length) child[legacyField] = child[recordsField][0].size;
    },
  );
}

function GrowthEditForm({
  record,
  onCancel,
  onSave,
}: {
  record: GrowthRecord;
  onCancel: () => void;
  onSave: (measuredAt: string, heightCm?: number, weightKg?: number) => void;
}) {
  const initial = splitDate(record.measuredAt);
  const [year, setYear] = useState(initial[0]);
  const [month, setMonth] = useState(initial[1]);
  const [day, setDay] = useState(initial[2]);
  const [heightCm, setHeightCm] = useState(record.heightCm ? String(record.heightCm) : '');
  const [weightKg, setWeightKg] = useState(record.weightKg ? String(record.weightKg) : '');

  function submit() {
    const measuredAt = joinDate(year, month, day);
    if (!measuredAt) {
      Alert.alert('記録日を選択してください', '年・月・日を選んでください。');
      return;
    }
    const height = numberOrUndefined(heightCm);
    const weight = numberOrUndefined(weightKg);
    if (!height && !weight) {
      Alert.alert('入力を確認してください', '身長か体重のどちらかは入力してください。');
      return;
    }
    onSave(measuredAt, height, weight);
  }

  return (
    <View style={styles.editBox}>
      <DateSelect
        label="記録日"
        year={year}
        month={month}
        day={day}
        onChange={([nextYear, nextMonth, nextDay]) => {
          setYear(nextYear);
          setMonth(nextMonth);
          setDay(nextDay);
        }}
      />
      <Field label="身長 cm（任意）" value={heightCm} onChangeText={setHeightCm} keyboardType="numeric" placeholder="例: 123" />
      <Field label="体重 kg（任意）" value={weightKg} onChangeText={setWeightKg} keyboardType="numeric" placeholder="例: 32" />
      <View style={styles.actionsRow}>
        <Pressable style={styles.secondaryButtonFlex} onPress={onCancel}>
          <Text style={styles.secondaryButtonText}>やめる</Text>
        </Pressable>
        <Pressable style={styles.primaryButtonFlex} onPress={submit}>
          <Text style={styles.primaryButtonText}>保存</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SizeEditForm({
  category,
  record,
  onCancel,
  onSave,
}: {
  category: SizeCategoryKey;
  record: SizeRecord;
  onCancel: () => void;
  onSave: (size: string, fit: SizeFitStatus, brand?: string) => void;
}) {
  const [size, setSize] = useState(record.size);
  const [fit, setFit] = useState<SizeFitStatus>(record.fit ?? 'just');
  const [brand, setBrand] = useState(record.brand ?? '');

  function submit() {
    if (!size.trim()) {
      Alert.alert('入力を確認してください', 'サイズを選んでください。');
      return;
    }
    onSave(size.trim(), fit, brand.trim() || undefined);
  }

  return (
    <View style={styles.editBox}>
      <SelectBox label="サイズ" value={size} options={sizeOptionsFor(category)} onChange={setSize} placeholder="サイズを選択" />
      <Text style={styles.label}>着用感</Text>
      <Segmented options={sizeFits} value={fit} onChange={setFit} />
      <Field label="メーカー・ブランド（任意）" value={brand} onChangeText={setBrand} placeholder="例: UNIQLO" />
      <View style={styles.actionsRow}>
        <Pressable style={styles.secondaryButtonFlex} onPress={onCancel}>
          <Text style={styles.secondaryButtonText}>やめる</Text>
        </Pressable>
        <Pressable style={styles.primaryButtonFlex} onPress={submit}>
          <Text style={styles.primaryButtonText}>保存</Text>
        </Pressable>
      </View>
    </View>
  );
}

function RecordsScreen(props: { child: Child; onBack: () => void; onSave: (child: Child) => void }) {
  const [editTarget, setEditTarget] = useState<{ type: 'growth' | SizeCategoryKey; id: string } | null>(null);
  const growthRecords = sortedGrowthRecords(props.child);
  const graphRecords = [...growthRecords].reverse();
  const maxHeight = Math.max(...graphRecords.map((record) => record.heightCm ?? 0), 1);
  const maxWeight = Math.max(...graphRecords.map((record) => record.weightKg ?? 0), 1);
  const groups: Array<{ category: SizeCategoryKey; title: string; records: SizeRecord[] }> = [
    { category: 'underwearRecords', title: '下着', records: normalizeSizeRecords(props.child.underwearRecords) },
    { category: 'topsRecords', title: 'トップス', records: normalizeSizeRecords(props.child.topsRecords, props.child.topsSize) },
    { category: 'bottomsRecords', title: 'ボトムス', records: normalizeSizeRecords(props.child.bottomsRecords, props.child.bottomsSize) },
    { category: 'sockRecords', title: '靴下', records: normalizeSizeRecords(props.child.sockRecords) },
    { category: 'shoeRecords', title: '靴', records: normalizeSizeRecords(props.child.shoeRecords, props.child.shoeSize) },
  ];

  function persist(child: Child) {
    setEditTarget(null);
    props.onSave({ ...child, updatedAt: new Date().toISOString() });
  }

  function saveGrowth(record: GrowthRecord, measuredAt: string, heightCm?: number, weightKg?: number) {
    const child = { ...props.child };
    if (record.id === 'legacy') {
      child.growthRecords = [...(child.growthRecords ?? []), { id: makeId(), measuredAt, heightCm, weightKg }];
      child.heightCm = undefined;
      child.weightKg = undefined;
    } else {
      child.growthRecords = (child.growthRecords ?? []).map((item) =>
        item.id === record.id ? { ...item, measuredAt, heightCm, weightKg } : item,
      );
    }
    persist(child);
  }

  function deleteGrowth(record: GrowthRecord) {
    Alert.alert('この身長・体重の記録を削除しますか？', `${record.measuredAt}の記録を削除します。`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => {
          const child = { ...props.child };
          if (record.id === 'legacy') {
            child.heightCm = undefined;
            child.weightKg = undefined;
          } else {
            child.growthRecords = (child.growthRecords ?? []).filter((item) => item.id !== record.id);
          }
          persist(child);
        },
      },
    ]);
  }

  function saveSize(category: SizeCategoryKey, record: SizeRecord, size: string, fit: SizeFitStatus, brand?: string) {
    const child = { ...props.child };
    const legacyProp = legacySizeProps[category];
    if (record.id === 'legacy') {
      child[category] = sortSizeRecords([...(child[category] ?? []), { id: makeId(), size, fit, brand }]);
      if (legacyProp) child[legacyProp] = '';
    } else {
      child[category] = sortSizeRecords(
        (child[category] ?? []).map((item) => (item.id === record.id ? { ...item, size, fit, brand } : item)),
      );
    }
    syncLegacySizes(child);
    persist(child);
  }

  function deleteSize(category: SizeCategoryKey, record: SizeRecord) {
    Alert.alert('この記録を削除しますか？', `${formatSizeRecord(record)} を削除します。`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => {
          const child = { ...props.child };
          const legacyProp = legacySizeProps[category];
          if (record.id === 'legacy') {
            if (legacyProp) child[legacyProp] = '';
          } else {
            child[category] = (child[category] ?? []).filter((item) => item.id !== record.id);
            if (legacyProp && child[category].length === 0) child[legacyProp] = '';
          }
          syncLegacySizes(child);
          persist(child);
        },
      },
    ]);
  }

  return (
    <View>
      <Text style={styles.sectionTitle}>{props.child.name}の記録</Text>
      <Pressable style={styles.secondaryButton} onPress={props.onBack}>
        <Text style={styles.secondaryButtonText}>ホームへ戻る</Text>
      </Pressable>
      <View style={styles.card}>
        <Text style={styles.noticeTitle}>身長・体重</Text>
        {growthRecords.length === 0 ? (
          <Text style={styles.emptyText}>まだ記録がありません。</Text>
        ) : (
          growthRecords.map((record) =>
            editTarget?.type === 'growth' && editTarget.id === record.id ? (
              <GrowthEditForm
                key={record.id}
                record={record}
                onCancel={() => setEditTarget(null)}
                onSave={(measuredAt, heightCm, weightKg) => saveGrowth(record, measuredAt, heightCm, weightKg)}
              />
            ) : (
              <View key={record.id} style={styles.recordLine}>
                <Text style={styles.recordLineText}>
                  {record.measuredAt}  {record.heightCm ? `${record.heightCm}cm` : '身長 -'}  {record.weightKg ? `${record.weightKg}kg` : '体重 -'}
                </Text>
                <View style={styles.recordActions}>
                  <Pressable style={styles.miniEditButton} onPress={() => setEditTarget({ type: 'growth', id: record.id })}>
                    <Text style={styles.miniEditText}>編集</Text>
                  </Pressable>
                  <Pressable style={styles.miniDangerButton} onPress={() => deleteGrowth(record)}>
                    <Text style={styles.miniDangerText}>削除</Text>
                  </Pressable>
                </View>
              </View>
            ),
          )
        )}
      </View>
      {graphRecords.length > 0 ? (
        <View style={styles.card}>
          <LineGraph title="身長のグラフ" color="#16a34a" unit="cm" records={graphRecords} getValue={(record) => record.heightCm} maxValue={maxHeight} />
          <LineGraph title="体重のグラフ" color="#2563eb" unit="kg" records={graphRecords} getValue={(record) => record.weightKg} maxValue={maxWeight} />
        </View>
      ) : null}
      {groups.map((group) => (
        <View key={group.category} style={styles.card}>
          <Text style={styles.noticeTitle}>{group.title}サイズ感</Text>
          {group.records.length === 0 ? (
            <Text style={styles.muted}>まだ記録がありません。</Text>
          ) : (
            group.records.map((record) =>
              editTarget?.type === group.category && editTarget.id === record.id ? (
                <SizeEditForm
                  key={record.id}
                  category={group.category}
                  record={record}
                  onCancel={() => setEditTarget(null)}
                  onSave={(size, fit, brand) => saveSize(group.category, record, size, fit, brand)}
                />
              ) : (
                <View key={record.id} style={styles.recordLine}>
                  <Text style={styles.recordLineText}>{formatSizeRecord(record)}</Text>
                  <View style={styles.recordActions}>
                    <Pressable style={styles.miniEditButton} onPress={() => setEditTarget({ type: group.category, id: record.id })}>
                      <Text style={styles.miniEditText}>編集</Text>
                    </Pressable>
                    <Pressable style={styles.miniDangerButton} onPress={() => deleteSize(group.category, record)}>
                      <Text style={styles.miniDangerText}>削除</Text>
                    </Pressable>
                  </View>
                </View>
              ),
            )
          )}
        </View>
      ))}
    </View>
  );
}

function BrandForm({
  brands,
  onCancel,
  onSave,
  onDelete,
}: {
  brands: RegisteredBrand[];
  onCancel: () => void;
  onSave: (brand: RegisteredBrand) => void;
  onDelete: (id: string) => void;
}) {
  const [editingBrand, setEditingBrand] = useState<RegisteredBrand | null>(null);
  const [name, setName] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<SizeCategoryKey[]>([]);

  function toggleCategory(value: SizeCategoryKey) {
    setSelectedCategories((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }

  function startEdit(brand: RegisteredBrand) {
    setEditingBrand(brand);
    setName(brand.name);
    setSelectedCategories([...brand.categories]);
  }

  function confirmDelete(brand: RegisteredBrand) {
    Alert.alert('このブランドを削除しますか？', `「${brand.name}」を削除します。記録済みのサイズデータは消えません。`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => {
          if (editingBrand?.id === brand.id) {
            setEditingBrand(null);
            setName('');
            setSelectedCategories([]);
          }
          onDelete(brand.id);
        },
      },
    ]);
  }

  function submit() {
    if (!name.trim() || selectedCategories.length === 0) {
      Alert.alert('入力を確認してください', 'ブランド名とカテゴリを選んでください。');
      return;
    }
    onSave({
      id: editingBrand?.id ?? makeId(),
      name: name.trim(),
      categories: selectedCategories,
      createdAt: editingBrand?.createdAt ?? new Date().toISOString(),
    });
  }

  return (
    <View>
      <Text style={styles.sectionTitle}>{editingBrand ? 'ブランドを編集' : 'ブランドを追加'}</Text>
      <Field label="ブランド名" value={name} onChangeText={setName} placeholder="例: UNIQLO" />
      <Text style={styles.label}>使うカテゴリ</Text>
      <View style={styles.segmentWrap}>
        {sizeCategories.map((category) => (
          <Pressable
            key={category.value}
            style={[styles.segment, selectedCategories.includes(category.value) && styles.segmentActive]}
            onPress={() => toggleCategory(category.value)}
          >
            <Text style={[styles.segmentText, selectedCategories.includes(category.value) && styles.segmentTextActive]}>
              {selectedCategories.includes(category.value) ? '✓ ' : ''}
              {category.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {brands.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.noticeTitle}>登録済みブランド</Text>
          {brands.map((brand) => (
            <View key={brand.id} style={styles.recordLine}>
              <Text style={styles.recordLineText}>
                {brand.name} / {brand.categories.map((value) => sizeCategories.find((item) => item.value === value)?.label).join('・')}
              </Text>
              <View style={styles.recordActions}>
                <Pressable style={styles.miniEditButton} onPress={() => startEdit(brand)}>
                  <Text style={styles.miniEditText}>編集</Text>
                </Pressable>
                <Pressable style={styles.miniDangerButton} onPress={() => confirmDelete(brand)}>
                  <Text style={styles.miniDangerText}>削除</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.actionsRow}>
        <Pressable style={styles.secondaryButtonFlex} onPress={onCancel}>
          <Text style={styles.secondaryButtonText}>戻る</Text>
        </Pressable>
        <Pressable style={styles.primaryButtonFlex} onPress={submit}>
          <Text style={styles.primaryButtonText}>{editingBrand ? '変更を保存' : '保存'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function formatSizeRecord(record: SizeRecord): string {
  return `${record.size} ${sizeFitLabel(record.fit)}${record.brand ? `（${record.brand}）` : ''}`;
}

function groupedSizeLines(records: SizeRecord[]): Array<{ size: string; detail: string }> {
  const groups = new Map<string, Map<SizeFitStatus, string[]>>();
  records.forEach((record) => {
    const key = record.size.trim();
    const fitMap = groups.get(key) ?? new Map<SizeFitStatus, string[]>();
    const brands = fitMap.get(record.fit) ?? [];
    if (record.brand?.trim() && !brands.includes(record.brand.trim())) {
      brands.push(record.brand.trim());
    }
    fitMap.set(record.fit, brands);
    groups.set(key, fitMap);
  });
  return Array.from(groups.entries()).map(([size, fitMap]) => {
    const detail = Array.from(fitMap.entries())
      .map(([fit, brands]) => `${sizeFitLabel(fit)}${brands.length ? `（${brands.join('、')}）` : ''}`)
      .join('、');
    return { size, detail };
  });
}

function RecordChoiceScreen({
  child,
  onBack,
  onSelect,
}: {
  child: Child;
  onBack: () => void;
  onSelect: (choice: RecordChoice) => void;
}) {
  const choices: Array<{ label: string; value: RecordChoice }> = [
    { label: '身長／体重', value: 'growth' },
    ...sizeCategories.map((item) => ({ label: item.label, value: item.value })),
  ];
  return (
    <View>
      <Text style={styles.sectionTitle}>何を追加する？</Text>
      <View style={styles.card}>
        <Text style={styles.childName}>{child.name}</Text>
        <Text style={styles.muted}>{formatAge(child.birthDate)}</Text>
      </View>
      <View style={styles.choiceGrid}>
        {choices.map((choice) => (
          <Pressable key={choice.value} style={styles.choiceButton} onPress={() => onSelect(choice.value)}>
            <Text style={styles.choiceButtonText}>{choice.label}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable style={styles.secondaryButton} onPress={onBack}>
        <Text style={styles.secondaryButtonText}>戻る</Text>
      </Pressable>
    </View>
  );
}

function SizeSummary({ title, records, isLast = false }: { title: string; records: SizeRecord[]; isLast?: boolean }) {
  return (
    <View style={[styles.sizeSummaryRow, isLast && styles.sizeSummaryLast]}>
      <Text style={styles.sizeSummaryTitle}>{title}</Text>
      <View style={styles.sizeSummaryItems}>
        {records.length === 0 ? (
          <Text style={styles.muted}>未記録</Text>
        ) : (
          groupedSizeLines(records).slice(0, 3).map((line) => (
            <Text key={line.size} style={styles.sizeSummaryText}>
              {line.size} {line.detail}
            </Text>
          ))
        )}
      </View>
    </View>
  );
}

function LineGraph({
  title,
  color,
  unit,
  records,
  getValue,
  maxValue,
}: {
  title: string;
  color: string;
  unit: string;
  records: GrowthRecord[];
  getValue: (record: GrowthRecord) => number | undefined;
  maxValue: number;
}) {
  const points = records
    .map((record, index) => ({ record, value: getValue(record), index }))
    .filter((item): item is { record: GrowthRecord; value: number; index: number } => Boolean(item.value));
  const chartWidth = 260;
  const chartHeight = 120;
  const step = points.length > 1 ? chartWidth / (points.length - 1) : 0;
  const plotted = points.map((point, index) => ({
    ...point,
    x: points.length > 1 ? index * step : chartWidth / 2,
    y: chartHeight - (point.value / maxValue) * chartHeight,
  }));

  return (
    <View style={styles.lineGraphBlock}>
      <Text style={[styles.noticeTitle, { color }]}>{title}</Text>
      {plotted.length === 0 ? (
        <Text style={styles.muted}>まだ記録がありません。</Text>
      ) : (
        <View style={styles.lineChart}>
          <Text style={[styles.yAxisTopLabel, { color }]}>{Math.round(maxValue)}{unit}</Text>
          <Text style={styles.yAxisBottomLabel}>0{unit}</Text>
          <View style={styles.yAxisLine} />
          <View style={styles.xAxisLine} />
          {plotted.slice(0, -1).map((point, index) => {
            const next = plotted[index + 1];
            const dx = next.x - point.x;
            const dy = next.y - point.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = `${Math.atan2(dy, dx)}rad`;
            return (
              <View
                key={`${point.record.id}-${next.record.id}`}
                style={[
                  styles.lineSegment,
                  {
                    width: length,
                    left: point.x + 28,
                    top: point.y,
                    backgroundColor: color,
                    transform: [{ rotate: angle }],
                  },
                ]}
              />
            );
          })}
          {plotted.map((point) => (
            <View key={point.record.id} style={[styles.lineDot, { left: point.x + 23, top: point.y - 5, backgroundColor: color }]} />
          ))}
          <View style={styles.lineLabels}>
            {plotted.map((point) => (
              <View key={point.record.id} style={styles.lineLabelItem}>
                <Text style={styles.graphLabel}>{point.record.measuredAt.slice(5).replace('-', '/')}</Text>
                <Text style={styles.graphLabel}>{point.value}{unit}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function ChildForm(props: {
  child?: Child;
  recordChoice?: RecordChoice;
  profileOnly?: boolean;
  brands: RegisteredBrand[];
  onCancel: () => void;
  onSave: (child: Child) => void;
}) {
  const initialBirth = splitDate(props.child?.birthDate);
  const initialRecord = splitDate(todayText());
  const [showProfile, setShowProfile] = useState(!props.child || Boolean(props.profileOnly));
  const [name, setName] = useState(props.child?.name ?? '');
  const [birthYear, setBirthYear] = useState(initialBirth[0]);
  const [birthMonth, setBirthMonth] = useState(initialBirth[1]);
  const [birthDay, setBirthDay] = useState(initialBirth[2]);
  const [gender, setGender] = useState<Gender>(props.child?.gender ?? 'unspecified');
  const [recordYear, setRecordYear] = useState(initialRecord[0]);
  const [recordMonth, setRecordMonth] = useState(initialRecord[1]);
  const [recordDay, setRecordDay] = useState(initialRecord[2]);
  const [recordDateMode, setRecordDateMode] = useState<'today' | 'custom'>('today');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [selectedSizeCategory, setSelectedSizeCategory] = useState<SizeCategoryKey>(
    props.recordChoice && props.recordChoice !== 'growth' ? props.recordChoice : 'topsRecords',
  );
  const [sizeValue, setSizeValue] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [sizeBrand, setSizeBrand] = useState('');
  const [sizeFit, setSizeFit] = useState<SizeFitStatus>('just');
  const [underwearRecords, setUnderwearRecords] = useState<SizeRecord[]>(
    normalizeSizeRecords(props.child?.underwearRecords),
  );
  const [topsRecords, setTopsRecords] = useState<SizeRecord[]>(
    normalizeSizeRecords(props.child?.topsRecords, props.child?.topsSize),
  );
  const [bottomsRecords, setBottomsRecords] = useState<SizeRecord[]>(
    normalizeSizeRecords(props.child?.bottomsRecords, props.child?.bottomsSize),
  );
  const [shoeRecords, setShoeRecords] = useState<SizeRecord[]>(
    normalizeSizeRecords(props.child?.shoeRecords, props.child?.shoeSize),
  );
  const [sockRecords, setSockRecords] = useState<SizeRecord[]>(
    normalizeSizeRecords(props.child?.sockRecords),
  );
  const [fitPreference, setFitPreference] = useState<FitPreference>(props.child?.fitPreference ?? 'just');
  const brandOptions = (() => {
    if (!props.recordChoice || props.recordChoice === 'growth') return [];
    const names = new Set<string>();
    props.brands
      .filter((brand) => brand.categories.includes(props.recordChoice as SizeCategoryKey))
      .forEach((brand) => {
        if (brand.name.trim()) names.add(brand.name.trim());
      });
    const recordsByCategory: Record<SizeCategoryKey, SizeRecord[]> = {
      underwearRecords,
      topsRecords,
      bottomsRecords,
      sockRecords,
      shoeRecords,
    };
    recordsByCategory[props.recordChoice as SizeCategoryKey].forEach((record) => {
      if (record.brand?.trim()) names.add(record.brand.trim());
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'ja'));
  })();

  const existingRecords = sortedGrowthRecords(props.child ?? ({} as Child));

  function submit() {
    if (!name.trim()) {
      Alert.alert('入力を確認してください', '名前は必須です。身長、体重、サイズ感は任意です。');
      return;
    }
    const measuredAt = recordDateMode === 'today' ? todayText() : joinDate(recordYear, recordMonth, recordDay);
    const height = numberOrUndefined(heightCm);
    const weight = numberOrUndefined(weightKg);
    const growthRecords = [...(props.child?.growthRecords ?? [])];
    if ((props.profileOnly || !props.recordChoice || props.recordChoice === 'growth') && (height || weight)) {
      if (!measuredAt) {
        Alert.alert('記録日を選択してください', '任意の日付を使う場合は、年・月・日を選んでください。');
        return;
      }
      growthRecords.push({
        id: makeId(),
        measuredAt,
        heightCm: height,
        weightKg: weight,
      });
    }

    const nextUnderwearRecords = [...underwearRecords];
    const nextTopsRecords = [...topsRecords];
    const nextBottomsRecords = [...bottomsRecords];
    const nextSockRecords = [...sockRecords];
    const nextShoeRecords = [...shoeRecords];
    if (!props.profileOnly && props.recordChoice && props.recordChoice !== 'growth' && sizeValue.trim()) {
      const newSizeRecord: SizeRecord = {
        id: makeId(),
        size: sizeValue.trim(),
        fit: sizeFit,
        brand: sizeBrand.trim() || selectedBrand || undefined,
      };
      if (props.recordChoice === 'underwearRecords') nextUnderwearRecords.push(newSizeRecord);
      if (props.recordChoice === 'topsRecords') nextTopsRecords.push(newSizeRecord);
      if (props.recordChoice === 'bottomsRecords') nextBottomsRecords.push(newSizeRecord);
      if (props.recordChoice === 'sockRecords') nextSockRecords.push(newSizeRecord);
      if (props.recordChoice === 'shoeRecords') nextShoeRecords.push(newSizeRecord);
    }

    const now = new Date().toISOString();
    props.onSave({
      id: props.child?.id ?? makeId(),
      name: name.trim(),
      birthDate: joinDate(birthYear, birthMonth, birthDay),
      gender,
      growthRecords,
      topsSize: sortSizeRecords(nextTopsRecords)[0]?.size ?? '',
      bottomsSize: sortSizeRecords(nextBottomsRecords)[0]?.size ?? '',
      shoeSize: sortSizeRecords(nextShoeRecords)[0]?.size ?? '',
      underwearRecords: sortSizeRecords(nextUnderwearRecords),
      topsRecords: sortSizeRecords(nextTopsRecords),
      bottomsRecords: sortSizeRecords(nextBottomsRecords),
      sockRecords: sortSizeRecords(nextSockRecords),
      shoeRecords: sortSizeRecords(nextShoeRecords),
      fitPreference,
      createdAt: props.child?.createdAt ?? now,
      updatedAt: now,
    });
  }

  return (
    <View>
      <View style={styles.formTitleRow}>
        <Text style={styles.sectionTitle}>{props.profileOnly ? (props.child ? '子供の情報を編集' : '子供を追加') : '情報を追加'}</Text>
        {props.child && !props.profileOnly ? (
          <Pressable style={styles.headerEditButton} onPress={() => setShowProfile((value) => !value)}>
            <Text style={styles.headerEditText}>子供の情報を編集</Text>
          </Pressable>
        ) : null}
      </View>
      {showProfile ? (
        <View style={styles.card}>
          <Field label="名前" value={name} onChangeText={setName} placeholder="例: はる" />
          <DateSelect
            label="生年月日（任意）"
            year={birthYear}
            month={birthMonth}
            day={birthDay}
            onChange={([year, month, day]) => {
              setBirthYear(year);
              setBirthMonth(month);
              setBirthDay(day);
            }}
          />
          <Text style={styles.label}>性別</Text>
          <RadioGroup options={genders} value={gender} onChange={setGender} />
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.childName}>{name}</Text>
          <Text style={styles.muted}>
            {formatAge(joinDate(birthYear, birthMonth, birthDay))} ・ {genders.find((item) => item.value === gender)?.label}
          </Text>
        </View>
      )}
      {(props.profileOnly || !props.recordChoice || props.recordChoice === 'growth') ? (
        <View style={styles.card}>
          <Text style={styles.noticeTitle}>今日の身長・体重</Text>
          <Text style={styles.label}>記録日</Text>
          <Segmented
            options={[
              { label: `今日（${todayText()}）`, value: 'today' },
              { label: '日付を選ぶ', value: 'custom' },
            ]}
            value={recordDateMode}
            onChange={setRecordDateMode}
          />
          {recordDateMode === 'custom' ? (
            <DateSelect
              label="記録日"
              year={recordYear}
              month={recordMonth}
              day={recordDay}
              onChange={([year, month, day]) => {
                setRecordYear(year);
                setRecordMonth(month);
                setRecordDay(day);
              }}
            />
          ) : null}
          <Field label="身長 cm（任意）" value={heightCm} onChangeText={setHeightCm} keyboardType="numeric" placeholder="例: 123" />
          <Field label="体重 kg（任意）" value={weightKg} onChangeText={setWeightKg} keyboardType="numeric" placeholder="例: 32" />
        </View>
      ) : null}
      {!props.profileOnly && existingRecords.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.noticeTitle}>これまでの記録</Text>
          {existingRecords.map((record) => (
            <Text key={record.id} style={styles.bodyText}>
              {record.measuredAt}  {record.heightCm ? `${record.heightCm}cm` : '身長 -'}  {record.weightKg ? `${record.weightKg}kg` : '体重 -'}
            </Text>
          ))}
        </View>
      ) : null}
      {!props.profileOnly && props.recordChoice && props.recordChoice !== 'growth' ? (
      <View style={styles.card}>
        <Text style={styles.noticeTitle}>{sizeCategories.find((item) => item.value === props.recordChoice)?.label}を記録</Text>
        <SelectBox
          label="サイズ"
          value={sizeValue}
          options={sizeOptionsFor(props.recordChoice)}
          onChange={setSizeValue}
          placeholder="サイズを選択"
        />
        {brandOptions.length > 0 ? (
          <SelectBox
            label="登録・記録済みブランド（任意）"
            value={selectedBrand}
            options={brandOptions}
            onChange={setSelectedBrand}
            placeholder="選択しない"
          />
        ) : null}
        <Field label="メーカー・ブランドを自由入力（任意）" value={sizeBrand} onChangeText={setSizeBrand} placeholder="例: UNIQLO" />
        <Text style={styles.label}>着用感</Text>
        <Segmented options={sizeFits} value={sizeFit} onChange={setSizeFit} />
      </View>
      ) : null}
      <View style={styles.actionsRow}>
        <Pressable style={styles.secondaryButtonFlex} onPress={props.onCancel}>
          <Text style={styles.secondaryButtonText}>戻る</Text>
        </Pressable>
        <Pressable style={styles.primaryButtonFlex} onPress={submit}>
          <Text style={styles.primaryButtonText}>保存</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SizeRecordsEditor({
  title,
  records,
  onChange,
  placeholder,
}: {
  title: string;
  records: SizeRecord[];
  onChange: (records: SizeRecord[]) => void;
  placeholder: string;
}) {
  function updateRecord(id: string, patch: Partial<SizeRecord>) {
    onChange(records.map((record) => (record.id === id ? { ...record, ...patch } : record)));
  }

  function addRecord() {
    if (records.length >= 3) return;
    onChange([...records, { id: makeId(), size: '', fit: 'just' }]);
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.noticeTitle}>{title}</Text>
        <Text style={styles.muted}>{records.length}/3</Text>
      </View>
      {records.map((record, index) => (
        <View key={record.id} style={styles.sizeRecordBox}>
          <Field
            label={`サイズ ${index + 1}`}
            value={record.size}
            onChangeText={(value) => updateRecord(record.id, { size: value })}
            placeholder={placeholder}
          />
          <Text style={styles.label}>着用感</Text>
          <Segmented options={sizeFits} value={record.fit} onChange={(fit) => updateRecord(record.id, { fit })} />
          <Pressable
            style={styles.dangerButton}
            onPress={() => onChange(records.filter((item) => item.id !== record.id))}
          >
            <Text style={styles.dangerButtonText}>このサイズを削除</Text>
          </Pressable>
        </View>
      ))}
      {records.length < 3 ? (
        <Pressable style={styles.secondaryButton} onPress={addRecord}>
          <Text style={styles.secondaryButtonText}>サイズを追加</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function JudgeForm(props: { children: Child[]; onCancel: () => void; onJudge: (child: Child, input: FitCheckInput) => void }) {
  const [childId, setChildId] = useState(props.children[0]?.id ?? '');
  const [category, setCategory] = useState<ProductCategory>('tops');
  const [productSize, setProductSize] = useState('');
  const [condition, setCondition] = useState<ProductCondition>('new');
  const [brand, setBrand] = useState('');
  const [memo, setMemo] = useState('');
  const [measurements, setMeasurements] = useState<Record<string, string>>({});
  const selectedChild = props.children.find((child) => child.id === childId);

  const setMeasurement = (key: keyof ProductMeasurements, value: string) =>
    setMeasurements((current) => ({ ...current, [key]: value }));

  const buildMeasurements = (): ProductMeasurements => ({
    length: numberOrUndefined(measurements.length ?? ''),
    width: numberOrUndefined(measurements.width ?? ''),
    sleeve: numberOrUndefined(measurements.sleeve ?? ''),
    waist: numberOrUndefined(measurements.waist ?? ''),
    inseam: numberOrUndefined(measurements.inseam ?? ''),
    totalLength: numberOrUndefined(measurements.totalLength ?? ''),
    innerLength: numberOrUndefined(measurements.innerLength ?? ''),
    footWidth: numberOrUndefined(measurements.footWidth ?? ''),
  });

  function submit() {
    if (!selectedChild) return Alert.alert('子供を選択してください');
    if (!productSize.trim()) return Alert.alert('商品サイズを入力してください');
    props.onJudge(selectedChild, {
      childId: selectedChild.id,
      category,
      productSize: productSize.trim(),
      condition,
      brand: brand.trim() || undefined,
      measurements: buildMeasurements(),
      memo: memo.trim() || undefined,
    });
  }

  return (
    <View>
      <Text style={styles.sectionTitle}>商品サイズ判定</Text>
      <Text style={styles.label}>対象の子供</Text>
      <View style={styles.segmentWrap}>
        {props.children.map((child) => (
          <Pressable
            key={child.id}
            onPress={() => setChildId(child.id)}
            style={[styles.segment, childId === child.id && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, childId === child.id && styles.segmentTextActive]}>{child.name}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>商品カテゴリ</Text>
      <Segmented options={categories} value={category} onChange={setCategory} />
      <Field label="商品の表記サイズ" value={productSize} onChangeText={setProductSize} placeholder="例: 100 / 16.0" />
      <Text style={styles.label}>商品状態</Text>
      <Segmented options={conditions} value={condition} onChange={setCondition} />
      <Field label="ブランド名（任意）" value={brand} onChangeText={setBrand} />
      <MeasurementFields category={category} values={measurements} onChange={setMeasurement} />
      <Field label="メモ（任意）" value={memo} onChangeText={setMemo} multiline />
      <View style={styles.actionsRow}>
        <Pressable style={styles.secondaryButtonFlex} onPress={props.onCancel}>
          <Text style={styles.secondaryButtonText}>戻る</Text>
        </Pressable>
        <Pressable style={styles.primaryButtonFlex} onPress={submit}>
          <Text style={styles.primaryButtonText}>判定する</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MeasurementFields(props: {
  category: ProductCategory;
  values: Record<string, string>;
  onChange: (key: keyof ProductMeasurements, value: string) => void;
}) {
  if (props.category === 'tops' || props.category === 'outerwear') {
    return (
      <View>
        <Text style={styles.label}>実寸（任意）</Text>
        <Field label="着丈 cm" value={props.values.length ?? ''} onChangeText={(value) => props.onChange('length', value)} keyboardType="numeric" />
        <Field label="身幅 cm" value={props.values.width ?? ''} onChangeText={(value) => props.onChange('width', value)} keyboardType="numeric" />
        <Field label="袖丈 cm" value={props.values.sleeve ?? ''} onChangeText={(value) => props.onChange('sleeve', value)} keyboardType="numeric" />
      </View>
    );
  }
  if (props.category === 'bottoms') {
    return (
      <View>
        <Text style={styles.label}>実寸（任意）</Text>
        <Field label="ウエスト cm" value={props.values.waist ?? ''} onChangeText={(value) => props.onChange('waist', value)} keyboardType="numeric" />
        <Field label="股下 cm" value={props.values.inseam ?? ''} onChangeText={(value) => props.onChange('inseam', value)} keyboardType="numeric" />
        <Field label="総丈 cm" value={props.values.totalLength ?? ''} onChangeText={(value) => props.onChange('totalLength', value)} keyboardType="numeric" />
      </View>
    );
  }
  if (props.category === 'shoes') {
    return (
      <View>
        <Text style={styles.label}>実寸（任意）</Text>
        <Field label="内寸 cm" value={props.values.innerLength ?? ''} onChangeText={(value) => props.onChange('innerLength', value)} keyboardType="numeric" />
        <Field label="足幅 cm" value={props.values.footWidth ?? ''} onChangeText={(value) => props.onChange('footWidth', value)} keyboardType="numeric" />
      </View>
    );
  }
  return null;
}

function Result(props: {
  child: Child;
  input: FitCheckInput;
  saved?: FitCheck;
  onSave: (fitCheck: FitCheck) => void;
  onRetry: () => void;
  onHome: () => void;
}) {
  const result = useMemo(() => judgeFit(props.child, props.input), [props.child, props.input]);
  const color = resultColor(result.resultLabel);
  const save = () => props.onSave({ ...props.input, ...result, id: makeId(), createdAt: new Date().toISOString() });
  const copy = async () => {
    if (!result.sellerQuestion) return;
    await Clipboard.setStringAsync(result.sellerQuestion);
    Alert.alert('コピーしました', '出品者への質問文をコピーしました。');
  };

  return (
    <View>
      <Text style={styles.sectionTitle}>判定結果</Text>
      <View style={[styles.resultBox, { borderColor: color }]}>
        <Text style={[styles.resultLabel, { color }]}>{result.resultLabel}</Text>
        <Text style={styles.bodyText}>{result.resultReason}</Text>
      </View>
      {result.cautions.length > 0 && (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeTitle}>注意点</Text>
          {result.cautions.map((item) => (
            <Text key={item} style={styles.bodyText}>・{item}</Text>
          ))}
        </View>
      )}
      <View style={styles.card}>
        <Text style={styles.noticeTitle}>おすすめアクション</Text>
        <Text style={styles.bodyText}>{result.recommendation}</Text>
      </View>
      {result.missingMeasurements.length > 0 && result.sellerQuestion ? (
        <View style={styles.card}>
          <Text style={styles.noticeTitle}>出品者に確認した方がよい項目</Text>
          <Text style={styles.bodyText}>{result.missingMeasurements.join('・')}</Text>
          <Text style={styles.questionText}>{result.sellerQuestion}</Text>
          <Pressable style={styles.secondaryButton} onPress={copy}>
            <Text style={styles.secondaryButtonText}>質問文をコピー</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.actionsColumn}>
        <Pressable style={[styles.primaryButton, props.saved && styles.disabledButton]} disabled={Boolean(props.saved)} onPress={save}>
          <Text style={styles.primaryButtonText}>{props.saved ? '判定履歴に保存済み' : '判定履歴に保存'}</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={props.onRetry}>
          <Text style={styles.secondaryButtonText}>もう一度判定</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={props.onHome}>
          <Text style={styles.secondaryButtonText}>ホームへ戻る</Text>
        </Pressable>
      </View>
    </View>
  );
}

function History(props: {
  history: FitCheck[];
  children: Child[];
  onBack: () => void;
  onOpen: (fitCheck: FitCheck) => void;
  onDelete: (fitCheck: FitCheck) => void;
}) {
  const childName = (childId: string) => props.children.find((child) => child.id === childId)?.name ?? '削除済みの子供';
  return (
    <View>
      <Text style={styles.sectionTitle}>判定履歴</Text>
      <Pressable style={styles.secondaryButton} onPress={props.onBack}>
        <Text style={styles.secondaryButtonText}>ホームへ戻る</Text>
      </Pressable>
      {props.history.length === 0 ? (
        <Text style={styles.emptyText}>まだ履歴はありません。</Text>
      ) : (
        props.history.map((item) => (
          <Pressable key={item.id} style={styles.card} onPress={() => props.onOpen(item)}>
            <Text style={[styles.historyLabel, { color: resultColor(item.resultLabel) }]}>{item.resultLabel}</Text>
            <Text style={styles.bodyText}>{new Date(item.createdAt).toLocaleDateString()} / {childName(item.childId)}</Text>
            <Text style={styles.bodyText}>{categoryLabel(item.category)} / サイズ {item.productSize}</Text>
            {item.memo ? <Text style={styles.muted}>メモ: {item.memo}</Text> : null}
            <Pressable
              style={styles.dangerButton}
              onPress={() =>
                Alert.alert('履歴を削除しますか？', 'この判定履歴を削除します。', [
                  { text: 'キャンセル', style: 'cancel' },
                  { text: '削除', style: 'destructive', onPress: () => props.onDelete(item) },
                ])
              }
            >
              <Text style={styles.dangerButtonText}>削除</Text>
            </Pressable>
          </Pressable>
        ))
      )}
    </View>
  );
}

function HistoryDetail(props: { fitCheck: FitCheck; child?: Child; onBack: () => void; onDelete: () => void }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>履歴詳細</Text>
      <View style={styles.resultBox}>
        <Text style={[styles.resultLabel, { color: resultColor(props.fitCheck.resultLabel) }]}>{props.fitCheck.resultLabel}</Text>
        <Text style={styles.bodyText}>{new Date(props.fitCheck.createdAt).toLocaleDateString()} / {props.child?.name ?? '削除済みの子供'}</Text>
        <Text style={styles.bodyText}>{categoryLabel(props.fitCheck.category)} / サイズ {props.fitCheck.productSize}</Text>
        <Text style={styles.bodyText}>状態: {props.fitCheck.condition === 'new' ? '新品' : '中古'}</Text>
        {props.fitCheck.brand ? <Text style={styles.bodyText}>ブランド: {props.fitCheck.brand}</Text> : null}
      </View>
      <View style={styles.card}>
        <Text style={styles.noticeTitle}>理由</Text>
        <Text style={styles.bodyText}>{props.fitCheck.resultReason}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.noticeTitle}>おすすめアクション</Text>
        <Text style={styles.bodyText}>{props.fitCheck.recommendation}</Text>
        {props.fitCheck.memo ? <Text style={styles.muted}>メモ: {props.fitCheck.memo}</Text> : null}
      </View>
      <View style={styles.actionsRow}>
        <Pressable style={styles.secondaryButtonFlex} onPress={props.onBack}>
          <Text style={styles.secondaryButtonText}>戻る</Text>
        </Pressable>
        <Pressable style={styles.dangerButtonFlex} onPress={props.onDelete}>
          <Text style={styles.dangerButtonText}>削除</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff7ed' },
  container: { padding: 18, paddingBottom: 40 },
  header: { marginBottom: 18 },
  appName: { fontSize: 30, fontWeight: '800', color: '#1f2937' },
  subtitle: { marginTop: 4, fontSize: 14, color: '#6b7280' },
  sectionTitle: { marginTop: 8, marginBottom: 12, fontSize: 22, fontWeight: '800', color: '#1f2937' },
  card: { marginBottom: 12, padding: 14, borderRadius: 8, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#fed7aa' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  formTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  childName: { fontSize: 19, fontWeight: '800', color: '#111827' },
  bodyText: { fontSize: 15, lineHeight: 22, color: '#374151' },
  muted: { fontSize: 13, lineHeight: 20, color: '#6b7280' },
  emptyText: { paddingVertical: 20, textAlign: 'center', fontSize: 15, color: '#6b7280' },
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  actionsColumn: { gap: 10, marginTop: 6 },
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' },
  primaryButton: { alignItems: 'center', justifyContent: 'center', minHeight: 48, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#16a34a' },
  primaryButtonFlex: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#16a34a' },
  primaryButtonText: { fontSize: 15, fontWeight: '800', color: '#ffffff' },
  secondaryButton: { alignItems: 'center', justifyContent: 'center', minHeight: 46, marginBottom: 12, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#fdba74' },
  secondaryButtonFlex: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#fdba74' },
  secondaryMiniButton: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 38, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#fdba74' },
  secondaryButtonText: { fontSize: 15, fontWeight: '800', color: '#9a3412' },
  disabledButton: { opacity: 0.5 },
  smallButton: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#eff6ff' },
  smallButtonText: { fontWeight: '800', color: '#1d4ed8' },
  headerEditButton: { alignSelf: 'flex-start', paddingVertical: 7, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fdba74' },
  headerEditText: { fontSize: 12, fontWeight: '800', color: '#9a3412' },
  dangerButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#fee2e2' },
  dangerButtonFlex: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#fee2e2' },
  dangerButtonText: { fontWeight: '800', color: '#b91c1c' },
  field: { marginBottom: 12 },
  label: { marginBottom: 6, fontSize: 14, fontWeight: '800', color: '#374151' },
  input: { minHeight: 46, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#fdba74', fontSize: 16, color: '#111827' },
  textArea: { minHeight: 92, textAlignVertical: 'top' },
  inputButton: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#fdba74' },
  inputButtonText: { fontSize: 16, color: '#111827' },
  placeholderText: { fontSize: 16, color: '#9ca3af' },
  selectWrap: { flex: 1, marginBottom: 8 },
  dateRow: { flexDirection: 'row', gap: 8 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(17,24,39,0.35)' },
  modalSheet: { maxHeight: 360, borderRadius: 8, backgroundColor: '#ffffff', overflow: 'hidden' },
  optionRow: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  optionText: { fontSize: 16, color: '#111827' },
  segmentWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  segment: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#fdba74' },
  segmentActive: { backgroundColor: '#ffedd5', borderColor: '#f97316' },
  segmentText: { fontSize: 14, fontWeight: '700', color: '#6b7280' },
  segmentTextActive: { color: '#9a3412' },
  radioRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  radioItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  radioOuter: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fdba74', borderRadius: 9, backgroundColor: '#ffffff' },
  radioOuterActive: { borderColor: '#16a34a' },
  radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#16a34a' },
  currentMetrics: { marginVertical: 8 },
  sizeSummaryRow: { flexDirection: 'row', gap: 10, paddingVertical: 5, borderTopWidth: 1, borderTopColor: '#ffedd5' },
  sizeSummaryLast: { marginBottom: 12 },
  sizeSummaryTitle: { width: 68, fontSize: 14, fontWeight: '800', color: '#374151' },
  sizeSummaryItems: { flex: 1, gap: 2 },
  sizeSummaryText: { fontSize: 14, lineHeight: 20, color: '#374151' },
  sizeRecordBox: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#ffedd5' },
  recordLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#ffedd5' },
  recordLineText: { flex: 1, minWidth: 150, fontSize: 15, lineHeight: 22, color: '#374151' },
  recordActions: { flexDirection: 'row', gap: 6 },
  miniEditButton: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#eff6ff' },
  miniEditText: { fontSize: 13, fontWeight: '800', color: '#1d4ed8' },
  miniDangerButton: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#fee2e2' },
  miniDangerText: { fontSize: 13, fontWeight: '800', color: '#b91c1c' },
  editBox: { marginTop: 6, marginBottom: 6, padding: 10, borderRadius: 8, backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fdba74' },
  choiceGrid: { gap: 10, marginBottom: 12 },
  choiceButton: { minHeight: 54, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#fdba74' },
  choiceButtonText: { fontSize: 17, fontWeight: '800', color: '#9a3412' },
  lineGraphBlock: { marginBottom: 18 },
  lineChart: { width: 300, height: 170, marginTop: 4, paddingLeft: 28 },
  yAxisLine: { position: 'absolute', left: 28, top: 0, width: 1, height: 120, backgroundColor: '#d1d5db' },
  xAxisLine: { position: 'absolute', left: 28, top: 120, width: 260, height: 1, backgroundColor: '#d1d5db' },
  yAxisTopLabel: { position: 'absolute', left: 0, top: 0, fontSize: 10, fontWeight: '800' },
  yAxisBottomLabel: { position: 'absolute', left: 0, top: 112, fontSize: 10, color: '#6b7280' },
  lineSegment: { position: 'absolute', height: 3, borderRadius: 2, transformOrigin: 'left center' },
  lineDot: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  lineLabels: { position: 'absolute', left: 28, width: 260, top: 126, flexDirection: 'row', justifyContent: 'space-between' },
  lineLabelItem: { alignItems: 'center', minWidth: 42 },
  graphLabel: { fontSize: 11, color: '#6b7280' },
  resultBox: { marginBottom: 12, padding: 16, borderRadius: 8, backgroundColor: '#ffffff', borderWidth: 2, borderColor: '#fdba74' },
  resultLabel: { marginBottom: 10, fontSize: 25, fontWeight: '900' },
  noticeBox: { marginBottom: 12, padding: 14, borderRadius: 8, backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fb923c' },
  noticeTitle: { marginBottom: 6, fontSize: 16, fontWeight: '800', color: '#1f2937' },
  questionText: { marginVertical: 10, padding: 12, borderRadius: 8, backgroundColor: '#f9fafb', fontSize: 14, lineHeight: 21, color: '#374151' },
  historyLabel: { marginBottom: 6, fontSize: 18, fontWeight: '900' },
});
