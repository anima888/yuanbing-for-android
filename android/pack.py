import sys, zipfile

base, dex, out = sys.argv[1], sys.argv[2], sys.argv[3]

zin = zipfile.ZipFile(base)
seen = set()
with zipfile.ZipFile(out, 'w') as zout:
    for info in zin.infolist():
        # aapt2 on Windows writes assets/js\ball.js; Android needs forward slashes.
        name = info.filename.replace('\\', '/')
        if name in seen:
            continue
        seen.add(name)
        data = zin.read(info.filename)
        zi = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
        zi.compress_type = zipfile.ZIP_DEFLATED
        zi.external_attr = 0o644 << 16
        zout.writestr(zi, data)
    if 'classes.dex' not in seen:
        zout.write(dex, 'classes.dex')

print('packed:', out)
print('entries:', ', '.join(sorted(seen | {'classes.dex'})))
