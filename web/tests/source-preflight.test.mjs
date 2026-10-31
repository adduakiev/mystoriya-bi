import test from "node:test";
import assert from "node:assert/strict";
import { assertSalesCsvPreflight } from "../../supabase/functions/sync-google-sheet/source-safety.mjs";

const HEADER = [
  "Номер Тижня", "Рік", "Месяц", "Рік", "Місяць",
  "Обліковий день", "Зі складу", "Бренд", "Власність", "Доставка",
  "Тип замовлення", "Сума зі знижкою, грн.", "Чеків", "Націнка, грн."
];
const ROW = ["1","2026","10","2025","9", "46321", "Ахматова NEW", "Мясторія", "Власні", "Заклад", "Заклад", "1234.50", "3", "750.25"];
const source = (count = 1) => [HEADER, ...Array.from({length:count}, () => [...ROW])];
const rejects = (matrix, pattern, options) => assert.throws(() => assertSalesCsvPreflight(matrix, options), pattern);

test("valid numeric source and historical growth pass unchanged", () => {
  assert.deepEqual(assertSalesCsvPreflight(source(105), {previousRowCount:100}), {rawRows:105});
});
test("legitimate zero financial metric is distinct from missing", () => {
  const rows=source();rows[1][11]="0";rows[1][12]="0";rows[1][13]="0";
  assert.equal(assertSalesCsvPreflight(rows).rawRows,1);
});
test("locale-formatted and signed monetary cells are accepted", () => {
  const rows=source();rows[1][11]="1 234,50";rows[1][13]="-12,45";
  assert.equal(assertSalesCsvPreflight(rows).rawRows,1);
});
test("empty or HTML-shaped source cannot advance to SQL", () => {
  rejects([],/EMPTY_OR_NOT_CSV/);
  rejects([HEADER],/EMPTY_OR_NOT_CSV/);
  rejects([["<html>","login"]],/EMPTY_OR_NOT_CSV/);
});
test("unexpected schema/header fails closed", () => {
  const rows=source();rows[0]=[...HEADER];rows[0][11]="Unknown revenue field";
  rejects(rows,/HEADER_MISMATCH column=11/);
});
test("partial CSV row fails closed", () => {
  const rows=source();rows[1]=rows[1].slice(0,12);
  rejects(rows,/ROW_WIDTH row=2/);
});
test("invalid or empty dimensions fail closed", () => {
  const rows=source();rows[1][6]="#N/A";rejects(rows,/MISSING_DIMENSION/);
  rows[1][6]="Ахматова NEW";rows[1][5]="";rejects(rows,/MISSING_DIMENSION/);
});
test("missing revenue is never normalized to numeric zero", () => {
  const rows=source();rows[1][11]="";rejects(rows,/INVALID_NUMBER row=2 column=11/);
});
test("corrupted metrics never get silently cleaned into a number", () => {
  const rows=source();rows[1][13]="#REF!";rejects(rows,/INVALID_NUMBER row=2 column=13/);
});
test("fractional or negative checks are invalid", () => {
  const rows=source();rows[1][12]="1.5";rejects(rows,/INVALID_CHECKS/);
  rows[1][12]="-2";rejects(rows,/INVALID_CHECKS/);
});
test("large historical truncation cannot delete old facts", () => {
  rejects(source(90), /HISTORICAL_SHRINK/, {previousRowCount:100});
});
test("small history variation is allowed; unknown baseline is not guessed", () => {
  assert.equal(assertSalesCsvPreflight(source(96), {previousRowCount:100}).rawRows,96);
  assert.equal(assertSalesCsvPreflight(source(1)).rawRows,1);
});
