export type TransactionStatus = 'Approved' | 'Flagged' | 'Pending';
export type RuleSeverity = 'Warning' | 'Blocker';
export type RuleLogic = 'all' | 'any';
export type ConditionField = 'Amount' | 'Merchant' | 'Category' | 'Weekend Transaction';
export type ConditionOperator = '>' | '<' | 'contains' | 'equals';

export interface Transaction {
  id: string;
  date: string;
  merchant: string;
  category: string;
  amount: number;
  status: TransactionStatus;
  notes: string;
}

export interface RuleCondition {
  field: ConditionField;
  operator: ConditionOperator;
  value: string;
}

export interface FinanceRule {
  id: string;
  name: string;
  severity: RuleSeverity;
  logic: RuleLogic;
  enabled: boolean;
  conditions: RuleCondition[];
}

export interface LedgerFilters {
  q: string;
  category: string;
  status: TransactionStatus | '';
  min: string;
  max: string;
}

const merchants = [
  'Northstar Cloud', 'Bluebird Office Supply', 'Metro Transit', 'Harbor Coffee',
  'Pioneer Software', 'Evergreen Market', 'Summit Airlines', 'Brightline Media',
  'Cedar Consulting', 'Atlas Shipping',
];
const categories = ['Software', 'Office Supplies', 'Travel', 'Meals', 'Marketing', 'Operations'];
const statuses: TransactionStatus[] = ['Approved', 'Approved', 'Approved', 'Pending', 'Flagged'];

export const demoTransactions: Transaction[] = Array.from({ length: 40 }, (_, index) => {
  const day = String((index % 28) + 1).padStart(2, '0');
  return {
    id: `tx-${String(index + 1).padStart(3, '0')}`,
    date: `2026-10-${day}`,
    merchant: merchants[(index * 7) % merchants.length],
    category: categories[(index * 5 + Math.floor(index / 3)) % categories.length],
    amount: Number((38.5 + ((index * 193.17) % 2460)).toFixed(2)),
    status: statuses[(index * 3) % statuses.length],
    notes: '',
  };
});

export const demoRules: FinanceRule[] = [
  {
    id: 'rule-high-value',
    name: 'Large transactions need review',
    severity: 'Warning',
    logic: 'all',
    enabled: true,
    conditions: [{ field: 'Amount', operator: '>', value: '1500' }],
  },
  {
    id: 'rule-weekend',
    name: 'Weekend transactions',
    severity: 'Blocker',
    logic: 'all',
    enabled: true,
    conditions: [{ field: 'Weekend Transaction', operator: 'equals', value: 'true' }],
  },
];
