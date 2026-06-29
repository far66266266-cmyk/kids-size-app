import {
  Child,
  FitCheckInput,
  GrowthRecord,
  JudgeResult,
  ProductCategory,
  ProductMeasurements,
} from '../types';

const clothingRanges: Record<number, [number, number]> = {
  80: [75, 85],
  90: [85, 95],
  100: [95, 105],
  110: [105, 115],
  120: [115, 125],
  130: [125, 135],
  140: [135, 145],
  150: [145, 155],
};

const categoryLabels: Record<ProductCategory, string> = {
  tops: 'トップス',
  bottoms: 'ボトムス',
  outerwear: 'アウター',
  shoes: '靴',
  hat: '帽子',
};

const missingByCategory: Record<ProductCategory, string[]> = {
  tops: ['着丈', '身幅', '袖丈'],
  bottoms: ['ウエスト', '股下', '総丈'],
  outerwear: ['着丈', '身幅', '袖丈'],
  shoes: ['内寸', '使用期間', 'ソールの減り'],
  hat: [],
};

function toNumber(value: string): number | undefined {
  const parsed = Number.parseFloat(value.replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function latestGrowthRecord(child: Child): GrowthRecord | undefined {
  const records = [...(child.growthRecords ?? [])];
  if (child.heightCm || child.weightKg) {
    records.push({
      id: 'legacy',
      measuredAt: child.updatedAt || child.createdAt,
      heightCm: child.heightCm,
      weightKg: child.weightKg,
    });
  }
  return records
    .filter((record) => record.heightCm || record.weightKg)
    .sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime())[0];
}

function hasUsefulMeasurements(category: ProductCategory, measurements?: ProductMeasurements): boolean {
  if (!measurements) return false;
  if (category === 'tops' || category === 'outerwear') {
    return Boolean(measurements.length || measurements.width || measurements.sleeve);
  }
  if (category === 'bottoms') {
    return Boolean(measurements.waist || measurements.inseam || measurements.totalLength);
  }
  if (category === 'shoes') {
    return Boolean(measurements.innerLength || measurements.footWidth);
  }
  return true;
}

function makeSellerQuestion(items: string[]): string | undefined {
  if (items.length === 0) return undefined;
  return `こんにちは。購入を検討しています。\nお手数ですが、${items.join('・')}を教えていただけますでしょうか？\nよろしくお願いいたします。`;
}

function infoMissing(
  reason: string,
  recommendation: string,
  cautions: string[],
  missingMeasurements: string[],
): JudgeResult {
  return {
    resultLabel: '? 情報不足',
    resultScore: 0,
    resultTone: 'unknown',
    resultReason: reason,
    cautions,
    recommendation,
    missingMeasurements,
    sellerQuestion: makeSellerQuestion(missingMeasurements),
  };
}

function judgeClothing(child: Child, input: FitCheckInput): JudgeResult {
  const size = toNumber(input.productSize);
  const latest = latestGrowthRecord(child);
  const height = latest?.heightCm;
  const cautions: string[] = [];
  const missingMeasurements = hasUsefulMeasurements(input.category, input.measurements)
    ? []
    : missingByCategory[input.category];

  if (input.condition === 'used') {
    cautions.push('中古品の場合、洗濯による縮みや着用感がある可能性があります。');
  }

  if (!height) {
    return infoMissing(
      '身長の記録がまだないため、服サイズを身長基準で比較できませんでした。',
      '子供情報の編集画面で、記録日つきの身長を1件追加してから判定すると精度が上がります。',
      cautions,
      missingMeasurements,
    );
  }

  if (!size || !clothingRanges[size]) {
    return infoMissing(
      `商品の表記サイズ「${input.productSize}」を身長基準のサイズとして読み取れませんでした。`,
      '商品ページや出品者に実寸を確認してから購入を検討しましょう。',
      cautions,
      missingMeasurements,
    );
  }

  const [min, max] = clothingRanges[size];
  const outerwearAllowance = input.category === 'outerwear' ? 5 : 0;

  let resultLabel = '◎ 今ちょうど良さそう';
  let resultTone: JudgeResult['resultTone'] = 'good';
  let resultScore = 90;
  let recommendation = '今すぐ着る用途なら購入候補に入れてよさそうです。';

  if (height >= min && height <= max) {
    if (child.fitPreference === 'next_season') {
      resultLabel = '○ 少し大きめだが着られそう';
      resultTone = 'ok';
      resultScore = 78;
      recommendation = '来季も着たい場合は、同じ商品の1サイズ上も比較すると安心です。';
    }
  } else if (height < min) {
    const gap = min - height;
    if (gap <= 5 + outerwearAllowance) {
      resultLabel = '○ 少し大きめだが着られそう';
      resultTone = 'ok';
      resultScore = 72;
      recommendation = '袖や丈を折って着られるか、実寸を確認してから選ぶと安心です。';
    } else {
      resultLabel = '△ 大きすぎる可能性あり';
      resultTone = 'large';
      resultScore = 42;
      recommendation = '今すぐ着るなら1サイズ下も検討しましょう。来季用なら実寸確認がおすすめです。';
    }
  } else {
    const gap = height - max;
    if (gap < 3 && input.category === 'outerwear') {
      resultLabel = '○ 少し大きめだが着られそう';
      resultTone = 'ok';
      resultScore = 70;
      recommendation = '薄手の服の上に羽織るなら着られる可能性があります。袖丈と身幅を確認しましょう。';
    } else {
      resultLabel = '△ 小さい可能性あり';
      resultTone = 'small';
      resultScore = gap >= 3 ? 35 : 50;
      recommendation = '窮屈になりやすいため、1サイズ上か実寸の大きい商品を検討しましょう。';
    }
  }

  const dateText = latest?.measuredAt ? `（${latest.measuredAt}の記録）` : '';
  return {
    resultLabel,
    resultScore,
    resultTone,
    resultReason: `お子さんの最新身長は${height}cm${dateText}で、普段のトップスは${child.topsSize}、ボトムスは${child.bottomsSize}です。${categoryLabels[input.category]}の表記サイズ${input.productSize}は身長${min}-${max}cm前後を目安に判定しています。`,
    cautions,
    recommendation,
    missingMeasurements,
    sellerQuestion: makeSellerQuestion(missingMeasurements),
  };
}

function judgeShoes(child: Child, input: FitCheckInput): JudgeResult {
  const productSize = toNumber(input.productSize);
  const usualSize = toNumber(child.shoeSize);
  const cautions =
    input.condition === 'used'
      ? ['中古靴はソールの減りや中敷きの沈み込みを確認しましょう。']
      : [];
  const missingMeasurements = hasUsefulMeasurements(input.category, input.measurements)
    ? []
    : missingByCategory.shoes;

  if (!productSize) {
    return infoMissing(
      '商品の靴サイズを数値として読み取れませんでした。',
      '商品の内寸や普段サイズとの違いを確認しましょう。',
      cautions,
      missingMeasurements,
    );
  }

  const base = child.footLengthCm ?? usualSize;
  if (!base) {
    return infoMissing(
      '足の実寸または普段の靴サイズが未登録のため、靴の余裕を比較できませんでした。',
      '足の実寸か普段の靴サイズを登録してから判定しましょう。',
      cautions,
      missingMeasurements,
    );
  }

  const diff = productSize - base;
  let resultLabel = '◎ 今ちょうど良さそう';
  let resultTone: JudgeResult['resultTone'] = 'good';
  let resultScore = 88;
  let recommendation = '靴下の厚みや足幅が合えば購入候補に入れてよさそうです。';

  if (child.footLengthCm) {
    if (diff >= 0.5 && diff <= 1.0) {
      resultLabel = '◎ 今ちょうど良さそう';
    } else if (diff > 1.0 && diff <= 1.5) {
      resultLabel = '○ 少し大きめだが履けそう';
      resultTone = 'ok';
      resultScore = 74;
      recommendation = '中敷きで調整できるか確認しましょう。';
    } else if (diff >= 0 && diff <= 0.4) {
      resultLabel = '△ すぐきつくなる可能性あり';
      resultTone = 'small';
      resultScore = 45;
      recommendation = '長く履くなら0.5cm上も検討しましょう。';
    } else if (diff > 1.5) {
      resultLabel = '△ 大きすぎる可能性あり';
      resultTone = 'large';
      resultScore = 38;
      recommendation = '歩きにくい可能性があるため、もう少し近いサイズを検討しましょう。';
    } else {
      resultLabel = '△ 小さい可能性あり';
      resultTone = 'small';
      resultScore = 30;
      recommendation = '足実寸以下に近いため、サイズアップを検討しましょう。';
    }
  } else if (usualSize) {
    if (Math.abs(diff) < 0.01) {
      resultLabel = '◎ 今ちょうど良さそう';
    } else if (diff === 0.5) {
      resultLabel = '○ 少し大きめだが履けそう';
      resultTone = 'ok';
      resultScore = 76;
    } else if (diff >= 1.0) {
      resultLabel = '△ 大きすぎる可能性あり';
      resultTone = 'large';
      resultScore = 44;
      recommendation = '普段サイズより大きめです。中敷きや足幅の確認がおすすめです。';
    } else {
      resultLabel = '△ 小さい可能性あり';
      resultTone = 'small';
      resultScore = 34;
      recommendation = '普段サイズより小さいため、避けた方が安心です。';
    }
  }

  return {
    resultLabel,
    resultScore,
    resultTone,
    resultReason: child.footLengthCm
      ? `足の実寸は${child.footLengthCm}cmで、商品サイズ${input.productSize}との差は${diff.toFixed(1)}cmです。`
      : `普段の靴サイズは${child.shoeSize}で、商品サイズ${input.productSize}との差は${diff.toFixed(1)}cmです。`,
    cautions,
    recommendation,
    missingMeasurements,
    sellerQuestion: makeSellerQuestion(missingMeasurements),
  };
}

export function judgeFit(child: Child, input: FitCheckInput): JudgeResult {
  if (input.category === 'shoes') {
    return judgeShoes(child, input);
  }

  if (input.category === 'hat') {
    return {
      resultLabel: '? 情報不足',
      resultScore: 0,
      resultTone: 'unknown',
      resultReason: '帽子は頭囲の実寸が重要ですが、このMVPでは頭囲登録が未対応です。',
      cautions: ['商品説明に頭囲や調整幅があるか確認しましょう。'],
      recommendation: '頭囲の実寸が分かる商品を選ぶと安心です。',
      missingMeasurements: [],
    };
  }

  return judgeClothing(child, input);
}
