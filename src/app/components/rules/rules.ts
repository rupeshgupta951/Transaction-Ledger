import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators,
} from '@angular/forms';
import { ConditionField, ConditionOperator, FinanceRule, RuleLogic, RuleSeverity } from '../../models/models';
import { conditionValidator, LedgerStore } from '../../services/ledger.service';

type ConditionForm = FormGroup<{
  field: FormControl<ConditionField>;
  operator: FormControl<ConditionOperator>;
  value: FormControl<string>;
}>;

@Component({
  selector: 'app-rules',
  imports: [ReactiveFormsModule],
  templateUrl: './rules.html',
  styleUrl: './rules.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Rules {
  store = inject(LedgerStore);
  fb = inject(FormBuilder).nonNullable;
  fields: ConditionField[] = ['Amount', 'Merchant', 'Category', 'Weekend Transaction'];
  operators: ConditionOperator[] = ['>', '<', 'contains', 'equals'];
  form = this.fb.group({
    name: ['', Validators.required],
    severity: this.fb.control<RuleSeverity>('Warning'),
    logic: this.fb.control<RuleLogic>('all'),
    conditions: this.fb.array<ConditionForm>([this.createCondition()]),
  });
  editingId: string | null = null;

  get conditions(): FormArray<ConditionForm> {
    return this.form.controls.conditions;
  }

  addCondition(): void {
    this.conditions.push(this.createCondition());
    this.form.markAsDirty();
  }

  removeCondition(index: number): void {
    if (this.conditions.length > 1) {
      this.conditions.removeAt(index);
      this.form.markAsDirty();
    }
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const values = this.form.getRawValue();
    const rule: FinanceRule = {
      id: this.editingId ?? `rule-${crypto.randomUUID()}`,
      name: values.name.trim(),
      severity: values.severity,
      logic: values.logic,
      enabled: true,
      conditions: values.conditions,
    };
    this.store.saveRule(rule);
    this.resetForm();
  }

  edit(rule: FinanceRule): void {
    if (this.form.dirty && !confirm('Discard your unsaved rule changes?')) return;
    this.editingId = rule.id;
    this.conditions.clear();
    for (const condition of rule.conditions) {
      this.conditions.push(this.createCondition(condition));
    }
    this.form.patchValue({ name: rule.name, severity: rule.severity, logic: rule.logic });
    this.form.markAsPristine();
  }

  cancelEdit(): void {
    this.resetForm();
  }

  canDeactivate(): boolean {
    return !this.form.dirty || confirm('You have unsaved rule changes. Leave this page?');
  }

  createCondition(condition?: {
    field: ConditionField;
    operator: ConditionOperator;
    value: string;
  }): ConditionForm {
    return this.fb.group({
      field: this.fb.control<ConditionField>(condition?.field ?? 'Amount'),
      operator: this.fb.control<ConditionOperator>(condition?.operator ?? '>'),
      value: this.fb.control(condition?.value ?? '', Validators.required),
    }, { validators: conditionValidator() });
  }

  resetForm(): void {
    this.editingId = null;
    this.conditions.clear();
    this.conditions.push(this.createCondition());
    this.form.reset({ name: '', severity: 'Warning', logic: 'all' });
    this.form.markAsPristine();
  }
}
