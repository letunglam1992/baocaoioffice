"""Sinh biểu tượng ứng dụng (build/icon.png 256px, build/icon.ico nhiều cỡ):
nền xanh ngọc bo góc, tờ báo cáo gấp góc màu trắng có biểu đồ cột — khác biểu tượng dấu tích của quetvanban.
Chạy: python3 tools/tao-icon.py"""
from PIL import Image, ImageDraw
import os

S = 1024  # vẽ cỡ lớn rồi thu nhỏ cho mịn
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
TEAL, TEAL_DAM, TRANG, VANG = (13, 128, 120, 255), (9, 94, 88, 255), (255, 255, 255, 255), (250, 196, 64, 255)
d.rounded_rectangle([40, 40, S - 40, S - 40], radius=200, fill=TEAL)
# tờ giấy gấp góc
x0, y0, x1, y1, gap = 270, 170, 754, 854, 150
d.polygon([(x0, y0), (x1 - gap, y0), (x1, y0 + gap), (x1, y1), (x0, y1)], fill=TRANG)
d.polygon([(x1 - gap, y0), (x1 - gap, y0 + gap), (x1, y0 + gap)], fill=(200, 226, 223, 255))
# dòng chữ
for k, w in enumerate([300, 220]):
    d.rounded_rectangle([x0 + 60, y0 + 90 + k * 70, x0 + 60 + w, y0 + 120 + k * 70], radius=15, fill=(150, 190, 186, 255))
# biểu đồ cột
day = y1 - 90
for k, h in enumerate([150, 250, 340]):
    cx = x0 + 80 + k * 120
    d.rounded_rectangle([cx, day - h, cx + 80, day], radius=14, fill=VANG if k == 2 else TEAL_DAM)
d.rounded_rectangle([x0 + 60, day + 8, x1 - 60, day + 26], radius=9, fill=TEAL_DAM)

out = os.path.join(os.path.dirname(__file__), '..', 'build')
png = img.resize((256, 256), Image.LANCZOS)
png.save(os.path.join(out, 'icon.png'))
img.resize((256, 256), Image.LANCZOS).save(os.path.join(out, 'icon.ico'), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print('Đã tạo build/icon.png và build/icon.ico')
