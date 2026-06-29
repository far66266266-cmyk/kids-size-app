import AsyncStorage from '@react-native-async-storage/async-storage';
import { Child, FitCheck, RegisteredBrand } from './types';

const CHILDREN_KEY = 'korekireru.children';
const HISTORY_KEY = 'korekireru.fitChecks';
const BRANDS_KEY = 'korekireru.brands';

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function getChildren(): Promise<Child[]> {
  return readJson<Child[]>(CHILDREN_KEY, []);
}

export async function saveChild(child: Child): Promise<void> {
  const children = await getChildren();
  const next = children.some((item) => item.id === child.id)
    ? children.map((item) => (item.id === child.id ? child : item))
    : [child, ...children];
  await writeJson(CHILDREN_KEY, next);
}

export async function deleteChild(childId: string): Promise<void> {
  const children = await getChildren();
  const history = await getFitChecks();
  await writeJson(
    CHILDREN_KEY,
    children.filter((child) => child.id !== childId),
  );
  await writeJson(
    HISTORY_KEY,
    history.filter((check) => check.childId !== childId),
  );
}

export async function getFitChecks(): Promise<FitCheck[]> {
  return readJson<FitCheck[]>(HISTORY_KEY, []);
}

export async function saveFitCheck(fitCheck: FitCheck): Promise<void> {
  const history = await getFitChecks();
  await writeJson(HISTORY_KEY, [fitCheck, ...history]);
}

export async function deleteFitCheck(id: string): Promise<void> {
  const history = await getFitChecks();
  await writeJson(
    HISTORY_KEY,
    history.filter((item) => item.id !== id),
  );
}

export async function getBrands(): Promise<RegisteredBrand[]> {
  return readJson<RegisteredBrand[]>(BRANDS_KEY, []);
}

export async function saveBrand(brand: RegisteredBrand): Promise<void> {
  const brands = await getBrands();
  const next = brands.some((item) => item.id === brand.id)
    ? brands.map((item) => (item.id === brand.id ? brand : item))
    : [brand, ...brands];
  await writeJson(BRANDS_KEY, next);
}

export async function deleteBrand(id: string): Promise<void> {
  const brands = await getBrands();
  await writeJson(
    BRANDS_KEY,
    brands.filter((brand) => brand.id !== id),
  );
}
