from urllib.parse import urlsplit
GROUPS={'categories','services','doctors','packages','banners'}
SECTIONS={'welcome','about','contact'}
def validate_content(data):
    if not isinstance(data,dict) or set(data)!=(GROUPS|SECTIONS): raise ValueError('Invalid content sections.')
    for section in SECTIONS:
        if not isinstance(data[section],dict) or len(data[section])>40: raise ValueError('Invalid section.')
        for key,value in data[section].items():
            if not isinstance(key,str) or not isinstance(value,str) or len(value)>20000: raise ValueError('Invalid text.')
    for group in GROUPS:
        rows=data[group]
        if not isinstance(rows,list) or len(rows)>1000: raise ValueError('Too many items.')
        ids=set()
        for row in rows:
            if not isinstance(row,dict) or len(row)>30: raise ValueError('Invalid item.')
            if not isinstance(row.get('id'),str) or not row['id'] or len(row['id'])>100 or row['id'] in ids: raise ValueError('Item IDs must be unique.')
            ids.add(row['id'])
            if not isinstance(row.get('name'),str) or not row['name'].strip(): raise ValueError('Item name is required.')
            for key,value in row.items():
                if not isinstance(value,str) or len(value)>20000: raise ValueError('Item fields must contain text.')
            image=row.get('image','')
            if image and not ((image.startswith('/') and not image.startswith('//')) or urlsplit(image).scheme=='https'): raise ValueError('Images must use a relative URL or HTTPS.')
            if group=='categories':
                try: float(row.get('order') or 0)
                except ValueError: raise ValueError('Category order must be a number.')
    categories={x['id'] for x in data['categories']}
    if any(s.get('category') not in categories for s in data['services']): raise ValueError('Every service must reference an existing category.')
    return data
