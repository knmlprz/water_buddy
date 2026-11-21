import zlib, struct
def read_png(path):
    """Minimal decoder: 8-bit RGB/RGBA, non-interlaced. Returns (w, h, channels, rows)."""
    data = open(path, "rb").read(); pos = 8; idat = b""
    while pos < len(data):
        ln, typ = struct.unpack(">I4s", data[pos:pos+8]); body = data[pos+8:pos+8+ln]; pos += 12 + ln
        if typ == b"IHDR": w, h, bd, ct = struct.unpack(">IIBB", body[:10])
        elif typ == b"IDAT": idat += body
    ch = {2: 3, 6: 4}[ct]; raw = zlib.decompress(idat); stride = w * ch; rows = []; prev = bytearray(stride); i = 0
    for _ in range(h):
        f = raw[i]; line = bytearray(raw[i+1:i+1+stride]); i += 1 + stride
        for x in range(stride):
            a = line[x-ch] if x >= ch else 0; b = prev[x]; c = prev[x-ch] if x >= ch else 0
            if f == 1: line[x] = (line[x] + a) & 255
            elif f == 2: line[x] = (line[x] + b) & 255
            elif f == 3: line[x] = (line[x] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c; pa, pb, pc = abs(p-a), abs(p-b), abs(p-c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append(line); prev = line
    return w, h, ch, rows

def write_png(path, w, h, ch, rows, level=9):
    raw = b"".join(b"\x00" + bytes(r) for r in rows)
    def chunk(t, b): return struct.pack(">I", len(b)) + t + b + struct.pack(">I", zlib.crc32(t + b) & 0xffffffff)
    ct = {3: 2, 4: 6}[ch]
    open(path, "wb").write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, ct, 0, 0, 0))
                           + chunk(b"IDAT", zlib.compress(raw, level)) + chunk(b"IEND", b""))

def draw_polys(rows, ch, polys, colors, width=1):
    def put(x, y, c):
        for dx in range(-width + 1, width):
            for dy in range(-width + 1, width):
                xx, yy = int(x) + dx, int(y) + dy
                if 0 <= yy < len(rows) and 0 <= xx < len(rows[0]) // ch:
                    rows[yy][xx*ch:xx*ch+3] = bytes(c)
    for poly, c in zip(polys, colors):
        for (x0, y0), (x1, y1) in zip(poly, poly[1:] + poly[:1]):
            n = int(max(abs(x1-x0), abs(y1-y0))) + 1
            for i in range(n + 1):
                put(x0 + (x1-x0)*i/n, y0 + (y1-y0)*i/n, c)

def inside(x, y, poly):
    c = False
    for (x0, y0), (x1, y1) in zip(poly, poly[1:] + poly[:1]):
        if (y0 > y) != (y1 > y) and x < x0 + (y - y0) * (x1 - x0) / (y1 - y0): c = not c
    return c

def poly_stats(rows, ch, poly):
    vals = []
    xs = [p[0] for p in poly]; ys = [p[1] for p in poly]
    for y in range(int(min(ys)), int(max(ys)) + 1):
        for x in range(int(min(xs)), int(max(xs)) + 1):
            if inside(x + .5, y + .5, poly): vals.append(tuple(rows[y][x*ch:x*ch+3]))
    import statistics as S
    return len(vals), [round(S.fmean(v[i] for v in vals)) for i in range(3)], [round(S.pstdev(v[i] for v in vals)) for i in range(3)]
