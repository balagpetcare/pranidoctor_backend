import re, sys, json
SCHEMA = sys.argv[1]
TABLES = sys.argv[2].split(',')          # tables to CREATE if missing
ADD_COLS = json.loads(sys.argv[3])        # {"Model": ["field", ...]} columns to ADD if missing
s = open(SCHEMA, encoding='utf-8').read().replace('\r', '')
enums = {m.group(1): [v.strip() for v in m.group(2).split('\n') if v.strip() and not v.strip().startswith('//')]
         for m in re.finditer(r'^enum (\w+) \{(.*?)^\}', s, re.S | re.M)}
models = {}
for m in re.finditer(r'^model (\w+) \{(.*?)^\}', s, re.S | re.M):
    name, body = m.group(1), m.group(2)
    tm = re.search(r'@@map\("([^"]+)"\)', body)
    fields, extra = [], []
    for line in body.split('\n'):
        l = line.strip()
        if not l or l.startswith('//'): continue
        if l.startswith('@@'): extra.append(l); continue
        mt = re.match(r'(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$', l)
        if not mt: continue
        fname, ftype, is_list, is_opt, attrs = mt.group(1), mt.group(2), mt.group(3), mt.group(4), mt.group(5)
        fields.append(dict(name=fname, type=ftype, list=bool(is_list), opt=bool(is_opt), attrs=attrs))
    models[name] = dict(table=tm.group(1) if tm else name, fields=fields, extra=extra)

def col_name(f):
    m = re.search(r'@map\("([^"]+)"\)', f['attrs']); return m.group(1) if m else f['name']

def sql_type(f):
    a = f['attrs']
    if f['type'] in enums: return f'"{f["type"]}"'
    m = re.search(r'@db\.VarChar\((\d+)\)', a)
    if f['type'] == 'String': return f'VARCHAR({m.group(1)})' if m else 'TEXT'
    if f['type'] == 'Int': return 'INTEGER'
    if f['type'] == 'BigInt': return 'BIGINT'
    if f['type'] == 'Float': return 'DOUBLE PRECISION'
    if f['type'] == 'Decimal':
        d = re.search(r'@db\.Decimal\((\d+),\s*(\d+)\)', a); return f'DECIMAL({d.group(1)},{d.group(2)})' if d else 'DECIMAL(65,30)'
    if f['type'] == 'Boolean': return 'BOOLEAN'
    if f['type'] == 'DateTime': return 'TIMESTAMP(3)'
    if f['type'] == 'Json': return 'JSONB'
    if f['type'] == 'Bytes': return 'BYTEA'
    raise SystemExit(f'unsupported type {f["type"]} for {f["name"]}')

def default_sql(f):
    m = re.search(r'@default\(([^)]*)\)', f['attrs'])
    if not m: return ''
    v = m.group(1).strip()
    if v in ('now()',): return ' DEFAULT CURRENT_TIMESTAMP'
    if v.startswith('cuid') or v.startswith('uuid') or v == 'autoincrement()': return ''
    if v in ('true', 'false'): return f' DEFAULT {v.upper()}'
    if re.match(r'^-?\d+(\.\d+)?$', v): return f' DEFAULT {v}'
    if v.startswith('"'): return f" DEFAULT '{v.strip(chr(34))}'"
    if v in (f['type'] and enums.get(f['type'], [])): return f" DEFAULT '{v}'"
    if f['type'] in enums: return f" DEFAULT '{v}'"
    return ''

def col_def(f):
    nullable = '' if (not f['opt'] and not f['list'] and '@id' in f['attrs'] or not f['opt']) and not f['list'] else ''
    null_sql = ' NOT NULL' if (not f['opt']) else ''
    if f['list']: return None
    return f'"{col_name(f)}" {sql_type(f)}{null_sql}{default_sql(f)}'

out = []
fk_out = []
idx_out = []
enum_needed = set()
for mname in TABLES:
    mdl = models[mname]; t = mdl['table']
    cols = []
    pk = None
    for f in mdl['fields']:
        if f['list']: continue
        if f['type'] in models: # relation object field
            continue
        if '@id' in f['attrs']: pk = col_name(f)
        cols.append(f)
        if f['type'] in enums: enum_needed.add(f['type'])
    pk_extra = [e for e in mdl['extra'] if e.startswith('@@id')]
    if pk_extra:
        pk = ', '.join(f'"{x.strip()}"' for x in re.search(r'\[(.*?)\]', pk_extra[0]).group(1).split(','))
        cols_sql = [col_def(f) for f in cols]
        body = ',\n  '.join(c for c in cols_sql if c) + f',\n  PRIMARY KEY ({pk})'
    else:
        cols_sql = [col_def(f) for f in cols]
        body = ',\n  '.join(c for c in cols_sql if c)
        if pk: body += f',\n  PRIMARY KEY ("{pk}")'
    out.append(f'CREATE TABLE IF NOT EXISTS "{t}" (\n  {body}\n);')
    for f in cols:
        if '@unique' in f['attrs']:
            c = col_name(f); idx_out.append(f'CREATE UNIQUE INDEX IF NOT EXISTS "{t}_{c}_key" ON "{t}"("{c}");')
    for e in mdl['extra']:
        mm = re.match(r'@@(unique|index)\(\[(.*?)\]', e)
        if mm:
            cs = [x.strip() for x in mm.group(2).split(',')]
            cs = [col_name(next(f for f in cols if f['name'] == c)) if any(f['name'] == c for f in cols) else c for c in cs]
            kind = 'UNIQUE INDEX' if mm.group(1) == 'unique' else 'INDEX'
            suffix = 'key' if mm.group(1) == 'unique' else 'idx'
            idx_out.append(f'CREATE {kind} IF NOT EXISTS "{t}_{"_".join(cs)}_{suffix}" ON "{t}"({", ".join(chr(34)+c+chr(34) for c in cs)});')

for mname, fnames in ADD_COLS.items():
    mdl = models[mname]; t = mdl['table']
    for fname in fnames:
        f = next(x for x in mdl['fields'] if x['name'] == fname)
        if f['type'] in enums: enum_needed.add(f['type'])
        out.append(f'ALTER TABLE "{t}" ADD COLUMN IF NOT EXISTS "{col_name(f)}" {sql_type(f)}{default_sql(f)};')
        if f['type'] in models:
            raise SystemExit('relation column in ADD_COLS not supported')
        if f['attrs'].find('@unique') >= 0:
            c = col_name(f); idx_out.append(f'CREATE UNIQUE INDEX IF NOT EXISTS "{t}_{c}_key" ON "{t}"("{c}");')
        # index from model-level @@index that references this field
        for e in mdl['extra']:
            mm = re.match(r'@@index\(\[(.*?)\]', e)
            if mm and fname in [x.strip() for x in mm.group(1).split(',')]:
                cs = [col_name(next(x for x in mdl['fields'] if x['name'] == c.strip())) for c in mm.group(1).split(',')]
                idx_out.append(f'CREATE INDEX IF NOT EXISTS "{t}_{"_".join(cs)}_idx" ON "{t}"({", ".join(chr(34)+c+chr(34) for c in cs)});')

# foreign keys for every relation field of the touched models
touched = set(TABLES) | set(ADD_COLS.keys())
for mname in touched:
    mdl = models[mname]; t = mdl['table']
    for f in mdl['fields']:
        if f['type'] not in models or f['list']: continue
        r = re.search(r'@relation\((.*?)\)\s*$', f['attrs']) or re.search(r'@relation\((.*)\)', f['attrs'])
        if not r or 'fields:' not in r.group(1): continue
        rel = r.group(1)
        lf = re.search(r'fields:\s*\[(.*?)\]', rel).group(1).split(',')
        rf = re.search(r'references:\s*\[(.*?)\]', rel).group(1).split(',')
        od = re.search(r'onDelete:\s*(\w+)', rel)
        ondel = {'Cascade': 'CASCADE', 'SetNull': 'SET NULL', 'Restrict': 'RESTRICT', 'NoAction': 'NO ACTION'}[od.group(1)] if od else ('SET NULL' if f['opt'] else 'RESTRICT')
        ref_model = models[f['type']]; rt = ref_model['table']
        lcols = []
        for x in lf:
            x = x.strip(); lf_field = next(y for y in mdl['fields'] if y['name'] == x)
            lcols.append(col_name(lf_field))
        rcols = []
        for x in rf:
            x = x.strip(); rf_field = next(y for y in ref_model['fields'] if y['name'] == x)
            rcols.append(col_name(rf_field))
        cname = f'{t}_{"_".join(lcols)}_fkey'
        fk_out.append(
            "DO $$ BEGIN\n"
            f'  ALTER TABLE "{t}" ADD CONSTRAINT "{cname}" FOREIGN KEY ({", ".join(chr(34)+c+chr(34) for c in lcols)}) '
            f'REFERENCES "{rt}"({", ".join(chr(34)+c+chr(34) for c in rcols)}) ON DELETE {ondel} ON UPDATE CASCADE;\n'
            "EXCEPTION WHEN duplicate_object THEN NULL; END $$;")

enum_out = []
for e in sorted(enum_needed):
    vals = ', '.join(f"'{v}'" for v in enums[e])
    enum_out.append(f'DO $$ BEGIN\n  CREATE TYPE "{e}" AS ENUM ({vals});\nEXCEPTION WHEN duplicate_object THEN NULL; END $$;')

print('-- A-03b / DB repair: create missing tables and columns from schema.prisma (idempotent)\n')
print('\n\n'.join(enum_out) + '\n')
print('\n'.join(out) + '\n')
print('\n'.join(idx_out) + '\n')
print('\n\n'.join(fk_out) + '\n')
