import { FormControl, FormGroup } from '@angular/forms';
import { Subject } from 'rxjs';
import { conditionValidator, debouncedSearch, evaluateRule, filterTransactions } from './ledger.service';
import { FinanceRule, Transaction } from '../models/models';

describe('transaction rule engine', () => {
  const transaction: Transaction = {
    id: 'tx-test',
    date: '2026-10-12',
    merchant: 'Northstar Cloud',
    category: 'Software',
    amount: 240,
    status: 'Approved',
    notes: '',
  };

  it('evaluates AND and OR rules deterministically', () => {
    const conditions = [
      { field: 'Amount' as const, operator: '>' as const, value: '100' },
      { field: 'Merchant' as const, operator: 'contains' as const, value: 'coffee' },
    ];
    const allRule: FinanceRule = {
      id: 'all', name: 'All conditions', severity: 'Warning', logic: 'all', enabled: true, conditions,
    };
    const anyRule: FinanceRule = { ...allRule, id: 'any', logic: 'any' };

    expect(evaluateRule(transaction, allRule)).toBe(false);
    expect(evaluateRule(transaction, anyRule)).toBe(true);
    expect(evaluateRule(transaction, { ...anyRule, enabled: false })).toBe(false);
  });

  it('validates condition fields against their values and operators', () => {
    const condition = new FormGroup({
      field: new FormControl('Amount'),
      operator: new FormControl('>'),
      value: new FormControl('not-a-number'),
    }, { validators: conditionValidator() });

    expect(condition.hasError('amountMustBeNumber')).toBe(true);
    condition.controls.value.setValue('120');
    expect(condition.valid).toBe(true);

    condition.controls.field.setValue('Weekend Transaction');
    condition.controls.operator.setValue('contains');
    condition.controls.value.setValue('true');
    expect(condition.hasError('invalidWeekendCondition')).toBe(true);

    condition.controls.field.setValue('Merchant');
    condition.controls.operator.setValue('>');
    expect(condition.hasError('invalidConditionOperator')).toBe(true);
  });

  it('debounces merchant search before filtering the ledger', () => {
    vi.useFakeTimers();
    const terms = new Subject<string>();
    let result: Transaction[] = [];
    const subscription = debouncedSearch(terms, 300).subscribe((query) => {
      result = filterTransactions([transaction], { q: query, category: '', status: '', min: '', max: '' });
    });

    terms.next('north');
    vi.advanceTimersByTime(180);
    terms.next('cloud');
    vi.advanceTimersByTime(299);
    expect(result).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(result).toEqual([transaction]);

    subscription.unsubscribe();
    vi.useRealTimers();
  });
});
