import sqlite3, pandas as pd, json, collections

conn = sqlite3.connect('campaigns.db')

# All campaigns
cur = conn.execute("SELECT id, name, brand, goal, category_filters FROM campaigns")
cols = [d[0] for d in cur.description]
rows = cur.fetchall()
print('=== ALL 51 CAMPAIGNS (category_filters) ===')
for r in rows:
    d = dict(zip(cols, r))
    cats = json.loads(d['category_filters']) if d['category_filters'] else []
    print(f"  [{d['id']}] {d['brand']} | {d['name']} -> filters={cats}")

conn.close()

print()
df = pd.read_csv('influencers_engine_ready.csv')
actual_niches = set(df['niche'].str.lower().unique())
print('=== ACTUAL NICHES IN DATASET ===')
print(sorted(actual_niches))

# Find all category_filters used in campaigns
all_filters = []
conn = sqlite3.connect('campaigns.db')
for row in conn.execute("SELECT category_filters FROM campaigns"):
    if row[0]:
        try:
            all_filters.extend(json.loads(row[0]))
        except: pass
conn.close()

filter_counts = collections.Counter(f.lower() for f in all_filters)
print()
print('=== CAMPAIGN FILTERS vs ACTUAL NICHES ===')
for filt, count in filter_counts.most_common():
    match = 'OK' if filt in actual_niches else 'MISSING in dataset'
    print(f"  '{filt}' (used {count}x) -> {match}")
