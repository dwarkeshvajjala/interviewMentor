import pg from 'pg';

const { Pool } = pg;
pg.types.setTypeParser(1082, value => value);

function quoteIdent(name) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Invalid SQL identifier: ${name}`);
  }
  return `"${name}"`;
}

function parseColumns(columns) {
  if (!columns || columns === '*') return '*';
  return columns.split(',').map(c => quoteIdent(c.trim())).join(', ');
}

class PgQuery {
  constructor(pool, table) {
    this.pool = pool;
    this.table = table;
    this.filters = [];
    this.sort = null;
    this.maxRows = null;
    this.returning = null;
    this.selectColumns = '*';
    this.options = {};
    this.op = null;
  }

  select(columns = '*', options = {}) {
    if (!this.op) this.op = 'select';
    this.selectColumns = columns;
    this.returning = columns;
    this.options = options || {};
    return this;
  }

  insert(values) {
    this.op = 'insert';
    this.values = Array.isArray(values) ? values : [values];
    return this;
  }

  update(values) {
    this.op = 'update';
    this.values = values;
    return this;
  }

  delete() {
    this.op = 'delete';
    return this;
  }

  upsert(value, { onConflict } = {}) {
    this.op = 'upsert';
    this.values = value;
    this.onConflict = onConflict;
    return this;
  }

  eq(column, value) {
    this.filters.push({ column, operator: '=', value });
    return this;
  }

  neq(column, value) {
    this.filters.push({ column, operator: '<>', value });
    return this;
  }

  lt(column, value) {
    this.filters.push({ column, operator: '<', value });
    return this;
  }

  lte(column, value) {
    this.filters.push({ column, operator: '<=', value });
    return this;
  }

  gt(column, value) {
    this.filters.push({ column, operator: '>', value });
    return this;
  }

  gte(column, value) {
    this.filters.push({ column, operator: '>=', value });
    return this;
  }

  order(column, { ascending = true } = {}) {
    this.sort = { column, ascending };
    return this;
  }

  limit(count) {
    this.maxRows = count;
    return this;
  }

  async single() {
    const result = await this.limit(1).execute();
    if (result.error) return result;
    const row = result.data?.[0] || null;
    return row ? { data: row, error: null } : { data: null, error: new Error('No rows returned') };
  }

  async maybeSingle() {
    const result = await this.limit(1).execute();
    if (result.error) return result;
    return { data: result.data?.[0] || null, error: null };
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }

  catch(reject) {
    return this.execute().catch(reject);
  }

  buildWhere(params) {
    if (!this.filters.length) return '';
    const clauses = this.filters.map(({ column, operator, value }) => {
      params.push(value);
      return `${quoteIdent(column)} ${operator} $${params.length}`;
    });
    return ` WHERE ${clauses.join(' AND ')}`;
  }

  async execute() {
    try {
      switch (this.op) {
        case 'select':
          return await this.executeSelect();
        case 'insert':
          return await this.executeInsert();
        case 'update':
          return await this.executeUpdate();
        case 'delete':
          return await this.executeDelete();
        case 'upsert':
          return await this.executeUpsert();
        default:
          return { data: null, error: new Error('No database operation selected') };
      }
    } catch (error) {
      return { data: null, error };
    }
  }

  async executeSelect() {
    const params = [];
    const table = quoteIdent(this.table);
    const where = this.buildWhere(params);

    if (this.options.count === 'exact' && this.options.head) {
      const { rows } = await this.pool.query(`SELECT count(*)::int AS count FROM ${table}${where}`, params);
      return { data: null, error: null, count: rows[0]?.count || 0 };
    }

    let sql = `SELECT ${parseColumns(this.selectColumns)} FROM ${table}${where}`;
    if (this.sort) sql += ` ORDER BY ${quoteIdent(this.sort.column)} ${this.sort.ascending ? 'ASC' : 'DESC'}`;
    if (this.maxRows) {
      params.push(this.maxRows);
      sql += ` LIMIT $${params.length}`;
    }
    const { rows } = await this.pool.query(sql, params);
    return { data: rows, error: null };
  }

  async executeInsert() {
    if (!this.values.length) return { data: [], error: null };
    const columns = Object.keys(this.values[0]);
    const params = [];
    const tuples = this.values.map(row => {
      const placeholders = columns.map(column => {
        params.push(row[column]);
        return `$${params.length}`;
      });
      return `(${placeholders.join(', ')})`;
    });
    const returning = this.returning ? ` RETURNING ${parseColumns(this.returning)}` : '';
    const sql = `INSERT INTO ${quoteIdent(this.table)} (${columns.map(quoteIdent).join(', ')}) VALUES ${tuples.join(', ')}${returning}`;
    const { rows } = await this.pool.query(sql, params);
    return { data: this.returning ? rows : null, error: null };
  }

  async executeUpdate() {
    const columns = Object.keys(this.values);
    const params = [];
    const sets = columns.map(column => {
      params.push(this.values[column]);
      return `${quoteIdent(column)} = $${params.length}`;
    });
    const where = this.buildWhere(params);
    const returning = this.returning ? ` RETURNING ${parseColumns(this.returning)}` : '';
    const sql = `UPDATE ${quoteIdent(this.table)} SET ${sets.join(', ')}${where}${returning}`;
    const { rows } = await this.pool.query(sql, params);
    return { data: this.returning ? rows : null, error: null };
  }

  async executeDelete() {
    const params = [];
    const sql = `DELETE FROM ${quoteIdent(this.table)}${this.buildWhere(params)}`;
    await this.pool.query(sql, params);
    return { data: null, error: null };
  }

  async executeUpsert() {
    const columns = Object.keys(this.values);
    const params = columns.map(column => this.values[column]);
    const conflict = quoteIdent(this.onConflict);
    const updates = columns
      .filter(column => column !== this.onConflict)
      .map(column => `${quoteIdent(column)} = EXCLUDED.${quoteIdent(column)}`);
    const placeholders = params.map((_, index) => `$${index + 1}`);
    const returning = this.returning ? ` RETURNING ${parseColumns(this.returning)}` : '';
    const sql = `
      INSERT INTO ${quoteIdent(this.table)} (${columns.map(quoteIdent).join(', ')})
      VALUES (${placeholders.join(', ')})
      ON CONFLICT (${conflict}) DO UPDATE SET ${updates.join(', ')}
      ${returning}
    `;
    const { rows } = await this.pool.query(sql, params);
    return { data: this.returning ? rows : null, error: null };
  }
}

export function createPgAdapter(connectionString) {
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  return {
    from(table) {
      return new PgQuery(pool, table);
    },
    async query(sql, params) {
      return pool.query(sql, params);
    }
  };
}
