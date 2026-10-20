import { describe, it, expect } from 'vitest';
import {
  parseListQuery,
  applyListFilter,
  applyListSort,
  paginateList,
  listResponse,
  pageAliases,
  DEFAULT_PER_PAGE,
  MAX_PER_PAGE,
} from '../../server/utils/pagination';

describe('parseListQuery', () => {
  it('без параметров работает в legacy-режиме и отдаёт весь список', () => {
    const parsed = parseListQuery({});
    expect(parsed.ptero).toBe(false);
    expect(parsed.limit).toBe(0);
    expect(parsed.offset).toBe(0);
  });

  it('page/per_page переключают в pterodactyl-режим', () => {
    const parsed = parseListQuery({ page: '2', per_page: '10' });
    expect(parsed.ptero).toBe(true);
    expect(parsed.page).toBe(2);
    expect(parsed.perPage).toBe(10);
  });

  it('ограничивает perPage максимумом', () => {
    expect(parseListQuery({ per_page: '5000' }).perPage).toBe(MAX_PER_PAGE);
  });

  it('не принимает нулевую и отрицательную страницу', () => {
    expect(parseListQuery({ page: '0' }).page).toBe(1);
    expect(parseListQuery({ page: '-3' }).page).toBe(1);
  });

  it('игнорирует нечисловые значения', () => {
    const parsed = parseListQuery({ page: 'abc', per_page: 'xyz' });
    expect(parsed.page).toBe(1);
    expect(parsed.perPage).toBe(DEFAULT_PER_PAGE);
  });

  it('читает фильтр из объекта', () => {
    const parsed = parseListQuery({ filter: { status: 'active' } });
    expect(parsed.filter).toEqual({ status: 'active' });
  });

  it('игнорирует нестроковые значения фильтра', () => {
    const parsed = parseListQuery({ filter: { status: 42 } });
    expect(parsed.filter).toEqual({});
  });

  it('префикс "-" в сортировке означает desc', () => {
    const parsed = parseListQuery({ sort: '-name' });
    expect(parsed.sort).toBe('name');
    expect(parsed.order).toBe('desc');
  });

  it('порядок по умолчанию — asc', () => {
    expect(parseListQuery({ sort: 'name' }).order).toBe('asc');
  });
});

describe('applyListFilter', () => {
  const items = [
    { id: 1, name: 'alpha', status: 'active' },
    { id: 2, name: 'beta', status: 'stopped' },
    { id: 3, name: 'gamma', status: 'active' },
  ];

  it('фильтрует по подстроке без учёта регистра', () => {
    const filtered = applyListFilter(items, { status: 'ACTIVE' }, ['status']);
    expect(filtered).toHaveLength(2);
  });

  it('фильтрует по вхождению подстроки', () => {
    const filtered = applyListFilter(items, { name: 'a' }, ['name']);
    expect(filtered.length).toBeGreaterThan(0);
  });

  it('игнорирует фильтр по неза��ищенному полю', () => {
    const filtered = applyListFilter(items, { secret: 'value' }, ['status']);
    expect(filtered).toHaveLength(3);
  });

  it('пустой фильтр возвращает все элементы', () => {
    expect(applyListFilter(items, {}, ['status'])).toHaveLength(3);
  });
});

describe('applyListSort', () => {
  const items = [
    { id: 3, name: 'gamma' },
    { id: 1, name: 'alpha' },
    { id: 2, name: 'beta' },
  ];

  it('сортирует по разрешённому полю', () => {
    const parsed = parseListQuery({ sort: 'name', order: 'asc' });
    const sorted = applyListSort(items, parsed.sort, parsed.order, ['name']);
    expect(sorted.map((item) => item.name)).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('учитывает обратный порядок', () => {
    const parsed = parseListQuery({ sort: '-name' });
    const sorted = applyListSort(items, parsed.sort, parsed.order, ['name']);
    expect(sorted.map((item) => item.name)).toEqual(['gamma', 'beta', 'alpha']);
  });

  it('не сортирует по неза��ищенному полю', () => {
    const parsed = parseListQuery({ sort: 'name' });
    const sorted = applyListSort(items, parsed.sort, parsed.order, []);
    expect(sorted).toHaveLength(3);
  });
});

describe('paginateList', () => {
  const items = Array.from({ length: 25 }, (_, index) => ({ id: index + 1 }));

  it('режет список по страницам в pterodactyl-режиме', () => {
    const parsed = parseListQuery({ page: '2', per_page: '10' });
    const page = paginateList(items, parsed, []);
    expect(page.items).toHaveLength(10);
    expect(page.items[0].id).toBe(11);
    expect(page.total).toBe(25);
  });

  it('последняя страница короче остальных', () => {
    const parsed = parseListQuery({ page: '3', per_page: '10' });
    expect(paginateList(items, parsed, []).items).toHaveLength(5);
  });

  it('страница за пределами списка пуста', () => {
    const parsed = parseListQuery({ page: '99', per_page: '10' });
    expect(paginateList(items, parsed, []).items).toHaveLength(0);
  });

  it('в legacy-режиме без limit отдаёт весь список', () => {
    const parsed = parseListQuery({});
    expect(paginateList(items, parsed, []).items).toHaveLength(25);
  });

  it('в legacy-режиме limit/offset режут список', () => {
    const parsed = parseListQuery({ limit: '5', offset: '10' });
    const page = paginateList(items, parsed, []);
    expect(page.items).toHaveLength(5);
    expect(page.items[0].id).toBe(11);
  });
});

describe('listResponse', () => {
  const items = Array.from({ length: 5 }, (_, index) => ({ id: index + 1 }));

  it('в legacy-режиме отдаёт голый массив', () => {
    const parsed = parseListQuery({});
    const response = listResponse(items, parsed, []);
    expect(Array.isArray(response)).toBe(true);
    expect(response).toHaveLength(5);
  });

  it('в pterodactyl-режиме отдаёт конверт с meta.pagination', () => {
    const parsed = parseListQuery({ page: '1', per_page: '2' });
    const response = listResponse(items, parsed, []) as {
      data: unknown[];
      meta: { pagination: Record<string, number> };
    };
    expect(response.data).toHaveLength(2);
    expect(response.meta.pagination.total).toBe(5);
    expect(response.meta.pagination.total_pages).toBe(3);
    expect(response.meta.pagination.current_page).toBe(1);
  });
});

describe('pageAliases', () => {
  it('переводит page/per_page в limit/offset', () => {
    expect(pageAliases({ page: '2', per_page: '10' })).toEqual({
      limit: 10,
      offset: 10,
    });
  });

  it('не мешает явным limit/offset', () => {
    expect(pageAliases({ page: '2', limit: '5' })).toEqual({});
  });

  it('без параметров ничего не возвращает', () => {
    expect(pageAliases({})).toEqual({});
  });
});
