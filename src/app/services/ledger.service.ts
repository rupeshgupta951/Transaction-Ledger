import { Injectable, computed, signal } from '@angular/core';
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Observable, debounceTime } from 'rxjs';
import {
  ConditionField, FinanceRule, LedgerFilters, RuleCondition, Transaction,
  TransactionStatus, demoRules, demoTransactions,
} from '../models/models';

const TRANSACTIONS_KEY = 'ledger-dashboard.transactions';
const RULES_KEY = 'ledger-dashboard.rules';

export function evaluateCondition(transaction: Transaction, condition: RuleCondition): boolean {
  const actual = {
    Amount: transaction.amount,
    Merchant: transaction.merchant,
    Category: transaction.category,
    'Weekend Transaction': [0, 6].includes(new Date(`${transaction.date}T00:00:00`).getDay()),
  }[condition.field];
  if (typeof actual === 'number') {
    const expected = Number(condition.value);
    if (!Number.isFinite(expected)) return false;
    if (condition.operator === '>') return actual > expected;
    if (condition.operator === '<') return actual < expected;
    return condition.operator === 'equals' && actual === expected;
  }
  if (typeof actual === 'boolean') return condition.operator === 'equals' && String(actual) === condition.value.toLowerCase();
  if (condition.operator === 'contains') {
    return actual.toLowerCase().includes(condition.value.toLowerCase());
  }
  return condition.operator === 'equals' && actual.toLowerCase() === condition.value.toLowerCase();
}

export function evaluateRule(transaction: Transaction, rule: FinanceRule): boolean {
  if (!rule.enabled || rule.conditions.length === 0) return false;
  return rule.logic === 'all'
    ? rule.conditions.every((condition) => evaluateCondition(transaction, condition))
    : rule.conditions.some((condition) => evaluateCondition(transaction, condition));
}

export function filterTransactions(
  transactions: Transaction[],
  filters: LedgerFilters,
): Transaction[] {
  const query = filters.q.trim().toLowerCase();
  return transactions.filter((item) =>
    (!query || item.merchant.toLowerCase().includes(query))
    && (!filters.category || item.category === filters.category)
    && (!filters.status || item.status === filters.status)
    && (!filters.min || item.amount >= Number(filters.min))
    && (!filters.max || item.amount <= Number(filters.max)));
}

export function debouncedSearch(terms: Observable<string>, delay = 300): Observable<string> {
  return terms.pipe(debounceTime(delay));
}

export function conditionValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const field = control.get('field')?.value as ConditionField | undefined;
    const operator = control.get('operator')?.value as string | undefined;
    const value = String(control.get('value')?.value ?? '').trim();
    if (!field || !value) return null;
    if (field === 'Amount' && !Number.isFinite(Number(value))) return { amountMustBeNumber: true };
    if ((field === 'Amount' && operator === 'contains')
      || (field !== 'Weekend Transaction' && field !== 'Amount' && ['>', '<'].includes(operator ?? ''))) {
      return { invalidConditionOperator: true };
    }
    if (field === 'Weekend Transaction' &&
      (operator !== 'equals' || !['true', 'false'].includes(value.toLowerCase()))) return { invalidWeekendCondition: true };
    return null;
  };
}

const isStatus = (value: unknown): value is TransactionStatus =>
  value === 'Approved' || value === 'Flagged' || value === 'Pending';

function isTransaction(value: unknown): value is Transaction {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item['id'] === 'string' && typeof item['date'] === 'string'
    && typeof item['merchant'] === 'string' && typeof item['category'] === 'string'
    && typeof item['amount'] === 'number' && isStatus(item['status']) && typeof item['notes'] === 'string';
}

function isCondition(value: unknown): value is RuleCondition {
  if (!value || typeof value !== 'object') return false;
  const condition = value as Record<string, unknown>;
  return (condition['field'] === 'Amount' || condition['field'] === 'Merchant'
      || condition['field'] === 'Category' || condition['field'] === 'Weekend Transaction')
    && (condition['operator'] === '>' || condition['operator'] === '<'
      || condition['operator'] === 'contains' || condition['operator'] === 'equals')
    && typeof condition['value'] === 'string';
}

function isRule(value: unknown): value is FinanceRule {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item['id'] === 'string' && typeof item['name'] === 'string'
    && (item['severity'] === 'Warning' || item['severity'] === 'Blocker')
    && (item['logic'] === 'all' || item['logic'] === 'any')
    && typeof item['enabled'] === 'boolean' && Array.isArray(item['conditions'])
    && item['conditions'].every(isCondition);
}

@Injectable({ providedIn: 'root' })
export class LedgerStore {
  transactions = signal<Transaction[]>([]);
  rules = signal<FinanceRule[]>([]);
  storageError = signal('');
  categories = computed(() => [...new Set(this.transactions().map((item) => item.category))].sort());

  constructor() {
    this.load(TRANSACTIONS_KEY, demoTransactions, isTransaction, (items) => this.transactions.set(items),
      'Saved transactions could not be read. Reset demo data to restore the ledger.');
    this.load(RULES_KEY, demoRules, isRule, (items) => this.rules.set(items),
      'Saved rules could not be read. Please clear the invalid rules from browser storage.');
  }

  getTransaction(id: string): Transaction | undefined {
    return this.transactions().find((transaction) => transaction.id === id);
  }

  updateTransaction(transaction: Transaction): Transaction | undefined {
    const previous = this.getTransaction(transaction.id);
    if (!previous) return undefined;
    this.transactions.update((items) => items.map((item) => item.id === transaction.id ? transaction : item));
    this.persist(TRANSACTIONS_KEY, this.transactions());
    return previous;
  }

  addTransactions(transactions: Transaction[]): void {
    this.transactions.update((items) => [...transactions, ...items]);
    this.persist(TRANSACTIONS_KEY, this.transactions());
  }

  resetDemoData(): void {
    this.transactions.set([...demoTransactions]);
    this.persist(TRANSACTIONS_KEY, this.transactions());
  }

  saveRule(rule: FinanceRule): void {
    this.rules.update((items) => {
      const existing = items.some((item) => item.id === rule.id);
      return existing ? items.map((item) => item.id === rule.id ? rule : item) : [...items, rule];
    });
    this.persist(RULES_KEY, this.rules());
  }

  toggleRule(id: string): void {
    this.rules.update((items) => items.map((rule) => rule.id === id ? { ...rule, enabled: !rule.enabled } : rule));
    this.persist(RULES_KEY, this.rules());
  }

  deleteRule(id: string): void {
    this.rules.update((items) => items.filter((rule) => rule.id !== id));
    this.persist(RULES_KEY, this.rules());
  }

  importCsv(csv: string): number {
    const lines = csv.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) throw new Error('The CSV must include a header and at least one transaction.');
    const headers = parseCsvRow(lines[0]).map((header) => header.trim().toLowerCase());
    const merchantIndex = headers.indexOf('merchant');
    const categoryIndex = headers.indexOf('category');
    const amountIndex = headers.indexOf('amount');
    if (merchantIndex < 0 || categoryIndex < 0 || amountIndex < 0) {
      throw new Error('CSV headers must include merchant, category, and amount.');
    }
    const imported = lines.slice(1).map((line, index): Transaction => {
      const values = parseCsvRow(line);
      const amount = Number(values[amountIndex]);
      const merchant = values[merchantIndex]?.trim();
      const category = values[categoryIndex]?.trim();
      if (!merchant || !category || !Number.isFinite(amount)) {
        throw new Error(`Invalid transaction on CSV row ${index + 2}.`);
      }
      const statusIndex = headers.indexOf('status');
      const statusValue = statusIndex >= 0 ? values[statusIndex] : 'Pending';
      const dateIndex = headers.indexOf('date');
      const notesIndex = headers.indexOf('notes');
      return {
        id: `tx-${crypto.randomUUID()}`,
        date: dateIndex >= 0 && values[dateIndex] ? values[dateIndex] : new Date().toISOString().slice(0, 10),
        merchant,
        category,
        amount,
        status: isStatus(statusValue) ? statusValue : 'Pending',
        notes: notesIndex >= 0 ? values[notesIndex] ?? '' : '',
      };
    });
    this.addTransactions(imported);
    return imported.length;
  }

  load<T>(key: string, defaults: T[], isItem: (value: unknown) => value is T,
    setItems: (items: T[]) => void, errorMessage: string): void {
    let saved: string | null;
    try {
      saved = localStorage.getItem(key);
    } catch {
      this.storageError.set('Browser storage is unavailable. Changes will only last until this tab closes.');
      setItems([...defaults]);
      return;
    }

    if (saved === null) {
      setItems([...defaults]);
      this.persist(key, defaults);
      return;
    }

    try {
      const items: unknown = JSON.parse(saved);
      if (!Array.isArray(items) || !items.every(isItem)) throw new Error(errorMessage);
      setItems(items);
    } catch {
      this.storageError.set(errorMessage);
      setItems([...defaults]);
    }
  }

  persist(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      this.storageError.set('');
    } catch {
      this.storageError.set('Could not save to browser storage. Your current changes remain available until refresh.');
    }
  }
}

function parseCsvRow(row: string): string[] {
  return row.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((value) => {
    const trimmed = value.trim();
    return trimmed.startsWith('"') && trimmed.endsWith('"')
      ? trimmed.slice(1, -1).replaceAll('""', '"')
      : trimmed;
  });
}
