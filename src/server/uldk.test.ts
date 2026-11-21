import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUldkResponse, UldkUnavailableError } from './uldk';

test('ULDK parser accepts a valid parcel record', () => {
  const record = parseUldkResponse(
    '0\n040704_2.0004.70/11|kujawsko-pomorskie|inowrocławski|Inowrocław|Batkowo|70/11|SRID=4326;POLYGON((18.2 52.8,18.21 52.8,18.21 52.81,18.2 52.8))\n'
  );
  assert.equal(record?.id, '040704_2.0004.70/11');
  assert.equal(record?.parcelNumber, '70/11');
  assert.match(record?.wkt ?? '', /POLYGON/);
});

test('ULDK parser returns null for "not found"', () => {
  assert.equal(parseUldkResponse('-1 brak wyników\n'), null);
});

test('ULDK parser rejects the GUGiK throttling junk response instead of treating it as a parcel', () => {
  const junk = '0\n0101000020E6100000000000000080564000000000008056400101010101010101';
  assert.throws(() => parseUldkResponse(junk), UldkUnavailableError);
  assert.throws(() => parseUldkResponse('<html>Service Unavailable</html>'), UldkUnavailableError);
});
