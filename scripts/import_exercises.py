"""
Genera SQL de inserción para los ejercicios del Excel.
Ejecutar: python3 scripts/import_exercises.py
Luego pegar el SQL generado en Supabase SQL Editor.
"""
import openpyxl

LEVEL_MAP = {'Groc': 1, 'Blau': 2, 'Vermell': 3}
TECH_LEVEL_MAP = {1: 'basico', 2: 'basico', 3: 'intermedio', 4: 'avanzado', 5: 'avanzado'}

wb = openpyxl.load_workbook('exercicis_turmell_peu.xlsx')
ws = wb['Turmell i peu']

rows = list(ws.iter_rows(values_only=True))
headers = rows[0]
exercises = [dict(zip(headers, row)) for row in rows[1:] if row[0]]

def esc(val):
    if val is None:
        return 'NULL'
    return "'" + str(val).replace("'", "''") + "'"

lines = []

# 1. Catalogs — movement_patterns
patterns = sorted(set(e['Patró de moviment'] for e in exercises if e['Patró de moviment']))
lines.append('-- MOVEMENT PATTERNS')
for p in patterns:
    lines.append(f"insert into movement_patterns (name) values ({esc(p)}) on conflict (name) do nothing;")

# 2. Equipment (principal)
equipments = sorted(set(e['Equipament principal'] for e in exercises if e['Equipament principal']))
lines.append('\n-- EQUIPMENT')
for eq in equipments:
    lines.append(f"insert into equipment (name) values ({esc(eq)}) on conflict (name) do nothing;")

# 3. Objectives
objectives = sorted(set(e['Objectiu principal'] for e in exercises if e['Objectiu principal']))
lines.append('\n-- OBJECTIVES')
for obj in objectives:
    lines.append(f"insert into objectives (name) values ({esc(obj)}) on conflict (name) do nothing;")

# 4. Muscle groups (principals + secundaris)
all_muscles = set()
for e in exercises:
    for field in ['Músculs principals', 'Músculs secundaris']:
        if e[field]:
            for m in str(e[field]).split(';'):
                m = m.strip()
                if m:
                    all_muscles.add(m)
lines.append('\n-- MUSCLE GROUPS')
for m in sorted(all_muscles):
    lines.append(f"insert into muscle_groups (name) values ({esc(m)}) on conflict (name) do nothing;")

# 5. Exercises
lines.append('\n-- EXERCISES')
for e in exercises:
    level = LEVEL_MAP.get(e['Nivell mínim recomanat'], None)
    tech_level_num = e['Nivell tècnic 1-5']
    tech_level = TECH_LEVEL_MAP.get(int(tech_level_num)) if tech_level_num is not None else None

    # secondary muscles as text
    sec_muscles = e['Músculs secundaris']

    # secondary equipment as text
    sec_eq_parts = [e['Equipament secundari'], e['Equipament alternatiu']]
    sec_eq = '; '.join(x for x in sec_eq_parts if x) or None

    lines.append(f"""insert into exercises (
  exercise_code, name, technical_name, subpattern,
  level, technical_level,
  objective_id,
  movement_pattern_id,
  equipment_id,
  secondary_equipment, secondary_muscles,
  contraindications, technical_notes, common_errors,
  progression, regression,
  is_active, body_zone
) values (
  {esc(e['ID exercici'])},
  {esc(e['Exercici'])},
  {esc(e['Nom tècnic'])},
  {esc(e['Subpatró'])},
  {level if level is not None else 'NULL'},
  {esc(tech_level)},
  (select id from objectives where name = {esc(e['Objectiu principal'])} limit 1),
  (select id from movement_patterns where name = {esc(e['Patró de moviment'])} limit 1),
  (select id from equipment where name = {esc(e['Equipament principal'])} limit 1),
  {esc(sec_eq)},
  {esc(sec_muscles)},
  {esc(e['Contraindicacions / precaucions'])},
  {esc(e['Observacions tècniques'])},
  {esc(e['Errors comuns'])},
  {esc(e['Exercici progressió'])},
  {esc(e['Exercici regressió'])},
  true,
  'Turmell i peu'
) on conflict (exercise_code) do update set
  name = excluded.name,
  technical_name = excluded.technical_name;""")

# 6. Exercise muscle groups
lines.append('\n-- EXERCISE MUSCLE GROUPS (principals)')
for e in exercises:
    if not e['Músculs principals']:
        continue
    for m in str(e['Músculs principals']).split(';'):
        m = m.strip()
        if not m:
            continue
        lines.append(f"""insert into exercise_muscle_groups (exercise_id, muscle_group_id)
select ex.id, mg.id
from exercises ex, muscle_groups mg
where ex.exercise_code = {esc(e['ID exercici'])} and mg.name = {esc(m)}
on conflict do nothing;""")

sql = '\n'.join(lines)
with open('scripts/import_exercises.sql', 'w') as f:
    f.write(sql)

print(f"✓ Generados {len(exercises)} ejercicios")
print("✓ SQL guardado en scripts/import_exercises.sql")
print("  → Pega ese fichero en Supabase SQL Editor")
